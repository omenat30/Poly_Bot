# Modelo de calidad (meta-etiquetado) sobre las señales del walk-forward, aprendiendo operación a operación sin mirar el futuro
import numpy as np, pickle, sys, io, contextlib, engine
from engine import ts, H, DD
with contextlib.redirect_stdout(io.StringIO()):
    import wf4b, pm
AGS=['vega','ortega','paz','rios','funding']
Z=pm.stream(AGS)                       # (t0, t1, r, agente, lado) de las variantes elegidas cada año
FZ=np.load(engine.D+'funding_h.npz'); F3=np.nan_to_num(FZ['F3']); F30=np.nan_to_num(FZ['F30'])
c,h,l,t=H['c'],H['h'],H['l'],H['t']
A14=engine.atr(H,14); A720=engine.sma(A14,720)
d=np.diff(c,prepend=c[0]); up=engine.ema(np.maximum(d,0),14); dn=engine.ema(np.maximum(-d,0),14); RSI=100-100/(1+up/np.maximum(dn,1e-9))
S200=engine.sma(c,200*24); S50=engine.sma(c,50*24)
def feats(t0,a,s,hist,allh):
    i=np.searchsorted(t,t0)-1                       # última vela cerrada antes de la entrada
    v=lambda x: 0.0 if not np.isfinite(x) else float(x)
    vol=A14[i]/c[i]
    f=[s,
       v(np.sign(c[i]-S200[i])*s), v(np.sign(S50[i]-S200[i])*s),
       v((c[i]/c[i-24]-1)/vol/5*s), v((c[i]/c[i-168]-1)/vol/12*s),
       v(np.log(A14[i]/A720[i])), v((RSI[i]-50)/50*s),
       v(F3[i]*1e4*s), v((F3[i]-F30[i])*1e4*s),
       v((c[i]-l[i-480:i].min())/(h[i-480:i].max()-l[i-480:i].min()+1e-9)*2-1)*s,
       np.mean(hist[a][-10:]) if len(hist[a])>=3 else 0.0,
       np.mean(allh[-10:]) if len(allh)>=3 else 0.0]
    f+=[1.0 if a==x else 0.0 for x in AGS]
    return np.clip(np.array(f),-4,4)
NAMES=['lado','sobreSMA200','SMA50>200','ret24h','ret7d','volrel','RSI','funding','funding-media30d','pos20d','R10agente','R10oficina']+['ag_'+a for a in AGS]
def fit(X,y,w,lam=3.0,it=300):
    mu=X.mean(0); sd=X.std(0)+1e-9; Xs=(X-mu)/sd; n,k=Xs.shape; b=np.zeros(k+1); Xb=np.c_[np.ones(n),Xs]
    for _ in range(it):                                  # Newton con L2 (sin penalizar el intercepto)
        p=1/(1+np.exp(-Xb@b)); g=Xb.T@(w*(p-y))+lam*np.r_[0,b[1:]]
        Hm=(Xb*(w*p*(1-p))[:,None]).T@Xb+lam*np.diag(np.r_[0,np.ones(k)])
        b-=np.linalg.solve(Hm,g)
    return b,mu,sd
def pred(m,x): b,mu,sd=m; return 1/(1+np.exp(-(b[0]+((x-mu)/sd)@b[1:])))
# 1) features y etiquetas en orden temporal; los históricos por agente solo incluyen operaciones ya cerradas
rows=[]; hist={a:[] for a in AGS}; allh=[]; closed=[]
for k,(t0,t1,r,a,s) in enumerate(Z):
    for (tc,rc,ac) in sorted([x for x in closed if x[0]<=t0]): hist[ac].append(rc); allh.append(rc)
    closed=[x for x in closed if x[0]>t0]
    rows.append((t0,t1,r,a,s,feats(t0,a,s,hist,allh))); closed.append((t1,r,a))
X=np.array([x[5] for x in rows]); y=np.array([1.0 if x[2]>0 else 0.0 for x in rows]); T0=np.array([x[0] for x in rows]); T1=np.array([x[1] for x in rows])
# 2) aprendizaje en línea: antes de cada señal se reentrena con las operaciones ya CERRADAS (peso por recencia, vida media 2 años)
MINN=int(sys.argv[1]) if len(sys.argv)>1 else 60; LAM=float(sys.argv[2]) if len(sys.argv)>2 else 3.0
P=np.full(len(rows),np.nan); Q=np.full(len(rows),np.nan); m=None; lastn=-1
for k in range(len(rows)):
    tr=np.where(T1<=T0[k])[0]
    if len(tr)<MINN: continue
    if len(tr)!=lastn:
        w=0.5**((T0[k]-T0[tr])/(2*31557600)); m=fit(X[tr],y[tr],w,LAM); lastn=len(tr)
        ptr=pred(m,X[tr])
    P[k]=pred(m,X[k]); Q[k]=(ptr<P[k]).mean()           # percentil de la puntuación frente a su propio entrenamiento
pickle.dump(dict(rows=[r[:5] for r in rows],X=X,P=P,Q=Q,model=m,names=NAMES),open(engine.D+'ml_res.pkl','wb'))
# 3) cartera con el gestor (tope 2R, freno a mitad tras 8R) filtrando por calidad
def runf(skip=None, size=None):
    Zf=[]
    for k,(t0,t1,r,a,s,_) in enumerate(rows):
        if skip is not None and Q[k]==Q[k] and Q[k]<skip: continue
        Zf.append((t0,t1,r,a,s))
    return pm.run(Zf,base=wf4b.wf4.BASE,cap=2.0,ddth=(8,0.5))
f=lambda d:' '.join(f'{k}={float(v):.3f}' for k,v in d.items())
print('señales',len(rows),'con modelo',np.isfinite(P).sum(),'desde',__import__('datetime').datetime.utcfromtimestamp(T0[np.isfinite(P)][0]).date())
print('base           ',f(runf()))
for q in (0.1,0.2,0.3,0.4):
    print(f'filtro <p{int(q*100):02d}   ',f(runf(q)))
ok=np.isfinite(P); r=np.array([x[2] for x in rows])
for lo,hi in ((0,.25),(.25,.5),(.5,.75),(.75,1.01)):
    s=ok&(Q>=lo)&(Q<hi); print(f'cuartil {lo:.2f}-{hi:.2f} n={s.sum():3d} win={np.mean(r[s]>0):.3f} R={r[s].mean():+.3f}')
print('coef',dict(zip(['int']+NAMES,np.round(m[0],2))))

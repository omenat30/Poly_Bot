import numpy as np, pickle, engine, math, sys
from engine import ts
R=pickle.load(open(engine.D+'rs_rows.pkl','rb'))
exec(open('funding.py').read().split("if __name__")[0])
for x in R: x['rn']=x['r']-x['s']*fr[(ft>x['T'])&(ft<=x['T1'])].sum()/x['rf']   # funding
FK=['rng','brk','z','rvol','ema15','tr1h','adx4','rsi15','rsi4','pdh','pdl','atrp','ret24','body']
KINDS=['ruptura','exceso','barrido']
def raw(x): f=x['f']; return [f[k] for k in FK]
Xr=np.nan_to_num(np.array([raw(x) for x in R],float)); T0=np.array([x['T'] for x in R]); T1=np.array([x['T1'] for x in R]); Y=np.array([1.0*(x['rn']>0) for x in R])
CAT=np.array([[1.0*(x['kind']==k) for k in KINDS]+[1.0*(x['s']==1)]+[1.0*(x['f']['hour']//4==q) for q in range(6)]+[1.0*(x['f']['dow']==q) for q in range(7)] for x in R])
def binned(Xtr, Xte, nb=5):
    outs_tr=[]; outs_te=[]
    for j in range(Xtr.shape[1]):
        qs=np.quantile(Xtr[:,j],np.linspace(0,1,nb+1)[1:-1]); btr=np.searchsorted(qs,Xtr[:,j]); bte=np.searchsorted(qs,Xte[:,j])
        outs_tr.append(np.eye(nb)[btr]); outs_te.append(np.eye(nb)[bte])
    return np.hstack(outs_tr), np.hstack(outs_te)
def fit(X,y,w,lam):
    mu=X.mean(0); sd=X.std(0)+1e-9; Z=np.c_[np.ones(len(X)),(X-mu)/sd]; b=np.zeros(Z.shape[1])
    for _ in range(40):
        p=1/(1+np.exp(-Z@b)); g=Z.T@(w*(p-y))+lam*np.r_[0,b[1:]]; Hm=(Z*(w*p*(1-p))[:,None]).T@Z+lam*np.diag(np.r_[0,np.ones(Z.shape[1]-1)]); b-=np.linalg.solve(Hm,g)
    return lambda Xn:1/(1+np.exp(-(np.c_[np.ones(len(Xn)),(Xn-mu)/sd]@b)))
LAM=float(sys.argv[1]) if len(sys.argv)>1 else 30.0
P=np.full(len(R),np.nan); Q=np.full(len(R),np.nan)
for y in range(2018,2027):
    tr=T1<ts(y); te=(T0>=ts(y))&(T0<ts(y+1))
    Btr,Bte=binned(Xr[tr],Xr[te]); Xtr=np.hstack([Btr,CAT[tr]]); Xte=np.hstack([Bte,CAT[te]])
    w=0.5**((ts(y)-T0[tr])/(3*31557600)); pr=fit(Xtr,Y[tr],w,LAM); ptr=pr(Xtr); P[te]=pr(Xte); srt=np.sort(ptr); Q[te]=np.searchsorted(srt,P[te])/len(srt)
for x,p,q in zip(R,P,Q): x['p']=p; x['q']=q
pickle.dump(R,open(engine.D+f'rs_scored_{int(LAM)}.pkl','wb'))
def take(sel, thr):
    out=[]; busy=0
    for x in sorted(sel,key=lambda x:x['T']):
        if x['q']==x['q'] and x['q']>=thr and x['T']>=busy: out.append(x); busy=x['T1']
    return out
END=int(engine.H['t'][-1])
def st(tr,a,b):
    tr=[x for x in tr if a<=x['T']<b]; r=np.array([x['rn'] for x in tr]); yrs=(min(b,END)-a)/31557600
    if not len(r): return 'n=0'
    d0=a//86400; vv=np.zeros(min(b,END)//86400-d0+1)
    for x in tr: vv[min(len(vv)-1,x['T1']//86400-d0)]+=x['rn']
    return f'n/sem={len(r)/yrs/52.18:.2f} win={np.mean(r>0):.3f} R/op={r.mean():+.3f} R/año={r.sum()/yrs:+.1f} Sharpe={vv.mean()/vv.std()*math.sqrt(365):.2f}'
pool=[x for x in R if x['office'] and not x['radar']]
for thr in (0.80,0.90,0.95,0.97,0.99):
    tk=take(pool,thr); print(f'lam={LAM} umbral q>={thr}', '18-21',st(tk,ts(2018),ts(2022)),'| 22-26',st(tk,ts(2022),END))

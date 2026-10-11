import pickle, numpy as np, engine, io, contextlib, math, json, sys
from engine import ts
with contextlib.redirect_stdout(io.StringIO()):
    exec(open('audit5.py').read().split('res={}')[0])
R=pickle.load(open(engine.D+'rl_rows.pkl','rb'))
exec(open('funding.py').read().split("if __name__")[0])
def rm(x):   # costes de la Mesa + funding de los perpetuos
    f=fr[(ft>x['T'])&(ft<=x['T1'])].sum()*x['s']
    return x['r']-0.0006/x['risk_f']-(0.0003/x['risk_f'] if x['reason']=='stop' else 0)-f/x['risk_f']
for x in R: x['rm']=rm(x)
END_=END
# --- Duarte sobre el Radar: regresión logística, reentrenada cada año solo con señales ya cerradas ---
KINDS=['bo','mr','swp']; GR=['A','B','C']
def fv(x):
    f=x['f']; return np.array([x['s'],f['sma200'],f['ret24'],f['ret7d'],f['volrel'],f['rsi'],f['fund'],f['pos20'],f['vega'],f['ortega'],f['paz'],f['nub'],f['risk'],
        *[1.0*(x['kind']==k) for k in KINDS],*[1.0*(x['grade']==g) for g in GR],1.0*(x['hour']<9),1.0*(9<=x['hour']<13),1.0*(13<=x['hour']<17)])
X=np.clip(np.array([fv(x) for x in R]),-4,4); Y=np.array([1.0 if x['rm']>0 else 0.0 for x in R]); T0=np.array([x['T'] for x in R]); T1=np.array([x['T1'] for x in R])
def fit(Xt,yt,w,lam=10.0):
    mu=Xt.mean(0); sd=Xt.std(0)+1e-9; Z=np.c_[np.ones(len(Xt)),(Xt-mu)/sd]; b=np.zeros(Z.shape[1])
    for _ in range(50):
        p=1/(1+np.exp(-Z@b)); g=Z.T@(w*(p-yt))+lam*np.r_[0,b[1:]]; Hm=(Z*(w*p*(1-p))[:,None]).T@Z+lam*np.diag(np.r_[0,np.ones(Z.shape[1]-1)]); b-=np.linalg.solve(Hm,g)
    return lambda Xn:1/(1+np.exp(-(np.c_[np.ones(len(Xn)),(Xn-mu)/sd]@b))), lambda Xn: None
P=np.full(len(R),np.nan); Q=np.full(len(R),np.nan)
for y in range(2018,2027):
    tr=T1<ts(y); te=(T0>=ts(y))&(T0<ts(y+1))
    if tr.sum()<150: continue
    w=0.5**((ts(y)-T0[tr])/(2*31557600)); pr,_=fit(X[tr],Y[tr],w); ptr=pr(X[tr]); P[te]=pr(X[te]); Q[te]=np.array([(ptr<p).mean() for p in P[te]])
for x,p,q in zip(R,P,Q): x['p']=p; x['q']=q
# --- cartera: Salinas (tope 2R, freno a mitad tras 8R) ---
def port(trades, a=ts(2020), b=END_):
    Z=sorted([z for z in trades if a<=z[0]<b]); open_=[]; eq=0; pk=0; tk=[]
    for t0,t1,r,w,src in Z:
        for o in sorted([o for o in open_ if o[1]<=t0],key=lambda o:o[1]): eq+=o[2]*o[3]; pk=max(pk,eq); open_.remove(o)
        if pk-eq>8: w*=0.5
        room=2.0-sum(o[3] for o in open_)
        if w>room: w=room
        if w<0.2: continue
        open_.append((t0,t1,r,w)); tk.append((t0,t1,r,w,src))
    yrs=(b-a)/31557600; r=np.array([x[2] for x in tk]); wr=np.array([x[2]*x[3] for x in tk]); o=np.argsort([x[1] for x in tk]); cum=np.cumsum(wr[o]); dd=(np.maximum.accumulate(np.r_[0,cum])[1:]-cum).max()
    d0=a//86400; v=np.zeros(b//86400-d0+1)
    for x in tk: v[min(len(v)-1,x[1]//86400-d0)]+=x[2]*x[3]
    py={y:round(sum(x[2]*x[3] for x in tk if ts(y)<=x[0]<ts(y+1)),1) for y in range(max(2020,a and 2020),2027) if ts(y)>=a}
    return dict(n=len(tk),sem=round(len(tk)/yrs/52.18,2),win=round(float((r>0).mean()),3),Rop=round(float(r.mean()),3),Rop_cart=round(float(wr.mean()),3),Ry=round(float(wr.sum()/yrs),1),dd=round(float(dd),1),SR=round(float(v.mean()/v.std()*math.sqrt(365)),2),py=py)
def radar(sel, w=1.0, src='radar'): return [(x['T'],x['T1'],x['rm'],w if not callable(w) else w(x),src) for x in R if sel(x)]
mesaL=[(l['t0'],l['t1'],l['r'],l['w'],l['a']) for l in run_log([z for z in with_fund(stream_full()) if {'vega':0.75,'ortega':1.0,'paz':0.5}.get(z[3],0)>0],base={'vega':0.75,'ortega':1.0,'paz':0.5,'rios':0,'funding':0},cap=None,ddth=None)]
import datetime as dtm
def radar_live(x):   # horario real de los escáneres del Radar: L-V 7:00-22:00 Madrid
    return x['dow']<5 and x['office'] or (x['dow']<5 and 19<=x['hour']<=20 and not x['office'])
pazv=lambda x: x['f']['paz']>=0
CF={}
CF['Radar 24/7 (papel)']=radar(lambda x:True)
CF['Radar horario real (L-V 7-22)']=radar(radar_live)
CF['A Oficina: Radar en sus cabezas (L-V 7-21)']=radar(lambda x:x['office'])
CF['B A + veto de Paz']=radar(lambda x:x['office'] and pazv(x))
for q in (0.1,0.2,0.3):
    CF[f'C B + Duarte quita el {int(q*100)}% peor']=radar(lambda x,q=q:x['office'] and pazv(x) and not (x['q']==x['q'] and x['q']<q))
CF['D B + Duarte dimensiona (0,5-1,5R)']=radar(lambda x:x['office'] and pazv(x), w=lambda x:1.0 if x['q']!=x['q'] else 0.5+x['q'])
CF['E B + agentes propios (v10)']=CF['B A + veto de Paz']+mesaL
CF['F B + Ortega y Vega propios']=CF['B A + veto de Paz']+[m for m in mesaL if m[4] in ('ortega','vega')]
out={}
for per,(a,b) in [('2018-21 (elección)',(ts(2018),ts(2022))),('2022-26 (prueba)',(ts(2022),END_)),('2020-26',(ts(2020),END_))]:
    print('=====',per)
    for k,v in CF.items():
        s=port(v,a,b); out[(per,k)]=s; print(f'{k:45s} n/sem={s["sem"]:.2f} win={s["win"]:.3f} R/op={s["Rop"]:+.3f} cart/op={s["Rop_cart"]:+.3f} R/año={s["Ry"]:+.1f} caída={s["dd"]:.1f} Sharpe={s["SR"]:.2f}')
pickle.dump(R,open(engine.D+'rl_rows_scored.pkl','wb'))

import json, numpy as np, engine, math, datetime as dt
from engine import ts
exec(open('funding.py').read().split("if __name__")[0])
MASK=np.load(engine.D+'office_mask2.npy'); t=engine.H['t']; END=int(t[-1])
def office_at(T): i=np.searchsorted(t,T//3600*3600); return bool(MASK[min(i,len(t)-1)])
def load(name):
    out=[]
    for x in json.load(open(engine.D+f'../rx_{name}.json')):
        rf=x['risk']/x['entry']; f=fr[(ft>x['sigT'])&(ft<=x['exitT'])].sum()*x['side']
        x['rm']=x['r']-0.0006/rf-(0.0003/rf if x['reason']=='stop' else 0)-f/rf; x['office']=office_at(int(x['sigT'])); x['rf']=rf; out.append(x)
    return out
def st(tr,a,b):
    tr=[x for x in tr if a<=x['sigT']<b and x['office']]; r=np.array([x['rm'] for x in tr]); yrs=(min(b,END)-a)/31557600
    d0=a//86400; v=np.zeros((min(b,END))//86400-d0+1)
    for x in tr: v[min(len(v)-1,int(x['exitT'])//86400-d0)]+=x['rm']
    return f'n/sem={len(r)/yrs/52.18:.2f} win={np.mean(r>0):.3f} R/op={r.mean():+.3f} R/año={r.sum()/yrs:+.1f} Sharpe={v.mean()/v.std()*math.sqrt(365):.2f}'
V={n:load(n) for n in ('base','be1','rr12','rr2')}
for n,tr in V.items():
    for per,(a,b) in [('18-21',(ts(2018),ts(2022))),('22-26',(ts(2022),END))]: print(f'salida {n:5s} {per}',st(tr,a,b))
# Duarte con las variables internas del Radar (solo lo que se sabe al cierre de la vela de señal)
R=V['base']; KS=['bo','mr','swp']
def fv(x):
    h=dt.datetime.utcfromtimestamp(x['sigT']).hour
    return [x['side'],x.get('rvol',1) or 1,x.get('trend',0) or 0,x.get('score',0) or 0,x['rf']*100,*[1.0*(x['kind']==k) for k in KS],1.0*(h<9),1.0*(9<=h<13),1.0*(13<=h<17)]
X=np.clip(np.nan_to_num(np.array([fv(x) for x in R],float)),-10,10); Y=np.array([1.0*(x['rm']>0) for x in R]); T0=np.array([x['sigT'] for x in R]); T1=np.array([x['exitT'] for x in R])
def fit(Xt,yt,w,lam=10.0):
    mu=Xt.mean(0); sd=Xt.std(0)+1e-9; Z=np.c_[np.ones(len(Xt)),(Xt-mu)/sd]; b=np.zeros(Z.shape[1])
    for _ in range(50):
        p=1/(1+np.exp(-Z@b)); g=Z.T@(w*(p-yt))+lam*np.r_[0,b[1:]]; Hm=(Z*(w*p*(1-p))[:,None]).T@Z+lam*np.diag(np.r_[0,np.ones(Z.shape[1]-1)]); b-=np.linalg.solve(Hm,g)
    return lambda Xn:1/(1+np.exp(-(np.c_[np.ones(len(Xn)),(Xn-mu)/sd]@b)))
Q=np.full(len(R),np.nan)
for y in range(2018,2027):
    tr=T1<ts(y); te=(T0>=ts(y))&(T0<ts(y+1)); w=0.5**((ts(y)-T0[tr])/(2*31557600)); pr=fit(X[tr],Y[tr],w); ptr=pr(X[tr]); Q[te]=[(ptr<p).mean() for p in pr(X[te])]
for x,q in zip(R,Q): x['q']=q
for qq in (0.0,0.1,0.2,0.3):
    sel=[x for x in R if not (x['q']==x['q'] and x['q']<qq)]
    print(f'Duarte interno quita {int(qq*100)}%','18-21',st(sel,ts(2018),ts(2022)),'| 22-26',st(sel,ts(2022),END))

import numpy as np, json, pickle, datetime, engine, strategies as S
from engine import *
M=np.load(D+'office_mask.npy'); orig=engine.sim
def off(sigs, trail=None, exit_mask=None): return engine.sim_office(sigs, trail, exit_mask, M)
S.sim=off
PICK={'vega':(S.vega,dict(n=20,k=3.5,shorts=0,mom=1)),'ortega':(S.ortega2,dict(N=5,k=2,shorts=0,reg=0)),'rios':(S.rios2,dict(q=0.2,vm=1.0,k=4,reg=50,shorts=0))}
R={k:f(**p) for k,(f,p) in PICK.items()}
real=sorted(R['vega']+R['ortega'],key=lambda x:x[4])
def yr(x): return datetime.datetime.utcfromtimestamp(int(x)).year
Y={}
for k,T in R.items():
    for x in T:
        if x[0]<ts(2017): continue
        d=Y.setdefault(yr(x[0]),{}); d.setdefault(k,[]).append(x[2])
print('año  vega  ortega  rios  | mesa(vega+ortega)')
for y in sorted(Y):
    d=Y[y]; s=lambda k: sum(d.get(k,[])); print(y, *(f'{s(k):+6.1f}({len(d.get(k,[]))})' for k in ('vega','ortega','rios')), f'| {s("vega")+s("ortega"):+6.1f}')
print('MESA real TRAIN',fmt(stats(real,*TRAIN)),'\n          TEST ',fmt(stats(real,*TEST)))
for a,b,lab in [(ts(2017),ts(2022),'2017-21'),(ts(2022),10**10,'2022-26')]:
    r=np.array([x[2] for x in real if a<=x[4]<b]); yrs=(min(b,real[-1][4])-a)/31557600
    cum=np.cumsum(r); dd=(np.maximum.accumulate(np.r_[0,cum])[1:]-cum).max()
    print(lab,'R/año',round(r.sum()/yrs,1),'caída máx',round(dd,1),'ops/año',round(len(r)/yrs,1))
# export
r2=lambda v: round(float(v),2)
out={'start':ts(2017),'split':ts(2022),'end':int(H['t'][-1]),
 'tr':{k:[[int(x[0]),int(x[1]),r2(x[2]),x[3],int(x[4])] for x in T if x[0]>=ts(2017)] for k,T in R.items()}}
json.dump(out,open(D+'page_trades.json','w'))
pickle.dump(R,open(D+'final.pkl','wb'))

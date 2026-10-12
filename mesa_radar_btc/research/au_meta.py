# Auditoría v12 · H1: aprender de TODAS las oportunidades extra del Radar (no solo las de la regla a mano). 5 variantes cerradas.
import json, numpy as np, engine, math, datetime as dt
import lightgbm as lgb
from engine import ts
exec(open('funding.py').read().split("if __name__")[0])
MASK=np.load(engine.D+'office_mask2.npy'); Ht=engine.H['t']; END=int(Ht[-1])
def office(T): k=np.searchsorted(Ht,(T-1)//3600*3600); return bool(MASK[min(k,len(Ht)-1)])
from zoneinfo import ZoneInfo; tz=ZoneInfo('Europe/Madrid')
X=[x for x in json.load(open(engine.D+'../multi_all.json')) if x['extra']]
for x in X:
    rf=x['risk']/x['entry']; x['rn']=x['r']-0.0006/rf-(0.0003/rf if x['reason']=='stop' else 0)-x['side']*fr[(ft>x['sigT'])&(ft<=x['exitT'])].sum()/rf
    x['office']=office(x['sigT']); d=dt.datetime.fromtimestamp(x['sigT']-1,tz); x['hour']=d.hour; x['rp']=rf
X=[x for x in X if x['office']]
def feat(x): return [1.0 if x['side']==x['radarSide'] else 0.0, x['ru'] if x['ru'] is not None else 0.0, x['kind']=='bo', x['kind']=='mr', x['kind']=='swp',
    {'A':2,'B':1}.get(x['grade'],0), x['side'], x['rvol'] or 0, x['trend'] or 0, x['rp']*100, x['hour']]
F=np.array([feat(x) for x in X],float); y=np.array([x['rn'] for x in X]); T0=np.array([x['sigT'] for x in X]); T1=np.array([x['exitT'] for x in X])
P1=np.full(len(X),np.nan); P2=np.full(len(X),np.nan)
for yr in range(2018,2027):
    lo,hi=ts(yr),ts(yr+1); tr=T1<lo; te=(T0>=lo)&(T0<hi)
    if tr.sum()<60 or te.sum()==0: continue
    w=0.5**((lo-T0[tr])/(2*31557600))
    m=lgb.train(dict(objective='regression',learning_rate=0.05,num_leaves=4,min_data_in_leaf=30,lambda_l2=20,feature_fraction=0.8,verbose=-1),lgb.Dataset(F[tr],np.clip(y[tr],-1.5,2),weight=w),150)
    P1[te]=m.predict(F[te])
    # logístico (ganar) con estandarización
    mu=F[tr].mean(0); sd=F[tr].std(0)+1e-9; Z=(F[tr]-mu)/sd; b=np.zeros(Z.shape[1]+1); yy=(y[tr]>0).astype(float)
    for _ in range(300):
        p=1/(1+np.exp(-(b[0]+Z@b[1:]))); g0=np.sum(w*(p-yy)); g=Z.T@(w*(p-yy))+1.0*b[1:]; b[0]-=0.5*g0/w.sum(); b[1:]-=0.5*g/w.sum()
    P2[te]=1/(1+np.exp(-(b[0]+((F[te]-mu)/sd)@b[1:])))
V={'V0 regla actual (a favor, ru<0,8)':[x['side']==x['radarSide'] and x['ru'] is not None and x['ru']<0.8 for x in X],
   'V1 regla actual + grado A/B':[x['side']==x['radarSide'] and x['ru'] is not None and x['ru']<0.8 and x['grade'] in 'AB' for x in X],
   'V2 a favor + grado A (cualquier ru)':[x['side']==x['radarSide'] and x['grade']=='A' for x in X],
   'V3 LightGBM R previsto > 0':list(np.nan_to_num(P1,nan=-9)>0),
   'V4 logístico P(ganar) > 0,5':list(np.nan_to_num(P2,nan=0)>0.5)}
AG={'bo':'vega','mr':'paz','swp':'rios'}
for k,sel in V.items():
    C=[dict(t0=int(x['sigT']),t1=int(x['exitT']),r=round(x['rn'],4),side=x['side'],risk_pct=x['rp'],src='aprendiz_'+AG[x['kind']],w=1.0) for x,s in zip(X,sel) if s and x['sigT']>=ts(2018)]
    json.dump(C,open(f"/tmp/au_{k[:2]}.json",'w'))
    a=[c for c in C if c['t0']<ts(2022)]; b=[c for c in C if c['t0']>=ts(2022)]
    f=lambda L,yrs: f"n/sem {len(L)/yrs/52.18:.2f} win {np.mean([c['r']>0 for c in L])*100:.1f}% R/op {np.mean([c['r'] for c in L]):+.3f}" if L else '—'
    print(f"{k:38s} | 18-21 {f(a,4)} | 22-26 {f(b,(END-ts(2022))/31557600)}")

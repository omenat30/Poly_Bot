import numpy as np, pickle, json, engine, math
from engine import ts
A=np.fromfile(engine.D+'../min.bin',dtype=np.float64).reshape(-1,6); mt=A[:,0].astype(np.int64); mo,mh,ml,mc=A[:,1],A[:,2],A[:,3],A[:,4]
R=pickle.load(open(engine.D+'rl_rows_scored.pkl','rb')); RT={int(x['sigT']):x for x in json.load(open(engine.D+'../panel_trades.json'))}
def resim(x, d):
    y=RT[x['T']]; T=x['T']+d*60; j=np.searchsorted(mt,T)
    if j>=len(mt): return None
    e=mo[j]; sl=y['sl0']; tp=y['tp']; s=y['side']; risk=abs(e-sl)
    if (e-sl)*s<=0: return -1.0-0.0017*e/max(risk,1e-9)          # el precio ya pasó el stop: pérdida inmediata
    if (tp-e)*s<=0: return None                                      # ya pasó el objetivo: no se entra
    end=np.searchsorted(mt,x['T']+72*3600)
    for k in range(j,min(end,len(mt))):
        if (ml[k]<=sl if s==1 else mh[k]>=sl): px=sl; why='stop'; break
        if (mh[k]>=tp if s==1 else ml[k]<=tp): px=tp; why='target'; break
    else: px=mc[min(end,len(mt))-1]; why='tiempo'
    cost=(0.0014+(0.0003 if why=='stop' else 0))*e
    return ((px-e)*s-cost)/risk
def stat(rr,yrs):
    rr=np.array([r for r in rr if r is not None]); return f'n={len(rr)} win={np.mean(rr>0):.3f} R/op={rr.mean():+.3f} R/año={rr.sum()/yrs:+.1f}'
yrs=(engine.H['t'][-1]-ts(2022))/31557600
sets={'Radar horario real':[x for x in R if x['T']>=ts(2022) and x['dow']<5 and (x['office'] or 19<=x['hour']<=20)],
      'Oficina G1 (sin tamaño)':[x for x in R if x['T']>=ts(2022) and x['office'] and x['f']['paz']>=0 and not (x['q']==x['q'] and x['q']<0.2)]}
for lab,S in sets.items():
    for d in (0,1,5,15):
        print(lab,f'retraso {d:2d} min',stat([resim(x,d) for x in S],yrs))

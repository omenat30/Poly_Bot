import json, numpy as np, engine
from engine import ts
A=np.fromfile(engine.D+'../min.bin',dtype=np.float64).reshape(-1,6); mt=A[:,0].astype(np.int64); mo,mh,ml,mc=A[:,1],A[:,2],A[:,3],A[:,4]
MASK=np.load(engine.D+'office_mask2.npy'); Ht=engine.H['t']; END=int(Ht[-1])
def office(T): k=np.searchsorted(Ht,(T-1)//3600*3600); return bool(MASK[min(k,len(Ht)-1)])
RU={int(d['sigT']):d['ru'] for d in json.load(open(engine.D+'mx_ru.json'))}
X=[x for x in json.load(open(engine.D+'../multi_trades.json')) if x['extra'] and x['side']==x['radarSide'] and office(x['sigT']) and RU.get(int(x['sigT']),9)<0.8 and x['sigT']>=ts(2022)]
def resim(x,d):
    T=x['sigT']+d*60; j=np.searchsorted(mt,T); e=mo[j]; s=x['side']; R=x['risk']; sl=x['entry']-s*R; tp=x['entry']+s*1.65*R
    if (e-sl)*s<=0: return -1.0
    if (tp-e)*s<=0: return None
    end=np.searchsorted(mt,x['sigT']+72*3600)
    for k in range(j,end):
        if (ml[k]<=sl if s==1 else mh[k]>=sl): px=sl; w='stop'; break
        if (mh[k]>=tp if s==1 else ml[k]<=tp): px=tp; w='target'; break
    else: px=mc[end-1]; w='tiempo'
    risk=abs(e-sl); return ((px-e)*s-(0.0014+(0.0003 if w=='stop' else 0))*e)/risk
for d in (0,1,5,15):
    r=np.array([v for v in (resim(x,d) for x in X) if v is not None]); print(f'aprendices 2022-26 retraso {d:2d} min: n={len(r)} win={np.mean(r>0):.3f} R/op={r.mean():+.3f}')

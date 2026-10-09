import sys, numpy as np, itertools, engine, strategies as S, mgmt
from engine import stats, TRAIN, TEST, H
import paz3 as PZ
END=int(H['t'][-1]); TEY=(END-TEST[0])/31557600
def run(name, cfg):
    def sim(sigs, trail=None, exit_mask=None): return mgmt.sim_m(sigs, trail, exit_mask, **cfg)
    S.sim=sim; PZ.off=sim
    if name=='vega': return S.vega(n=20,k=3.5,shorts=0,mom=1)
    if name=='ortega': return S.ortega2(N=5,k=2,shorts=1,reg=50)
    if name=='paz': return PZ.paz3(rsi_lo=45,reg=50,shorts=1,maxh=96,tk=5,en=50)
    if name=='rios': return S.rios2(q=0.2,vm=1.0,k=4,reg=50,shorts=1)
name=sys.argv[1]
grid=[dict()]+[dict(tp=tp,f=f,be=be,beoff=bo) for tp in (None,0.75,1,1.5) for f in (0.33,0.5) for be in (None,0.75,1,1.5) for bo in (0.1,0.3) if not (tp is None and f==0.5) and not (be is None and bo==0.3) and (tp or be)]
for cfg in grid:
    T=run(name,cfg); a=stats(T,*TRAIN); b=stats(T,*TEST)
    print(f"{name:6s} {str(cfg):55s} TR w={a['win']*100:4.1f}% e={a['exp']:+.3f} t={a['t']:+.2f} | TE n/sem={b['n']/TEY/52.18:4.2f} w={b['win']*100:4.1f}% e={b['exp']:+.3f} t={b['t']:+.2f}",flush=True)

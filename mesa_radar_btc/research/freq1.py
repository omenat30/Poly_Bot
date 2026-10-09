import numpy as np, engine, strategies as S
from engine import *
M=np.load(D+'office_mask.npy')
def off(sigs, trail=None, exit_mask=None): return engine.sim_office(sigs, trail, exit_mask, M)
S.sim=off
def yrs(a,b): return (b-a)/31557600
END=int(H['t'][-1])
def rep(name,T):
    a=stats(T,*TRAIN); b=stats(T,*TEST)
    print(f'{name:40s} TR n/yr={a["n"]/5:5.1f} exp={a["exp"]:+.3f} t={a["t"]:+.2f} | TE n/yr={b["n"]/yrs(TEST[0],END):5.1f} exp={b["exp"]:+.3f} t={b["t"]:+.2f} win={b["win"]*100:.0f}%')
import sys
for s in (0,1):
  for r in (0,50):
    for N in (2,3,5):
      for k in (1.5,2,3):
        rep(f'ortega2 N={N} k={k} sh={s} reg={r}',S.ortega2(N=N,k=k,shorts=s,reg=r))

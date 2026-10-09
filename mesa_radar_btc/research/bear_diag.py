import json, numpy as np, datetime, engine
from engine import H, DD, sma, ts
R=json.load(open('../live/research.json')); W=R['w']
dc=DD['c']; dt=DD['t']
S50=sma(dc,50); S200=sma(dc,200)
hi365=np.array([dc[max(0,i-364):i+1].max() for i in range(len(dc))])
def day_idx(t): return np.searchsorted(dt,t,side='right')-2   # último día cerrado
def regs(t):
    d=day_idx(t); c=dc[d]
    return dict(b200=c<S200[d], dcross=S50[d]<S200[d], dd20=c<0.8*hi365[d], dd30=c<0.7*hi365[d])
yr=lambda t: datetime.datetime.utcfromtimestamp(t).year
for y in (2022,2025):
    print('=====',y)
    for a,T in R['tr'].items():
        for s in (1,-1):
            r=np.array([x[1] for x in T if yr(x[0])==y and x[2]==s])
            if len(r): print(f'  {a:6s} {"L" if s==1 else "S"} n={len(r):3d} win={np.mean(r>0)*100:3.0f}% exp={r.mean():+.2f} R={r.sum()*W[a]:+.1f}')
print('== todas 2020-26 por régimen (largos / cortos)')
for k in ('b200','dcross','dd20','dd30'):
    for s in (1,-1):
        for v in (True,False):
            r=np.array([x[1] for a,T in R['tr'].items() for x in T if x[2]==s and regs(x[0])[k]==v])
            print(f'  {k:6s}={str(v):5s} {"L" if s==1 else "S"} n={len(r):4d} win={np.mean(r>0)*100:3.0f}% exp={r.mean():+.3f}')

import numpy as np, pickle, engine
from engine import ts
import wf2_sel as W
from wf3_sel import yearly
W.C=pickle.load(open(engine.D+'wf3_cands.pkl','rb')); FW={'vega':1,'ortega':1,'paz':0.75,'rios':0.75}; W.FW=FW
def chooseY(ref, allow, tmin=1.0):
    pick={}
    for a in W.AG:
        best=None
        for k,T in W.C.items():
            if k[0]!=a or k[-1]=='na' or not allow(a,k): continue
            s=W.wstats(T,ref)
            if not s or s['t']<tmin: continue
            v=s['m']*s['win']
            if best is None or v>best[2]: best=(k,s,v)
        pick[a]=best
    return pick
RULES={
 'veto Ríos, Paz libre': lambda a,k: (a!='rios' or k[-1]=='nub') and (a!='paz' or k[-1]!='nub'),
 'veto Ríos+Paz, Paz sin confl.': lambda a,k: (a not in('paz','rios') or k[-1]=='nub') and (a!='paz' or k[4]==0),
 'veto Ríos, Paz sin confl.': lambda a,k: (a!='rios' or k[-1]=='nub') and (a!='paz' or (k[4]==0 and k[-1]!='nub')),
 'veto Ríos+Paz, tmin 0.5': None,
}
for name,rule in RULES.items():
    if rule is None:
        sel={y:chooseY(ts(y),lambda a,k:(a not in('paz','rios') or k[-1]=='nub'),0.5) for y in W.yrs}
    else:
        sel={y:chooseY(ts(y),rule) for y in W.yrs}
    d=W.desk(sel); print(f'{name:32s}',' '.join(f'{k}={float(v):.3f}' for k,v in d.items())); print('    ',yearly(sel))

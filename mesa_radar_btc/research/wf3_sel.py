import numpy as np, pickle, itertools, engine, datetime
from engine import ts
import wf2_sel as W
W.C=pickle.load(open(engine.D+'wf3_cands.pkl','rb'))
FW={'vega':1,'ortega':1,'paz':0.75,'rios':0.75}; W.FW=FW
def chooseX(ref, obj, tmin, nub):
    pick={}
    for a in W.AG:
        best=None
        for k,T in W.C.items():
            if k[0]!=a or k[-1]=='na': continue
            if a in ('paz','rios') and ((k[-1]=='nub')!=nub): continue
            s=W.wstats(T,ref)
            if not s or s['t']<tmin: continue
            v=obj(s)
            if best is None or v>best[2]: best=(k,s,v)
        pick[a]=best
    return pick
def yearly(sel):
    out=[]
    for y in W.yrs:
        Z=[(x[2],FW[a]) for a,b in sel[y].items() if b for x in W.C[b[0]] if ts(y)<=x[0]<ts(y+1)]
        r=np.array([z[0] for z in Z]); w=np.array([z[0]*z[1] for z in Z]); yl=min(1,(W.END-ts(y))/31557600)
        out.append(f'{y}: {len(r)/yl/52.18:.1f}/sem {np.mean(r>0)*100:.0f}% {r.mean():+.2f} R{w.sum():+.0f}')
    return ' | '.join(out)
for nub in (False,True):
    sel={y:chooseX(ts(y),W.OBJ['m*win'],1.0,nub) for y in W.yrs}
    d=W.desk(sel); print('NUB' if nub else 'v5 ', ' '.join(f'{k}={float(v):.3f}' for k,v in d.items())); print('    ',yearly(sel))
    if nub:
        live=chooseX(W.END+1,W.OBJ['m*win'],1.0,True); print('LIVE',{a:b[0][1:] for a,b in live.items() if b})
        pickle.dump(sel,open(engine.D+'wf3_sel.pkl','wb'))

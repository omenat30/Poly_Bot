import numpy as np, pickle, itertools, engine
from engine import ts, stats
import wf2_sel as W, pm
C=pickle.load(open(engine.D+'wf3_cands.pkl','rb'))
for k,v in pickle.load(open(engine.D+'fund_cands.pkl','rb')).items(): C[('funding',)+k]=v
for k,v in pickle.load(open(engine.D+'collab_cands.pkl','rb')).items():
    if k[0]=='rios': C[k]=v
    else: C[('funding',)+k[1:]]=v
W.C=C; pm.C=C
print('== Ríos con veto, sin funding vs con funding (misma partición)')
for k in [kk for kk in C if kk[0]=='rios' and kk[-1]=='nub' and kk[2] in ('0','B1')]:
    a=stats(C[k],ts(2020),ts(2023)); b=stats(C[k],ts(2023),None); print(' ',k,f'20-22 e={a["exp"]:+.2f} n={a["n"]} | 23-26 e={b["exp"]:+.2f} n={b["n"]}')
def chooseZ(ref, rios_mode, fer_mode):
    pick={}
    for a in ['vega','ortega','paz','rios','funding']:
        best=None
        for k,T in C.items():
            if k[0]!=a or k[-1]=='na': continue
            if a=='paz' and not (k[-1]=='nub' and k[4]==0): continue
            if a=='rios':
                isf='fund' in k
                if rios_mode=='none': continue
                if rios_mode=='nub' and (isf or k[-1]!='nub'): continue
                if rios_mode=='fund' and not isf: continue
            if a=='funding':
                isv=len(k)==7
                if fer_mode=='solo' and isv: continue
                if fer_mode=='vol' and not isv: continue
                if fer_mode=='none': continue
            s=W.wstats(T,ref)
            if not s or s['t']<1.0: continue
            v=s['m']*s['win']
            if best is None or v>best[2]: best=(k,s,v)
        pick[a]=best
    return pick
BASE={'vega':1,'ortega':1,'paz':0.75,'rios':0.75,'funding':0.5}
res={}
for rm,fm in itertools.product(('none','nub','fund'),('solo','vol','both')):
    sel={y:chooseZ(ts(y),rm,fm) for y in W.yrs}; pm.sel=sel
    Z=pm.stream(['vega','ortega','paz','rios','funding'])
    for cap,dd in ((None,None),(2.0,(8,0.5)),(2.5,(8,0.5)),(2.5,(10,0.5)),(3.0,(10,0.5))):
        d=pm.run(Z,base=BASE,cap=cap,ddth=dd); res[(rm,fm,cap,dd)]=(d,sel)
        print(f'rios={rm:4s} ferrer={fm:4s} cap={cap} dd={dd}',' '.join(f'{k}={float(v):.3f}' for k,v in d.items()),flush=True)
pickle.dump(res,open(engine.D+'wf4_res.pkl','wb'))

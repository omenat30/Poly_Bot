from wf_sel import *
import itertools
def choose2(ref, obj, conf_only, tmin, fixedW):
    pick={}
    for a in AG:
        best=None
        for k,T in C.items():
            if k[0]!=a: continue
            if conf_only and a in ('paz','rios') and k[-1]!=1: continue
            s=wstats(T,ref)
            if s and s['t']>=tmin and (best is None or s[obj]>best[1][obj]): best=(k,s)
        pick[a]=best
    W={a:(fixedW[a] if pick[a] else 0) for a in AG}
    return pick,W
FW={'vega':1,'ortega':1,'paz':0.5,'rios':0.5}
for obj,conf,tmin in itertools.product(('Ry','t','m'),(0,1),(1.0,1.5,2.0)):
    S2={}
    for y in range(2020,2027):
        p,W=choose2(ts(y),obj,conf,tmin,FW); S2[y]={a:(p[a][0] if p[a] else None,W[a]) for a in AG}
    d=desk(yrs,lambda y:S2[y])
    print(f'obj={obj:2s} conf={conf} tmin={tmin}', fmt({k:v for k,v in d.items() if k!='Y'}), d['Y'])

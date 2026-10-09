import pickle, json, numpy as np
from engine import *
out=[]
for fam in ['vega','ortega2','rios2','ortega','rios','paz']:
    res=pickle.load(open(D+f'res_{fam}.pkl','rb'))
    rows=[(p,stats(T,*TRAIN),stats(T,*TEST)) for p,T in res]
    best=max(rows,key=lambda r:r[1]['t'])
    out.append(dict(fam=fam,variants=len(rows),posTest=sum(1 for _,a,b in rows if b['exp']>0),posBoth=sum(1 for _,a,b in rows if a['exp']>0 and b['exp']>0),
        medTest=float(np.median([b['exp'] for _,a,b in rows])),
        pick=best[0],train={k:float(best[1][k]) for k in ('n','exp','t','pf')},test={k:float(best[2][k]) for k in ('n','exp','t','pf')}))
for o in out: print(o['fam'],o['variants'],o['posTest'],round(o['medTest'],3),o['pick'],{k:round(v,2) for k,v in o['train'].items()},{k:round(v,2) for k,v in o['test'].items()})
json.dump(out,open(D+'families.json','w'))

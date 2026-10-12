import pickle, sys, numpy as np
from engine import *
def wf(res, y0=2019, y1=2027, start=ts(2017)):
    # walk-forward: each year pick the variant with best t-stat on [start, year) and apply it to that year
    out=[]; picks=[]
    for y in range(y0,y1):
        best=None
        for p,T in res:
            s=stats(T,start,ts(y))
            if s['n']<30: continue
            sc=s['t']
            if best is None or sc>best[0]: best=(sc,p,T)
        if best is None: continue
        picks.append((y,best[1])); out+= [x for x in best[2] if ts(y)<=x[0]<(ts(y+1) if y<2026 else 10**10)]
    return out,picks
for fam in sys.argv[1:]:
    res=pickle.load(open(D+f'res_{fam}.pkl','rb'))
    print('=====',fam)
    rows=[(p,stats(T,*TRAIN),stats(T,*TEST)) for p,T in res]
    rows.sort(key=lambda r:-r[1]['t'])
    pos_both=sum(1 for p,a,b in rows if a['exp']>0 and b['exp']>0)
    print(f'variantes {len(rows)} | positivas en train y test: {pos_both} | positivas en test: {sum(1 for p,a,b in rows if b["exp"]>0)}')
    for p,a,b in rows[:8]: print(p,'\n   TRAIN',fmt(a),'\n   TEST ',fmt(b))
    W,picks=wf(res)
    print('WALK-FORWARD 2019-2026:',fmt(stats(W)),'| desde 2022:',fmt(stats(W,ts(2022))))
    print('  picks',[ (y,p) for y,p in picks][-3:])

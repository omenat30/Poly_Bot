import json, numpy as np, engine, math
from engine import ts
exec(open('funding.py').read().split("if __name__")[0])
MASK=np.load(engine.D+'office_mask2.npy'); Ht=engine.H['t']; END=int(Ht[-1])
def office(T): k=np.searchsorted(Ht,(T-1)//3600*3600); return bool(MASK[min(k,len(Ht)-1)])
X=json.load(open(engine.D+'../multi_trades.json'))
for x in X:
    rf=x['risk']/x['entry']; x['rn']=x['r']-0.0006/rf-(0.0003/rf if x['reason']=='stop' else 0)-x['side']*fr[(ft>x['sigT'])&(ft<=x['exitT'])].sum()/rf; x['office']=office(x['sigT'])
def st(tr,a,b):
    tr=[x for x in tr if a<=x['sigT']<b]; r=np.array([x['rn'] for x in tr]); yrs=(min(b,END)-a)/31557600
    if not len(r): return 'n=0'
    d0=a//86400; v=np.zeros(min(b,END)//86400-d0+1)
    for x in tr: v[min(len(v)-1,int(x['exitT'])//86400-d0)]+=x['rn']
    return f'n/sem={len(r)/yrs/52.18:.2f} win={np.mean(r>0):.3f} R/op={r.mean():+.3f} R/año={r.sum()/yrs:+.1f} Sharpe={v.mean()/v.std()*math.sqrt(365):.2f}'
E=[x for x in X if x['extra'] and x['office']]
for lab,sel in [('extras todas',E),('a favor del Radar',[x for x in E if x['side']==x['radarSide']]),('en contra del Radar',[x for x in E if x['side']==-x['radarSide']])]+[(f'tipo {k}',[x for x in E if x['kind']==k]) for k in ('bo','mr','swp')]:
    print(f'{lab:22s}','18-21',st(sel,ts(2018),ts(2022)),'| 22-26',st(sel,ts(2022),END))
O=[x for x in X if not x['extra'] and x['office']]
print('Radar propias (oficina)','18-21',st(O,ts(2018),ts(2022)),'| 22-26',st(O,ts(2022),END))
d0=ts(2018)//86400; nd=END//86400-d0+1
def ser(tr):
    v=np.zeros(nd)
    for x in tr:
        if x['sigT']>=ts(2018): v[min(nd-1,int(x['exitT'])//86400-d0)]+=x['rn']
    return v
print('corr diaria extras vs Radar', round(float(np.corrcoef(ser(E),ser(O))[0,1]),2))
json.dump([x for x in X if x['extra']],open(engine.D+'mx_extras.json','w'))

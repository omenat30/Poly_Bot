import json, numpy as np, engine, math, io, contextlib, datetime as dt
from engine import ts
exec(open('funding.py').read().split("if __name__")[0])
MASK=np.load(engine.D+'office_mask2.npy'); t=engine.H['t']; END=int(t[-1])
def office_at(T): i=np.searchsorted(t,T//3600*3600); return bool(MASK[min(i,len(t)-1)])
def live_radar(T):
    w=dt.datetime.utcfromtimestamp(T); return w.weekday()<5 and (office_at(T) or 19<=w.hour<=20)
def load(sec):
    out=[]
    for x in json.load(open(engine.D+f'../mtf_{sec}.json')):
        rf=x['risk']/x['entry']; f=fr[(ft>x['sigT'])&(ft<=x['exitT'])].sum()*x['side']
        rm=x['r']-0.0006/rf-(0.0003/rf if x['reason']=='stop' else 0)-f/rf
        out.append(dict(T=int(x['sigT']),T1=int(x['exitT']),s=x['side'],rm=rm,sec=sec,office=office_at(int(x['sigT'])),live=live_radar(int(x['sigT']))))
    return out
TF={s:load(s) for s in (300,900,1800,3600)}
def stats(tr,a,b):
    tr=[x for x in tr if a<=x['T']<b]; r=np.array([x['rm'] for x in tr]); yrs=(min(b,END)-a)/31557600
    return f'n/sem={len(r)/yrs/52.18:.2f} win={np.mean(r>0):.3f} R/op={r.mean():+.3f} R/año={r.sum()/yrs:+.1f} t={r.mean()/r.std()*math.sqrt(len(r)):.1f}'
for s,tr in TF.items():
    for per,(a,b) in [('17-21',(ts(2017),ts(2022))),('22-26',(ts(2022),END))]:
        print(f'{s//60:3d}m {per} oficina', stats([x for x in tr if x['office']],a,b))
# correlación diaria (oficina) con la de 15 m, 2018-26
d0=ts(2018)//86400; nd=END//86400-d0+1
def ser(tr):
    v=np.zeros(nd)
    for x in tr:
        if x['office'] and x['T']>=ts(2018): v[min(nd-1,x['T1']//86400-d0)]+=x['rm']
    return v
S={s:ser(tr) for s,tr in TF.items()}
print('corr diaria con 15m:',{s//60:round(float(np.corrcoef(S[900],S[s])[0,1]),2) for s in TF})
import pickle; pickle.dump(TF,open(engine.D+'mtf.pkl','wb'))

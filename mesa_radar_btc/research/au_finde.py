# Auditoría v12 · H3: el Radar no opera los fines de semana (escáner L-V). Oportunidades de su modelo en sábado y domingo, 7-21 Madrid.
# 2 variantes cerradas: (a) señales del modelo en fin de semana; (b) (a) + extras a favor con ru<0,8 en fin de semana.
import json, numpy as np, engine, datetime as dt
from engine import ts
exec(open('funding.py').read().split("if __name__")[0])
from zoneinfo import ZoneInfo; tz=ZoneInfo('Europe/Madrid')
X=json.load(open(engine.D+'../multi_all.json')); END=int(engine.H['t'][-1])
def wk(T): d=dt.datetime.fromtimestamp(T-1,tz); return d.weekday()>=5 and 7<=d.hour<21
C={'a':[], 'b':[]}
for x in X:
    if not wk(x['sigT']): continue
    rf=x['risk']/x['entry']; rn=x['r']-0.0006/rf-(0.0003/rf if x['reason']=='stop' else 0)-x['side']*fr[(ft>x['sigT'])&(ft<=x['exitT'])].sum()/rf
    c=dict(t0=int(x['sigT']),t1=int(x['exitT']),r=round(float(rn),4),side=x['side'],risk_pct=rf,src='finde',w=1.0)
    if not x['extra']: C['a'].append(c); C['b'].append(c)
    elif x['side']==x['radarSide'] and x['ru'] is not None and x['ru']<0.8: C['b'].append(c)
for k,L in C.items():
    L=[c for c in L if c['t0']>=ts(2018)]; json.dump(L,open(f'/tmp/au_finde_{k}.json','w'))
    for nm,(a,b) in (('18-21',(ts(2018),ts(2022))),('22-26',(ts(2022),END))):
        r=np.array([c['r'] for c in L if a<=c['t0']<b]); yrs=(b-a)/31557600
        print(k,nm,f'n/sem {len(r)/yrs/52.18:.2f} win {np.mean(r>0)*100:.1f}% R/op {r.mean():+.3f} R/año {r.sum()/yrs:+.1f}')

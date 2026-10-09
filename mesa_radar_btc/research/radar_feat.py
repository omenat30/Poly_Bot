import json, numpy as np, pickle, engine
from engine import ts
RT=json.load(open(engine.D+'../panel_trades.json'))
rt=np.array([x['sigT'] for x in RT]); rs=np.array([x['side'] for x in RT]); rk=[x['kind'] for x in RT]
def radar_state(t, H):
    # última señal del Radar en las H horas anteriores a t (sin mirar el futuro): +1/-1/0
    j=np.searchsorted(rt, t, side='right')-1
    if j<0 or t-rt[j]>H*3600: return 0
    return int(rs[j])
def radar_net(t,H):
    a=np.searchsorted(rt,t-H*3600,side='left'); b=np.searchsorted(rt,t,side='right'); return int(np.sign(rs[a:b].sum()))
C=pickle.load(open(engine.D+'wf_cands.pkl','rb'))
K={'vega':('vega',50,2.5,1,'B1'),'ortega':('ortega',3,2,'B1'),'paz':('paz',40,'0',1),'rios':('rios',1.0,'0',0)}
if __name__=='__main__':
  for H in (12,24,72):
    print('=== H',H)
    for a,k in K.items():
        T=C[k]
        for per,(lo,hi) in (('17-20',(ts(2017),ts(2021))),('21-26',(ts(2021),1e11))):
            out=[]
            for lab in ('a favor','neutral','en contra'):
                r=np.array([x[2] for x in T if lo<=x[0]<hi and {'a favor':1,'neutral':0,'en contra':-1}[lab]==radar_net(x[0],H)*x[1]])
                out.append(f'{lab}: n={len(r):3d} w={np.mean(r>0)*100 if len(r) else 0:3.0f}% e={r.mean() if len(r) else 0:+.2f}')
            print(f'{a:6s} {per}', ' | '.join(out))

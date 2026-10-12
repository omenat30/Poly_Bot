import json, numpy as np, pickle, engine
from engine import H, DD, sma, ts
dc=DD['c']; dt=DD['t']
S20=sma(dc,20); S50=sma(dc,50); S140=sma(dc,140); S200=sma(dc,200)
hi365=np.array([dc[max(0,i-364):i+1].max() for i in range(len(dc))])
lo365=np.array([dc[max(0,i-364):i+1].min() for i in range(len(dc))])
sl200=np.r_[np.zeros(20)*np.nan, S200[20:]/S200[:-20]-1]
m90=np.r_[np.full(90,np.nan), dc[90:]/dc[:-90]-1]
def day_idx(t): return np.searchsorted(dt,t,side='right')-2
def F(t):
    d=day_idx(t); c=dc[d]
    return dict(b200=c<S200[d], dcross=S50[d]<S200[d], sl200neg=sl200[d]<0, w20=c<S140[d], dd15=c<0.85*hi365[d], dd30=c<0.7*hi365[d],
                top=(c>0.85*hi365[d]) and (S20[d]<S50[d]),  # cerca de máximos pero el corto plazo gira
                m90neg=m90[d]<0, early=(c<S200[d]) and not (S50[d]<S200[d]))  # rotura de la 200 antes del cruce de la muerte
FEATS=['b200','dcross','sl200neg','w20','dd15','dd30','top','m90neg','early']
if __name__=='__main__':
    C=pickle.load(open(engine.D+'wf2_cands.pkl','rb'))
    K={'vega':('vega',50,2,'B1',None),'ortega':('ortega',5,2,'B1',None),'paz':('paz',40,2,'0',1,None),'rios':('rios',4,'0',None)}
    for a,k in K.items():
        T=C[k]; FF=[F(x[0]) for x in T]
        for s in (1,-1):
            print(f'== {a} {"L" if s==1 else "S"}')
            for f in FEATS:
                line=[]
                for lab,(lo,hi) in (('17-19',(ts(2017),ts(2020))),('20-26',(ts(2020),1e11))):
                    for v in (True,False):
                        r=np.array([x[2] for x,ff in zip(T,FF) if x[1]==s and lo<=x[0]<hi and ff[f]==v])
                        line.append(f'{lab} {"S" if v else "N"} n={len(r):3d} w={np.mean(r>0)*100 if len(r) else 0:3.0f}% e={r.mean() if len(r) else 0:+.2f}')
                print(f'  {f:8s}', ' | '.join(line))

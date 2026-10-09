# v6: Nubarrones veta los cortos de Paz y Ríos en bajista maduro (SMA50 < SMA200 diaria, cruce de la muerte)
import numpy as np, itertools, pickle, engine, strategies as S, mgmt, paz3 as PZ
from engine import H, DD, sma
import wf2
dc=DD['c']; dt=DD['t']; S50=sma(dc,50); S200=sma(dc,200)
def mature(tt):
    d=np.searchsorted(dt,tt,side='right')-2
    return S50[d]<S200[d]
def nubf(base):
    def f(tt,s):
        if s==-1 and mature(tt): return False
        return base(tt,s) if base else True
    return f
C=pickle.load(open(engine.D+'wf2_cands.pkl','rb'))
B1=dict(be=1,beoff=0.3)
G=[('0',{},None),('B1',B1,None)]+[(f'T{T}',{},T) for T in (1,1.5,2,3)]+[(f'T{T}b',B1,T) for T in (2,3)]
for rl,k,(gn,g,T),cf in itertools.product((40,45),(1,1.5,2),G,(0,1)):
    C[('paz',rl,k,gn,cf,'nub')]=wf2.run(PZ.paz3,g,T,nubf(wf2.f if cf else None),None,rsi_lo=rl,reg=50,shorts=1,maxh=96,tk=5,en=50,k=k)
print('paz',flush=True)
for k,(gn,g,T) in itertools.product((2,3,4),G):
    C[('rios',k,gn,'nub')]=wf2.run(S.rios2,g,T,nubf(None),None,q=0.2,vm=1.0,k=k,reg=50,shorts=1)
pickle.dump(C,open(engine.D+'wf3_cands.pkl','wb')); print('done',len(C))

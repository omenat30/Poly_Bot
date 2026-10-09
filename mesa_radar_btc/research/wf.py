# v4: horario L-V 7-21, selección walk-forward con peso por recencia (vida media 2 años)
import numpy as np, itertools, pickle, sys, engine, strategies as S, mgmt, paz3 as PZ
from engine import H, ts
M2=np.load(engine.D+'office_mask2.npy'); t=H['t']; END=int(t[-1])
def mk(cfg, filt=None):
    def sim(sigs, trail=None, exit_mask=None):
        if filt: sigs=[s for s in sigs if filt(t[s[0]]+3600, s[1])]
        return mgmt.sim_m(sigs, trail, exit_mask, mask=M2, **cfg)
    return sim
def run(fn, cfg, filt=None, **kw):
    S.sim=mk(cfg,filt); PZ.off=S.sim; PZ.M=M2
    return fn(**kw)
O1=dict(tp=1.5,f=0.33,be=0.75,beoff=0.3); P4=dict(be=1.5,beoff=0.3); R3=dict(be=1,beoff=0.3); B1=dict(be=1,beoff=0.3)
C={}
# Vega
for n,k,sh,mg in itertools.product((10,20,50),(2.5,3.5,5),(0,1),('0','O1','B1')):
    C[('vega',n,k,sh,mg)]=run(S.vega,{'0':{},'O1':O1,'B1':B1}[mg],n=n,k=k,shorts=sh,mom=1)
print('vega ok',flush=True)
for N,k,mg in itertools.product((3,5,10,20),(1.5,2,3),('0','O1','B1')):
    C[('ortega',N,k,mg)]=run(S.ortega2,{'0':{},'O1':O1,'B1':B1}[mg],N=N,k=k,shorts=1,reg=50)
print('ortega ok',flush=True)
# confluencia: Vega y Ortega de v3 (sombra)
iv=[(x[0],x[4],x[1]) for x in C[('vega',20,3.5,0,'0')]+C[('ortega',5,2,'O1')]]
def f(tt,s): return any(a<=tt<b and q==s for a,b,q in iv)
for rl,mg,cf in itertools.product((40,45),('0','P4','O1'),(0,1)):
    C[('paz',rl,mg,cf)]=run(PZ.paz3,{'0':{},'P4':P4,'O1':O1}[mg],f if cf else None,rsi_lo=rl,reg=50,shorts=1,maxh=96,tk=5,en=50)
print('paz ok',flush=True)
for vm,mg,cf in itertools.product((1.0,1.5),('0','R3','O1'),(0,1)):
    C[('rios',vm,mg,cf)]=run(S.rios2,{'0':{},'R3':R3,'O1':O1}[mg],f if cf else None,q=0.2,vm=vm,k=4,reg=50,shorts=1)
pickle.dump(C,open(engine.D+'wf_cands.pkl','wb')); print('done',len(C))

# v5: menú con objetivos fijos (stops y profits más cortos) y el Radar BTC como filtro opcional (nunca como disparador)
import numpy as np, itertools, pickle, engine, strategies as S, mgmt, paz3 as PZ
from engine import H
from radar_feat import radar_net
M2=np.load(engine.D+'office_mask2.npy'); t=H['t']; c=H['c']
def mk(cfg, T=None, filt=None, rad=None):
    def sim(sigs, trail=None, exit_mask=None):
        out=[]
        for (i,side,stop,tgt,maxh) in sigs:
            tt=t[i]+3600
            if filt and not filt(tt,side): continue
            if rad=='na' and radar_net(tt,24)==-side: continue
            if rad=='fav' and radar_net(tt,72)!=side: continue
            if T: tgt=c[i]+side*T*abs(c[i]-stop)
            out.append((i,side,stop,tgt,maxh))
        return mgmt.sim_m(out, trail, exit_mask, mask=M2, **cfg)
    return sim
def run(fn, cfg, T=None, filt=None, rad=None, **kw):
    S.sim=mk(cfg,T,filt,rad); PZ.off=S.sim; PZ.M=M2
    return fn(**kw)
B1=dict(be=1,beoff=0.3)
old=pickle.load(open(engine.D+'wf_cands.pkl','rb'))
iv=[(x[0],x[4],x[1]) for x in old[('vega',20,3.5,0,'0')]+old[('ortega',5,2,'O1')]]
def f(tt,s): return any(a<=tt<b and q==s for a,b,q in iv)
if __name__=='__main__':
    C={}
    G=[('0',{},None),('B1',B1,None)]+[(f'T{T}',{},T) for T in (1,1.5,2,3)]+[(f'T{T}b',B1,T) for T in (2,3)]
    for rad in (None,'na'):
        for n,k,(gn,g,T) in itertools.product((20,50),(1.5,2,2.5),G):
            C[('vega',n,k,gn,rad)]=run(S.vega,g,T,None,rad,n=n,k=k,shorts=1,mom=1)
        print('vega',rad,flush=True)
        for N,k,(gn,g,T) in itertools.product((3,5),(1,1.5,2),G):
            C[('ortega',N,k,gn,rad)]=run(S.ortega2,g,T,None,rad,N=N,k=k,shorts=1,reg=50)
        print('ortega',rad,flush=True)
        for rl,k,(gn,g,T),cf in itertools.product((40,45),(1,1.5,2),G,(0,1)):
            C[('paz',rl,k,gn,cf,rad)]=run(PZ.paz3,g,T,f if cf else None,rad,rsi_lo=rl,reg=50,shorts=1,maxh=96,tk=5,en=50,k=k)
        print('paz',rad,flush=True)
        for k,(gn,g,T) in itertools.product((2,3,4),G):
            C[('rios',k,gn,rad)]=run(S.rios2,g,T,None,rad,q=0.2,vm=1.0,k=k,reg=50,shorts=1)
        print('rios',rad,flush=True)
    pickle.dump(C,open(engine.D+'wf2_cands.pkl','wb')); print('done',len(C))

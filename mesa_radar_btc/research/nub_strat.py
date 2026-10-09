# Nubarrones: operativa propia de mercado bajista (solo cortos, solo en fases de giro)
import numpy as np, itertools, pickle, engine, strategies as S, mgmt
from engine import H, DD, sma, atr, ts, stats, rollmin, rollmax
import wf2
h,l,o,c,t=H['h'],H['l'],H['o'],H['c'],H['t']
dc=DD['c']; dt=DD['t']; S20=sma(dc,20); S50=sma(dc,50); S200=sma(dc,200)
hi365=np.array([dc[max(0,i-364):i+1].max() for i in range(len(dc))])
hd=np.searchsorted(dt,t,side='right')-2
def phase(i):
    d=hd[i]
    if d<200: return 'x'
    cl=dc[d]
    if S50[d]<S200[d]: return 'mature'
    if cl<S200[d]: return 'early'
    if cl>0.85*hi365[d] and S20[d]<S50[d]: return 'top'
    if cl<S50[d]: return 'pull'
    return 'bull'
PH=np.array([phase(i) for i in range(len(t))])
A4=atr(H,168)*np.sqrt(24); HOUR=(t//3600)%24
def nub(N=3, k=2.0, phases=('early','top'), every=4):
    lo=rollmin(l,N*24); plo=np.r_[np.nan,lo[:-1]]
    sigs=[]
    for i in np.flatnonzero(((HOUR%every)==(every-1)) & (c<plo)):
        if PH[i] not in phases: continue
        sigs.append((i,-1,c[i]+k*A4[i],np.nan,24*30))
    return S.sim(sigs, trail=(k,A4))
if __name__=='__main__':
    res={}
    for N,k,ph,(gn,g,T) in itertools.product((2,3,5),(1.5,2,3),(('early',),('early','top'),('early','top','pull')),[('0',{},None),('B1',dict(be=1,beoff=0.3),None),('T2',{},2),('T3',{},3)]):
        S.sim=wf2.mk(g,T); Tr=nub(N=N,k=k,phases=ph); res[(N,k,ph,gn)]=Tr
        a=stats(Tr,ts(2017),ts(2020)); b=stats(Tr,ts(2020),None)
        print(f'N={N} k={k} {"+".join(ph):16s} {gn:3s} | 17-19 n={a["n"]:3d} w={a["win"]*100:3.0f}% e={a["exp"]:+.2f} | 20-26 n={b["n"]:3d} w={b["win"]*100:3.0f}% e={b["exp"]:+.2f}',flush=True)
    pickle.dump(res,open(engine.D+'nub_cands.pkl','wb'))

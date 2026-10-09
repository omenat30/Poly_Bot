# Experto en funding: squeeze. La multitud paga caro en un lado y el precio rompe en contra -> operar a favor de la rotura.
import numpy as np, itertools, pickle, engine, strategies as S
from engine import H, ts, stats, atr, rollmax, rollmin
import wf2
Z=np.load(engine.D+'funding_h.npz'); F3=Z['F3']; FH=Z['FH']
h,l,c,t=H['h'],H['l'],H['c'],H['t']; HOUR=(t//3600)%24; A4=atr(H,168)*np.sqrt(24)
from engine import sma, DD
def squeeze(lo=0.0, hi=0.0003, N=24, k=2.0, every=4, mode='squeeze', maxh=24*10):
    hh=np.r_[np.nan,rollmax(h,N)[:-1]]; ll=np.r_[np.nan,rollmin(l,N)[:-1]]
    sigs=[]
    dec=(HOUR%every)==(every-1)
    for i in np.flatnonzero(dec & ~np.isnan(F3)):
        f=F3[i]
        if f<lo and c[i]>hh[i]: sigs.append((i,1,c[i]-k*A4[i],np.nan,maxh))      # cortos pagando y el precio rompe arriba
        if f>hi and c[i]<ll[i]: sigs.append((i,-1,c[i]+k*A4[i],np.nan,maxh))     # largos pagando caro y el precio rompe abajo
    sigs.sort(); return S.sim(sigs, trail=(k,A4))
if __name__=='__main__':
    res={}
    G=[('0',{},None),('B1',dict(be=1,beoff=0.3),None),('T2',{},2),('T3b',dict(be=1,beoff=0.3),3)]
    for lo,hi,N,k,(gn,g,T) in itertools.product((0.0,-0.00005),(0.0002,0.0003,0.0005),(12,24,48),(1.5,2,3),G):
        S.sim=wf2.mk(g,T); Tr=squeeze(lo,hi,N,k); res[(lo,hi,N,k,gn)]=Tr
        a=stats(Tr,ts(2020),ts(2023)); b=stats(Tr,ts(2023),None)
        print(f'lo={lo*100:+.3f}% hi={hi*100:.2f}% N={N:2d} k={k} {gn:3s} | 20-22 n={a["n"]:3d} w={a["win"]*100:3.0f}% e={a["exp"]:+.2f} | 23-26 n={b["n"]:3d} w={b["win"]*100:3.0f}% e={b["exp"]:+.2f}',flush=True)
    pickle.dump(res,open(engine.D+'fund_cands.pkl','wb'))

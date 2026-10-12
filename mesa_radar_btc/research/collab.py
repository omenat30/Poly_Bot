# Ríos (liquidez: compresión + volumen) y Ferrer (funding) trabajando juntos
import numpy as np, itertools, pickle, engine, strategies as S
from engine import H, ts, stats, sma, atr, rollmax, rollmin
import wf2, wf3
Z=np.load(engine.D+'funding_h.npz'); F3=Z['F3']
t=H['t']; c=H['c']; h=H['h']; l=H['l']; v=H['v']; HOUR=(t//3600)%24; A4=atr(H,168)*np.sqrt(24)
idx={int(x):i for i,x in enumerate(t)}
def fund_ok(mode, thr):
    # mode 'notcrowd': la multitud NO está cargada en mi lado (F3*side < thr); 'against': la multitud está en contra (F3*side < -thr)
    def f(tt,s):
        i=idx.get(int(tt)-3600); fv=F3[i] if i is not None else np.nan
        if fv!=fv: return True        # sin datos de funding (antes de 2020): no filtra
        return fv*s < (thr if mode=='notcrowd' else -thr)
    return f
def ferrer_vol(lo, hi, N, k, vm, every=4, maxh=240):
    hh=np.r_[np.nan,rollmax(h,N)[:-1]]; ll=np.r_[np.nan,rollmin(l,N)[:-1]]; vb=sma(v,168)
    sigs=[]
    for i in np.flatnonzero(((HOUR%every)==(every-1)) & ~np.isnan(F3)):
        if v[i] < vm*vb[i]: continue
        if F3[i]<lo and c[i]>hh[i]: sigs.append((i,1,c[i]-k*A4[i],np.nan,maxh))
        if F3[i]>hi and c[i]<ll[i]: sigs.append((i,-1,c[i]+k*A4[i],np.nan,maxh))
    sigs.sort(); return S.sim(sigs, trail=(k,A4))
if __name__=='__main__':
    C={}
    B1=dict(be=1,beoff=0.3)
    G=[('0',{},None),('B1',B1,None),('T2',{},2),('T3b',B1,3)]
    for k,(gn,g,T),mode,thr in itertools.product((2,3,4),G,('notcrowd','against'),(0.0,0.0001,0.0002)):
        if mode=='against' and thr>0.0001: continue
        f=wf3.nubf(fund_ok(mode,thr))
        Tr=wf2.run(S.rios2,g,T,f,None,q=0.2,vm=1.0,k=k,reg=50,shorts=1); C[('rios',k,gn,'fund',mode,thr)]=Tr
        a=stats(Tr,ts(2020),ts(2023)); b=stats(Tr,ts(2023),None); o=stats(C.get(('rios',k,gn,'nub')) or [],0,None) if False else None
        print(f'RIOS k={k} {gn:3s} {mode:8s} thr={thr*100:.2f}% | 20-22 n={a["n"]:3d} w={a["win"]*100:3.0f}% e={a["exp"]:+.2f} | 23-26 n={b["n"]:3d} w={b["win"]*100:3.0f}% e={b["exp"]:+.2f}',flush=True)
    for lo,hi,N,k,vm,(gn,g,T) in itertools.product((0.0,-0.00005),(0.0001,0.0002,0.0003),(12,24),(1.5,2),(1.0,1.5,2.0),G):
        S.sim=wf2.mk(g,T); Tr=ferrer_vol(lo,hi,N,k,vm); C[('funding_v',lo,hi,N,k,vm,gn)]=Tr
        a=stats(Tr,ts(2020),ts(2023)); b=stats(Tr,ts(2023),None)
        print(f'FERRER+VOL lo={lo*100:+.3f} hi={hi*100:.2f} N={N} k={k} vm={vm} {gn:3s} | 20-22 n={a["n"]:3d} w={a["win"]*100:3.0f}% e={a["exp"]:+.2f} | 23-26 n={b["n"]:3d} w={b["win"]*100:3.0f}% e={b["exp"]:+.2f}',flush=True)
    pickle.dump(C,open(engine.D+'collab_cands.pkl','wb'))

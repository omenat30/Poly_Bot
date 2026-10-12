import numpy as np, engine, strategies as S
from engine import *
M=np.load(D+'office_mask.npy')
def off(sigs, trail=None, exit_mask=None): return engine.sim_office(sigs, trail, exit_mask, M)
h,l,o,c,v,t=H['h'],H['l'],H['o'],H['c'],H['v'],H['t']
A1=S.A1; regime=S.regime; HOUR=S.HOUR
END=int(t[-1]); TEY=(END-TEST[0])/31557600
# --- Paz: pullback intradía a favor de la tendencia diaria ---
def paz2(n=20, rsi_lo=35, reg=50, k=2.0, rr=2.0, shorts=1, maxh=48, en=20):
    E=ema(c,en)
    d=np.diff(c,prepend=c[0]); up=ema(np.maximum(d,0),14); dn=ema(np.maximum(-d,0),14); rsi=100-100/(1+up/np.maximum(dn,1e-9))
    R=regime(reg); R2=regime(n) if n else R
    lowRSI=np.r_[np.zeros(6,bool), np.array([rsi[i-6:i].min()<rsi_lo for i in range(6,len(c))])]
    hiRSI=np.r_[np.zeros(6,bool), np.array([rsi[i-6:i].max()>100-rsi_lo for i in range(6,len(c))])]
    cu=(c>E)&(np.r_[c[0],c[:-1]]<=np.r_[E[0],E[:-1]]); cd=(c<E)&(np.r_[c[0],c[:-1]]>=np.r_[E[0],E[:-1]])
    sigs=[]
    for i in np.flatnonzero(cu&lowRSI&(R==1)&(R2==1)&M):
        sw=l[max(0,i-6):i+1].min(); stop=min(sw, c[i]-0.5*A1[i]) - 0.2*A1[i]
        if (c[i]-stop)>k*A1[i]: stop=c[i]-k*A1[i]
        sigs.append((i,1,stop,c[i]+rr*(c[i]-stop) if rr else np.nan,maxh))
    if shorts:
      for i in np.flatnonzero(cd&hiRSI&(R==-1)&(R2==-1)&M):
        sw=h[max(0,i-6):i+1].max(); stop=max(sw, c[i]+0.5*A1[i]) + 0.2*A1[i]
        if (stop-c[i])>k*A1[i]: stop=c[i]+k*A1[i]
        sigs.append((i,-1,stop,c[i]-rr*(stop-c[i]) if rr else np.nan,maxh))
    sigs.sort(); return off(sigs)
# --- Calvo: impulso fuerte (movimiento brusco) a favor -> continuación ---
def calvo(z=2.5, kk=3, reg=50, rr=2.0, maxh=24, mode='cont'):
    r1=np.r_[0,np.diff(np.log(c))]; sd=np.sqrt(sma(r1**2,720))*np.sqrt(kk)
    rk=np.full(len(c),np.nan); rk[kk:]=np.log(c[kk:]/c[:-kk])
    R=regime(reg) if reg else np.zeros(len(c))
    sigs=[]
    for i in np.flatnonzero((np.abs(rk)>z*sd)&M):
        side=int(np.sign(rk[i])) * (1 if mode=='cont' else -1)
        if reg and R[i]!=side: continue
        lo_=l[i-kk+1:i+1].min(); hi_=h[i-kk+1:i+1].max(); mid=(lo_+hi_)/2
        stop= mid if mode=='cont' else (lo_-0.5*A1[i] if side==1 else hi_+0.5*A1[i])
        if (c[i]-stop)*side<=0: continue
        sigs.append((i,side,stop,c[i]+side*rr*abs(c[i]-stop) if rr else np.nan,maxh))
    sigs.sort(); return off(sigs)
def rep(name,T):
    a=stats(T,*TRAIN); b=stats(T,*TEST)
    print(f'{name:44s} TR n/y={a["n"]/5:5.1f} e={a["exp"]:+.3f} t={a["t"]:+.2f} | TE n/y={b["n"]/TEY:5.1f} e={b["exp"]:+.3f} t={b["t"]:+.2f} w={b["win"]*100:.0f}%',flush=True)
    return a,b
if __name__=='__main__':
  import sys
  if sys.argv[1]=='paz':
    for n in (0,20):
     for rl in (30,40):
      for rr in (1.5,2.5,0):
       for sh in (0,1):
        for en in (20,50):
         rep(f'paz2 n={n} rl={rl} rr={rr} sh={sh} en={en}',paz2(n=n,rsi_lo=rl,rr=rr,shorts=sh,en=en))
  else:
    for mode in ('cont','fade'):
     for z in (2,2.5,3):
      for kk in (1,3,6):
       for reg in (0,50):
        for rr in (1.5,2.5):
         rep(f'calvo {mode} z={z} k={kk} reg={reg} rr={rr}',calvo(z=z,kk=kk,reg=reg,rr=rr,mode=mode))

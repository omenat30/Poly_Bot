from fam2 import *
def paz3(rsi_lo=40, reg=50, n=0, k=2.0, shorts=0, maxh=48, en=20, tk=0, lb=6):
    E=ema(c,en)
    d=np.diff(c,prepend=c[0]); up=ema(np.maximum(d,0),14); dn=ema(np.maximum(-d,0),14); rsi=100-100/(1+up/np.maximum(dn,1e-9))
    from numpy.lib.stride_tricks import sliding_window_view as sw
    mn=np.full(len(c),100.); mx=np.zeros(len(c)); mn[lb:]=sw(rsi,lb)[:-1].min(1); mx[lb:]=sw(rsi,lb)[:-1].max(1)
    R=regime(reg); R2=regime(n) if n else R
    pc=np.r_[c[0],c[:-1]]; pE=np.r_[E[0],E[:-1]]
    cu=(c>E)&(pc<=pE); cd=(c<E)&(pc>=pE)
    sigs=[]
    for i in np.flatnonzero(cu&(mn<rsi_lo)&(R==1)&(R2==1)&M):
        sw_=l[max(0,i-lb):i+1].min(); stop=min(sw_, c[i]-0.5*A1[i]) - 0.2*A1[i]
        if (c[i]-stop)>k*A1[i]: stop=c[i]-k*A1[i]
        sigs.append((i,1,stop,np.nan,maxh))
    if shorts:
      for i in np.flatnonzero(cd&(mx>100-rsi_lo)&(R==-1)&(R2==-1)&M):
        sw_=h[max(0,i-lb):i+1].max(); stop=max(sw_, c[i]+0.5*A1[i]) + 0.2*A1[i]
        if (stop-c[i])>k*A1[i]: stop=c[i]+k*A1[i]
        sigs.append((i,-1,stop,np.nan,maxh))
    sigs.sort(); return off(sigs, trail=(tk,A1) if tk else None)
if __name__=='__main__':
  res=[]
  for rl in (35,40,45):
   for reg in (20,50):
    for sh in (0,1):
     for maxh in (24,48,96):
      for tk in (0,3,5):
       for en in (20,50):
        a,b=rep(f'paz3 rl={rl} reg={reg} sh={sh} mh={maxh} tk={tk} en={en}',paz3(rsi_lo=rl,reg=reg,shorts=sh,maxh=maxh,tk=tk,en=en)); res.append((a,b))
  print('frac TE>0', np.mean([b['exp']>0 for a,b in res]), 'frac TR>0',np.mean([a['exp']>0 for a,b in res]))

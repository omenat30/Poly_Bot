import numpy as np, itertools
from engine import *
h,l,o,c,v,t=H['h'],H['l'],H['o'],H['c'],H['v'],H['t']
A1=atr(H,24)
# daily regime arrays mapped to hours (value known at the close of previous day)
dc=DD['c']; dt=DD['t']
hd=np.searchsorted(dt, t, side='right')-2   # last fully closed day before this hour
def daily_to_h(x):
    out=np.full(len(t),np.nan); ok=hd>=0; out[ok]=x[hd[ok]]; return out
SMA={n:daily_to_h(sma(dc,n)) for n in (20,50,100,200)}
DCL=daily_to_h(dc)
def regime(n):  # +1 above SMA n, -1 below
    return np.where(DCL>SMA[n],1,np.where(DCL<SMA[n],-1,0))

# ---------- Ortega: barrido de liquidez y recuperación (1H) ----------
def ortega(L=48, rr=2.0, reg=0, buf=0.25, maxh=48):
    hi=rollmax(h,L); lo=rollmin(l,L)
    phi=np.r_[np.nan,hi[:-1]]; plo=np.r_[np.nan,lo[:-1]]   # pool before this bar
    R=regime(reg) if reg else None
    sigs=[]
    for i in np.flatnonzero((h>phi)&(c<phi)):
        if R is not None and R[i]!=-1: continue
        stop=h[i]+buf*A1[i]; e=c[i]; sigs.append((i,-1,stop,e-rr*(stop-e),maxh))
    for i in np.flatnonzero((l<plo)&(c>plo)):
        if R is not None and R[i]!=1: continue
        stop=l[i]-buf*A1[i]; e=c[i]; sigs.append((i,1,stop,e+rr*(e-stop),maxh))
    sigs.sort(); return sim(sigs)
G_ortega=[dict(L=L,rr=rr,reg=reg) for L in (24,48,96) for rr in (1.5,2,3) for reg in (0,50,200)]

# ---------- Ríos: cascadas / capitulación (proxy sin datos de liquidaciones) ----------
def rios(k=6, z=3.0, vm=2.0, rr=1.5, reg=0, maxh=48):
    ret=np.full(len(c),np.nan); ret[k:]=np.log(c[k:]/c[:-k])
    # desviación de retornos de k horas en los 30 días anteriores
    r1=np.r_[0,np.diff(np.log(c))]; sd1=np.sqrt(sma(r1**2,720))*np.sqrt(k)
    vk=sma(v,k); vbase=sma(v,720)
    R=regime(reg) if reg else None
    sigs=[]
    down=np.flatnonzero((ret<-z*sd1)&(vk>vm*vbase))
    up=np.flatnonzero((ret>z*sd1)&(vk>vm*vbase))
    for i in down:
        if R is not None and R[i]!=1: continue
        stop=l[max(0,i-k+1):i+1].min()-0.5*A1[i]; e=c[i]
        sigs.append((i,1,stop,e+rr*(e-stop),maxh))
    for i in up:
        if R is not None and R[i]!=-1: continue
        stop=h[max(0,i-k+1):i+1].max()+0.5*A1[i]; e=c[i]
        sigs.append((i,-1,stop,e-rr*(stop-e),maxh))
    sigs.sort(); return sim(sigs)
G_rios=[dict(k=k,z=z,vm=vm,rr=rr,reg=reg) for k in (3,6,12) for z in (2.5,3,3.5) for vm in (1.5,2.5) for rr in (1.5,2) for reg in (0,50)]

# ---------- Paz: sesiones — ruptura del rango asiático ----------
HOUR=(t//3600)%24
def paz(end=8, rr=1.5, reg=0, cut=20, stopmode='opp'):
    sigs=[]; R=regime(reg) if reg else None
    day=t//86400
    starts=np.flatnonzero(HOUR==0)
    for s in starts:
        if s+end>=len(t) or day[s+end-1]!=day[s]: continue
        rhi=h[s:s+end].max(); rlo=l[s:s+end].min(); mid=(rhi+rlo)/2
        for j in range(s+end, min(s+cut, len(t))):
            side=1 if c[j]>rhi else -1 if c[j]<rlo else 0
            if not side: continue
            if R is not None and R[j]!=side: break
            e=c[j]; stop= (rlo if side==1 else rhi) if stopmode=='opp' else mid
            if (e-stop)*side<=0 or (e-stop)*side/e>0.05: break
            sigs.append((j,side,stop,e+side*rr*abs(e-stop),(s+24)-j)); break
    return sim(sigs)
G_paz=[dict(end=e,rr=rr,reg=reg,stopmode=sm) for e in (6,8) for rr in (1,1.5,2) for reg in (0,50,200) for sm in ('opp','mid')]

# ---------- Vega: régimen (momentum de series temporales, diario) ----------
def vega(n=50, k=3.0, shorts=0, mom=0):
    sig=[]; Ad=atr(DD,14); S=sma(dc,n)
    m=np.full(len(dc),np.nan); m[n:]=dc[n:]/dc[:-n]-1
    st=np.where(dc>S,1,np.where(dc<S,-1,0))
    if mom: st=np.where((st==1)&(m>0),1,np.where((st==-1)&(m<0),-1,0))
    if not shorts: st=np.where(st==1,1,0)
    # exit masks on hours: regime flips (evaluated daily close)
    exitL=np.zeros(len(t),bool); exitS=np.zeros(len(t),bool)
    stH=daily_to_h(st.astype(float))
    # exit at first hour of a day whose previous daily close is not in regime
    newday=np.r_[True,np.diff(hd)!=0]
    exitL[newday & (stH!=1)]=True; exitS[newday & (stH!=-1)]=True
    AdH=daily_to_h(Ad)
    for di in range(1,len(dc)):
        if st[di]!=0 and st[di]!=st[di-1] and S[di]==S[di]:
            hi_=d2h_close(di)
            if hi_>=len(t)-1: continue
            side=int(st[di]); e=o[hi_+1] if hi_+1<len(t) else c[hi_]
            stop=e-side*k*Ad[di]
            sig.append((hi_,side,stop,np.nan,24*400))
    return sim(sig, trail=(k,AdH), exit_mask={1:exitL,-1:exitS})
G_vega=[dict(n=n,k=k,shorts=s,mom=m) for n in (20,50,100,200) for k in (2.5,3.5,5) for s in (0,1) for m in (0,1)]
FAM={'ortega':(ortega,G_ortega),'rios':(rios,G_rios),'paz':(paz,G_paz),'vega':(vega,G_vega)}

# ---------- Ortega 2: ruptura de liquidez (máximo/mínimo de N días), decisión cada 4 h ----------
def ortega2(N=20, k=3.0, shorts=1, reg=0, every=4):
    W=N*24; hi=rollmax(h,W); lo=rollmin(l,W); phi=np.r_[np.nan,hi[:-1]]; plo=np.r_[np.nan,lo[:-1]]
    A4=atr(H,24*7)  # ATR horario suavizado ~1 semana
    R=regime(reg) if reg else None
    sigs=[]
    dec=(HOUR%every)==(every-1)
    # decide on close beyond the prior N-day extreme at 4H closes; extreme measured up to the previous hour
    for i in np.flatnonzero(dec & (c>phi)):
        if R is not None and R[i]!=1: continue
        e=c[i]; sigs.append((i,1,e-k*A4[i]*np.sqrt(24),np.nan,24*120))
    if shorts:
        for i in np.flatnonzero(dec & (c<plo)):
            if R is not None and R[i]!=-1: continue
            e=c[i]; sigs.append((i,-1,e+k*A4[i]*np.sqrt(24),np.nan,24*120))
    sigs.sort(); return sim(sigs, trail=(k,A4*np.sqrt(24)))
G_ortega2=[dict(N=N,k=k,shorts=s,reg=r) for N in (5,10,20,55) for k in (2,3,4) for s in (0,1) for r in (0,50)]

# ---------- Ríos 2: compresión de volatilidad y ruptura con volumen (1H) ----------
def rios2(q=0.15, vm=1.5, k=2.5, reg=0, shorts=1):
    m=sma(c,20); sd=np.sqrt(np.maximum(sma(c*c,20)-m*m,0)); bw=4*sd/m
    from numpy.lib.stride_tricks import sliding_window_view as sw
    W=720; rank=np.full(len(c),np.nan)
    # percentile of current bandwidth within last 30 days (computed on 4h steps for speed)
    idx=np.arange(W,len(c),1)
    win=sw(bw,W)  # win[j] = bw[j:j+W]
    rank[W-1:]=(win<win[:,-1:]).mean(1)
    sq=np.r_[False,(rank[:-1]<=q)]   # previous bar was in a squeeze
    vbase=sma(v,168)
    R=regime(reg) if reg else None
    sigs=[]
    for i in np.flatnonzero(sq & (c>m+2*sd) & (v>vm*vbase)):
        if R is not None and R[i]!=1: continue
        e=c[i]; sigs.append((i,1,e-k*A1[i],np.nan,24*10))
    if shorts:
        for i in np.flatnonzero(sq & (c<m-2*sd) & (v>vm*vbase)):
            if R is not None and R[i]!=-1: continue
            e=c[i]; sigs.append((i,-1,e+k*A1[i],np.nan,24*10))
    sigs.sort(); return sim(sigs, trail=(k,A1))
G_rios2=[dict(q=q,vm=vm,k=k,reg=r,shorts=s) for q in (0.1,0.2) for vm in (1.0,1.5,2.5) for k in (2,3,4) for r in (0,50) for s in (0,1)]
FAM.update({'ortega2':(ortega2,G_ortega2),'rios2':(rios2,G_rios2)})

import numpy as np
D='./'
H=dict(np.load(D+'h1.npz')); DD=dict(np.load(D+'d1.npz'))
FEE=0.0014   # ida y vuelta: taker 0,05% x2 + 0,02% deslizamiento x2
STOPSLIP=0.0003
def ema(x,n):
    a=2/(n+1); out=np.empty_like(x); s=x[0]
    for i,v in enumerate(x): s=a*v+(1-a)*s if i else v; out[i]=s
    return out
def sma(x,n):
    c=np.cumsum(np.r_[0,x]); out=np.full(len(x),np.nan); out[n-1:]=(c[n:]-c[:-n])/n; return out
def atr(B,n):
    h,l,c=B['h'],B['l'],B['c']; pc=np.r_[c[0],c[:-1]]
    tr=np.maximum(h-l,np.maximum(abs(h-pc),abs(l-pc)))
    return ema(tr,n)  # wilder-ish
def rollmax(x,n):
    from numpy.lib.stride_tricks import sliding_window_view as sw
    out=np.full(len(x),np.nan); out[n-1:]=sw(x,n).max(1); return out
def rollmin(x,n):
    from numpy.lib.stride_tricks import sliding_window_view as sw
    out=np.full(len(x),np.nan); out[n-1:]=sw(x,n).min(1); return out
# simulate on hourly bars. sig: list of (i_decision_hour_idx, side, stop, target or None, maxbars, exit_fn or None)
def sim(sigs, trail=None, exit_mask=None):
    """sigs: arrays i (hour idx where decision made at close), side, stop, target(nan=none), maxh.
    entry at open of i+1. stop first if both touched in same hour. one trade at a time (skip overlapping).
    trail: (k, atrarr) chandelier trailing on hourly closes. exit_mask: dict side->bool array over hours: exit at next open when True"""
    h,l,o,c,t=H['h'],H['l'],H['o'],H['c'],H['t']; N=len(t)
    out=[]; busy=-1
    for (i,side,stop,tgt,maxh) in sigs:
        if i<=busy or i+1>=N: continue
        e=o[i+1]; risk=(e-stop)*side
        if not risk>0: continue
        sl=stop; j=i+1; end=min(N-1,i+maxh); px=None; why=None; best=e
        while j<=end:
            if (l[j]<=sl if side==1 else h[j]>=sl): px=sl; why='stop'; break
            if tgt==tgt and (h[j]>=tgt if side==1 else l[j]<=tgt): px=tgt; why='target'; break
            if exit_mask is not None and exit_mask[side][j] and j<end:
                px=o[j+1]; why='senal'; j=j+1; break
            if trail is not None:
                k,A=trail
                if side==1: best=max(best,h[j]); sl=max(sl,best-k*A[j])
                else: best=min(best,l[j]); sl=min(sl,best+k*A[j])
            j+=1
        if px is None: j=end; px=c[end]; why='tiempo'
        cost=(FEE+(STOPSLIP if why=='stop' else 0))*e
        r=((px-e)*side-cost)/risk
        out.append((t[i]+3600, side, r, why, t[j], e, stop, (px-e)*side/e - cost/e))
        busy=j
    return out
def stats(T, a=None, b=None):
    T=[x for x in T if (a is None or x[0]>=a) and (b is None or x[0]<b)]
    n=len(T)
    if n<2: return dict(n=n,exp=float('nan'),t=float('nan'),tot=0,pf=float('nan'),dd=0,win=float('nan'))
    r=np.array([x[2] for x in T]); m=r.mean(); sd=r.std(ddof=1)
    cum=np.cumsum(r); dd=(np.maximum.accumulate(np.r_[0,cum])[1:]-cum).max()
    gp=r[r>0].sum(); gl=-r[r<0].sum()
    return dict(n=n,exp=m,t=m/sd*np.sqrt(n),tot=r.sum(),pf=gp/gl if gl else np.inf,dd=dd,win=(r>0).mean())
def fmt(s): return f"n={s['n']:4d} exp={s['exp']:+.3f} t={s['t']:+.2f} tot={s['tot']:+7.1f} PF={s['pf']:.2f} dd={s['dd']:5.1f} win={s['win']*100:4.1f}%"
import datetime as _dt
def ts(y,m=1,d=1): return int(_dt.datetime(y,m,d,tzinfo=_dt.timezone.utc).timestamp())
TRAIN=(ts(2017),ts(2022)); TEST=(ts(2022),None)
# map daily index -> hour index of the last hour of that day
def d2h_close(di):
    tclose=DD['t'][di]+86400-3600
    return np.searchsorted(H['t'],tclose)

def sim_office(sigs, trail=None, exit_mask=None, mask=None):
    """Igual que sim, pero: la entrada se hace en la primera apertura dentro del horario (mask) tras la señal,
    con la misma distancia de stop; el stop móvil y las salidas por señal solo se actualizan en horario."""
    h,l,o,c,t=H['h'],H['l'],H['o'],H['c'],H['t']; N=len(t)
    out=[]; busy=-1
    for (i,side,stop,tgt,maxh) in sigs:
        if i<=busy or i+1>=N: continue
        j0=i+1
        while j0<N and not mask[j0]: j0+=1
        if j0>=N: continue
        if j0-i>14: continue  # señal caducada (más de 14 h)
        dist=abs(c[i]-stop); e=o[j0]; sl=e-side*dist
        tg= np.nan if tgt!=tgt else e+side*abs(tgt-c[i])
        risk=dist; j=j0; end=min(N-1,i+maxh); px=None; why=None; best=e
        while j<=end:
            if (l[j]<=sl if side==1 else h[j]>=sl): px=sl; why='stop'; break
            if tg==tg and (h[j]>=tg if side==1 else l[j]<=tg): px=tg; why='target'; break
            if exit_mask is not None and exit_mask[side][j] and j<end:
                k2=j+1
                while k2<N and not mask[k2]: k2+=1
                if k2<N: px=o[k2]; why='senal'; j=k2; break
            if trail is not None:
                k,A=trail
                best=max(best,h[j]) if side==1 else min(best,l[j])
                if mask[j]: sl=max(sl,best-k*A[j]) if side==1 else min(sl,best+k*A[j])
            j+=1
        if px is None: j=min(j,end); px=c[j]; why='tiempo'
        cost=(FEE+(STOPSLIP if why=='stop' else 0))*e
        r=((px-e)*side-cost)/risk
        out.append((t[i]+3600, side, r, why, t[j], e, sl, (px-e)*side/e-cost/e))
        busy=j
    return out

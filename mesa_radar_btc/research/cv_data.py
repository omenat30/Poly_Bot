# Velas (v13): variables de forma de las últimas velas y etiquetas de una operación fija (stop 1 ATR, objetivo 1,5R) en ambos sentidos.
import numpy as np, datetime as dt
from zoneinfo import ZoneInfo
D='/tmp/claude-0/-home-user-Poly-Bot/62062f9b-9ffe-50c1-8835-98e9f5ba9b0f/scratchpad/research/'
FEE, SLIP, RR, KSTOP = 0.0014, 0.0003, 1.5, 1.0
def load(tf):
    if tf=='15m': d=dict(np.load(D+'m15.npz')); sec=900
    else:
        d=dict(np.load(D+'h1.npz')); sec=3600
        if tf=='4h':
            g=(d['t']//14400); _,idx,inv=np.unique(g,return_index=True,return_inverse=True)
            n=len(idx); o=d['o'][idx]; t=g[idx]*14400
            h=np.full(n,-np.inf); l=np.full(n,np.inf); c=np.zeros(n); v=np.zeros(n)
            np.maximum.at(h,inv,d['h']); np.minimum.at(l,inv,d['l']); np.add.at(v,inv,d['v'])
            last=np.r_[idx[1:]-1,len(d['t'])-1]; c=d['c'][last]
            d=dict(t=t,o=o,h=h,l=l,c=c,v=v); sec=14400
    return d,sec
def ema(x,n):
    a=2/(n+1); o=np.empty_like(x); s=x[0]
    for i in range(len(x)): s=a*x[i]+(1-a)*s if i else x[i]; o[i]=s
    return o
def build(tf, L=6):
    d,sec=load(tf); t,o,h,l,c,v=[d[k].astype(float) for k in 'tohlcv']; t=d['t'].astype(np.int64); N=len(t)
    pc=np.r_[c[0],c[:-1]]; tr=np.maximum(h-l,np.maximum(abs(h-pc),abs(l-pc))); A=ema(tr,14)
    vm=np.convolve(v,np.ones(20)/20,'full')[:N]
    body=(c-o)/A; up=(h-np.maximum(o,c))/A; lo=(np.minimum(o,c)-l)/A; rng=(h-l)/A; clv=np.where(h>l,(c-l)/(h-l),0.5)*2-1; vr=np.log((v+1e-9)/(vm+1e-9))
    F=[];names=[]
    for k in range(L):
        sh=lambda x: np.r_[np.full(k,np.nan),x[:N-k]]
        for nm,x in [('body',body),('up',up),('lo',lo),('rng',rng),('clv',clv),('vr',vr)]: F.append(sh(x)); names.append(f'{nm}{k}')
    # patrones clásicos (vela 0 = la última cerrada)
    b0,b1=c-o,np.r_[0,(c-o)[:-1]]; o1,c1=np.r_[o[0],o[:-1]],np.r_[c[0],c[:-1]]; h1,l1=np.r_[h[0],h[:-1]],np.r_[l[0],l[:-1]]
    pats={'eng_bull':(b1<0)&(b0>0)&(c>=o1)&(o<=c1),'eng_bear':(b1>0)&(b0<0)&(c<=o1)&(o>=c1),
          'hammer':(lo>2*np.abs(body))&(up<0.3*rng),'star':(up>2*np.abs(body))&(lo<0.3*rng),'doji':np.abs(body)<0.1*rng,
          'inside':(h<=h1)&(l>=l1),'outside':(h>h1)&(l<l1)}
    for k,x in pats.items(): F.append(x.astype(float)); names.append(k)
    # contexto mínimo de la formación: dónde cierra en el rango de 20 velas y el recorrido de 20 velas en ATR
    hh=np.array([h[max(0,i-19):i+1].max() for i in range(N)]); ll=np.array([l[max(0,i-19):i+1].min() for i in range(N)])
    F.append(np.where(hh>ll,(c-ll)/(hh-ll),0.5)*2-1); names.append('pos20')
    F.append((c-np.r_[np.full(20,np.nan),c[:-20]])/A); names.append('ret20')
    X=np.vstack(F).T
    # etiquetas: entrada en la apertura siguiente, stop 1 ATR, objetivo 1,5R, plazo Hb velas; stop primero si ambos en la misma vela
    Hb={'15m':32,'1h':24,'4h':12}[tf]; e=np.r_[o[1:],np.nan]; risk=KSTOP*A
    R={}; EX={}
    for s in (1,-1):
        sl=e-s*risk; tp=e+s*RR*risk; r=np.full(N,np.nan); ex=np.full(N,-1)
        done=np.zeros(N,bool)
        for j in range(1,Hb+1):
            idx=np.arange(N)+j; ok=idx<N; ii=np.minimum(idx,N-1)
            hs=(l[ii]<=sl) if s==1 else (h[ii]>=sl); ht=(h[ii]>=tp) if s==1 else (l[ii]<=tp)
            m=~done&ok&hs; r[m]=-1-(FEE*e[m]+SLIP*e[m])/risk[m]; ex[m]=ii[m]; done|=m
            m=~done&ok&ht; r[m]=RR-FEE*e[m]/risk[m]; ex[m]=ii[m]; done|=m
        ii=np.minimum(np.arange(N)+Hb,N-1); m=~done&(np.arange(N)+Hb<N)
        r[m]=((c[ii]-e)*s-FEE*e)[m]/risk[m]; ex[m]=ii[m]
        R[s]=r; EX[s]=ex
    tz=ZoneInfo('Europe/Madrid'); T=t+sec   # cierre de la vela de señal
    lh=np.array([dt.datetime.fromtimestamp(x-1,tz).hour for x in T]); wd=np.array([dt.datetime.fromtimestamp(x-1,tz).weekday() for x in T])
    office=(wd<5)&(lh>=7)&(lh<21)
    np.savez_compressed(D+f'cv_{tf}.npz',X=X,names=np.array(names),t=t,T=T,rl=R[1],rs=R[-1],exl=EX[1],exs=EX[-1],office=office,sec=sec,e=e,risk=risk)
    print(tf,N,X.shape,'office',office.mean().round(3),'mean r long/short',np.nanmean(R[1]).round(3),np.nanmean(R[-1]).round(3),'win',np.nanmean(R[1]>0).round(3))
import sys
for tf in sys.argv[1:]: build(tf)

# Patrones reconocibles uno a uno: dirección fijada por el patrón, en extremo del rango de 20 velas (o sin filtro) y con/sin tendencia (SMA de 50 velas).
import numpy as np, datetime as dt, math
D='/tmp/claude-0/-home-user-Poly-Bot/62062f9b-9ffe-50c1-8835-98e9f5ba9b0f/scratchpad/research/'
ts=lambda y: int(dt.datetime(y,1,1,tzinfo=dt.timezone.utc).timestamp()); END=1791514800
res=[]
for tf in ('4h','1h','15m'):
    Z=dict(np.load(D+f'cv_{tf}.npz')); X,nm=Z['X'],list(Z['names']); f=lambda k: X[:,nm.index(k)]; T=Z['T']; N=len(T)
    c=np.cumsum(f('body0')*0)  # placeholder
    pos=f('pos20'); ret=f('ret20')
    b0,b1,b2=f('body0'),f('body1'),f('body2'); up0,lo0,rg0=f('up0'),f('lo0'),f('rng0'); clv0=f('clv0')
    P={ # nombre: (máscara, sentido)
     'envolvente alcista':(Z['X'][:,nm.index('eng_bull')]>0,1),'envolvente bajista':(Z['X'][:,nm.index('eng_bear')]>0,-1),
     'martillo':(Z['X'][:,nm.index('hammer')]>0,1),'estrella fugaz':(Z['X'][:,nm.index('star')]>0,-1),
     'pin alcista (mecha baja larga)':((lo0>0.6*rg0)&(rg0>1),1),'pin bajista (mecha alta larga)':((up0>0.6*rg0)&(rg0>1),-1),
     '3 soldados':((b0>0.3)&(b1>0.3)&(b2>0.3),1),'3 cuervos':((b0<-0.3)&(b1<-0.3)&(b2<-0.3),-1),
     'vela grande alcista':((b0>1.2),1),'vela grande bajista':((b0<-1.2),-1),
     'outside alcista':((Z['X'][:,nm.index('outside')]>0)&(b0>0),1),'outside bajista':((Z['X'][:,nm.index('outside')]>0)&(b0<0),-1),
     'inside tras alcista':((Z['X'][:,nm.index('inside')]>0)&(b1>0.5),1),'inside tras bajista':((Z['X'][:,nm.index('inside')]>0)&(b1<-0.5),-1)}
    ctx={'sin filtro':np.ones(N,bool),'en extremo':None,'con tendencia':None}
    for name,(m,s) in P.items():
        for cn in ctx:
            cm=np.ones(N,bool) if cn=='sin filtro' else ((pos<-0.6) if s==1 else (pos>0.6)) if cn=='en extremo' else ((ret>0) if s==1 else (ret<0))
            sig=m&cm&Z['office']; r=Z['rl' if s==1 else 'rs']; ex=Z['exl' if s==1 else 'exs']
            # una operación a la vez
            tk=[];busy=-1
            for i in np.where(sig&np.isfinite(r))[0]:
                if i<=busy or ex[i]<0: continue
                tk.append((T[i],r[i])); busy=ex[i]
            tk=np.array(tk) if tk else np.zeros((0,2))
            def S(a,b):
                x=tk[(tk[:,0]>=a)&(tk[:,0]<b),1] if len(tk) else np.array([]); yrs=(min(b,END)-a)/31557600
                return (len(x)/yrs/52.18, x.mean() if len(x) else np.nan, (x>0).mean() if len(x) else np.nan, x.mean()/x.std()*math.sqrt(len(x)) if len(x)>5 else np.nan)
            res.append((tf,name,cn,S(ts(2018),ts(2022)),S(ts(2022),END)))
res.sort(key=lambda z:-np.nan_to_num(z[3][3],nan=-9))
print(f'{len(res)} combinaciones (3 marcos × 14 patrones × 3 contextos). Ordenadas por t en 2018-21:')
for tf,n,cn,a,b in res[:15]: print(f'{tf:3s} {n:30s} {cn:13s} | 18-21 n/sem={a[0]:.2f} R/op={a[1]:+.3f} win={a[2]:.2f} t={a[3]:+.2f} | 22-26 n/sem={b[0]:.2f} R/op={b[1]:+.3f} win={b[2]:.2f} t={b[3]:+.2f}')
pos18=sum(1 for z in res if z[3][1]>0); both=sum(1 for z in res if z[3][1]>0 and z[4][1]>0); print('positivas 18-21:',pos18,'· positivas en ambos:',both,'· positivas 22-26:',sum(1 for z in res if z[4][1]>0))

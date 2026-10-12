# Aprendices del Radar: situaciones de 15 min en las que el Radar NO entra, con la plantilla de operación del Radar y sus variables
import numpy as np, json, pickle, engine, datetime as dt
from engine import ts
M=dict(np.load(engine.D+'m15.npz')); t=M['t'].astype(np.int64); o,h,l,c,v=M['o'],M['h'],M['l'],M['c'],M['v']; N=len(t)
def ema(x,n): return engine.ema(x,n)
def sma(x,n): return engine.sma(x,n)
# 1 h y 4 h a partir de las velas de 15 min (solo velas cerradas)
def agg(sec):
    k=t//sec; idx=np.r_[0,np.flatnonzero(np.diff(k))+1]; T=t[idx]//sec*sec
    O=o[idx]; C=c[np.r_[idx[1:]-1,N-1]]; Hh=np.maximum.reduceat(h,idx); Ll=np.minimum.reduceat(l,idx); return T,O,Hh,Ll,C
def atr_(H_,L_,C_,n):
    pc=np.r_[C_[0],C_[:-1]]; tr=np.maximum(H_-L_,np.maximum(abs(H_-pc),abs(L_-pc))); return ema(tr,n)
T1,O1,H1,L1,C1=agg(3600); A1=atr_(H1,L1,C1,14); E50h=ema(C1,50)
T4,O4,H4,L4,C4=agg(14400)
def adx(H_,L_,C_,n=14):
    up=np.r_[0,np.diff(H_)]; dn=np.r_[0,-np.diff(L_)]; pdm=np.where((up>dn)&(up>0),up,0); ndm=np.where((dn>up)&(dn>0),dn,0)
    tr=atr_(H_,L_,C_,n); pdi=100*ema(pdm,n)/tr; ndi=100*ema(ndm,n)/tr; dx=100*abs(pdi-ndi)/np.maximum(pdi+ndi,1e-9); return ema(dx,n)
ADX4=adx(H4,L4,C4); 
def rsi(x,n=14):
    d=np.r_[0,np.diff(x)]; u=ema(np.maximum(d,0),n); dd=ema(np.maximum(-d,0),n); return 100-100/(1+u/np.maximum(dd,1e-9))
RSI15=rsi(c); RSI4=rsi(C4)
# índice de la última vela de 1 h / 4 h CERRADA al cierre de la vela de 15 min i (cierre = t[i]+900)
ce=t+900; j1=np.searchsorted(T1+3600,ce,side='right')-1; j4=np.searchsorted(T4+14400,ce,side='right')-1
E21=ema(c,21); E50=ema(c,50); E20=ema(c,20); vma=sma(v,20); S20=sma(c,20); SD20=np.sqrt(np.maximum(sma(c*c,20)-S20**2,0))
A15=atr_(h,l,c,14)
from numpy.lib.stride_tricks import sliding_window_view as sw
def rmax(x,n): out=np.full(len(x),np.nan); out[n:]=sw(x,n).max(1)[:-1]; return out    # máximo de las n velas ANTERIORES
def rmin(x,n): out=np.full(len(x),np.nan); out[n:]=sw(x,n).min(1)[:-1]; return out
HI24=rmax(h,24); LO24=rmin(l,24); HI96=rmax(h,96); LO96=rmin(l,96)
# día anterior (UTC)
day=t//86400; dk=np.r_[0,np.flatnonzero(np.diff(day))+1]; dH=np.maximum.reduceat(h,dk); dL=np.minimum.reduceat(l,dk); dpos=np.searchsorted(dk,np.arange(N),side='right')-1
PDH=np.where(dpos>0,dH[np.maximum(dpos-1,0)],np.nan); PDL=np.where(dpos>0,dL[np.maximum(dpos-1,0)],np.nan)
# horario de oficina (L-V 7-21 Madrid) por la hora de cierre
MASK=np.load(engine.D+'office_mask2.npy'); Ht=engine.H['t']
def office(T): k=np.searchsorted(Ht,(T-1)//3600*3600); return bool(MASK[min(k,len(Ht)-1)])
# Radar: operaciones (para excluir sus oportunidades)
RT=json.load(open(engine.D+'../panel_trades.json')); RIV=sorted((int(x['sigT'])-3600,int(x['exitT'])) for x in RT)
ra=np.array([a for a,b in RIV]); rb=np.array([b for a,b in RIV])
def radar_busy(T): k=np.searchsorted(ra,T,side='right')-1; return k>=0 and T<=rb[k]
# eventos
ev=[]
for i in range(400,N-300):
    j=j1[i]; k4=j4[i]
    if j<60 or k4<30 or not np.isfinite(HI96[i]): continue
    a1=A1[j]
    cands=[]
    if c[i]>HI24[i]: cands.append(('ruptura',1))
    if c[i]<LO24[i]: cands.append(('ruptura',-1))
    z=(c[i]-S20[i])/max(SD20[i],1e-9)
    if z<-3: cands.append(('exceso',1))
    if z>3: cands.append(('exceso',-1))
    if l[i]<LO96[i] and c[i]>LO96[i]: cands.append(('barrido',1))
    if h[i]>HI96[i] and c[i]<HI96[i]: cands.append(('barrido',-1))
    for kind,s in cands: ev.append((i,kind,s))
print('eventos',len(ev))
def outcome(i,s):
    a1=A1[j1[i]]; e=o[i+1]; R=2*a1; sl=e-s*R; tp=e+s*1.65*R; end=min(N-1,i+288)
    for k in range(i+1,end+1):
        if (l[k]<=sl if s==1 else h[k]>=sl): px=sl; why='stop'; break
        if (h[k]>=tp if s==1 else l[k]<=tp): px=tp; why='target'; break
    else: k=end; px=c[end]; why='tiempo'
    cost=(0.0014+(0.0003 if why=='stop' else 0))*e
    return ((px-e)*s-cost)/R, int(t[k]+900), why, R/e
rows=[]
for i,kind,s in ev:
    T=int(t[i]+900); r,T1x,why,rf=outcome(i,s); j=j1[i]; k4=j4[i]; w=dt.datetime.utcfromtimestamp(T)
    rows.append(dict(i=i,T=T,T1=T1x,kind=kind,s=s,r=r,why=why,rf=rf,office=office(T),radar=radar_busy(T),
      f=dict(rng=(HI24[i]-LO24[i])/A1[j], brk=((c[i]-HI24[i]) if s==1 else (LO24[i]-c[i]))/A1[j] if kind=='ruptura' else 0.0,
             z=float((c[i]-S20[i])/max(SD20[i],1e-9))*s, rvol=float(v[i]/max(vma[i],1e-12)), ema15=float(np.sign(E21[i]-E50[i])*s),
             tr1h=float((C1[j]-E50h[j])/A1[j]*s), adx4=float(ADX4[k4]), rsi15=float((RSI15[i]-50)/50*s), rsi4=float((RSI4[k4]-50)/50*s),
             pdh=float((c[i]-PDH[i])/A1[j]*s) if np.isfinite(PDH[i]) else 0.0, pdl=float((c[i]-PDL[i])/A1[j]*s) if np.isfinite(PDL[i]) else 0.0,
             atrp=float(a1/c[i]*100), ret24=float((c[i]/c[i-96]-1)/(a1/c[i])/10*s), body=float((c[i]-o[i])/max(h[i]-l[i],1e-9)*s),
             hour=w.hour, dow=w.weekday())))
pickle.dump(rows,open(engine.D+'rs_rows.pkl','wb'))
r=np.array([x['r'] for x in rows]); T=np.array([x['T'] for x in rows]); off=np.array([x['office'] for x in rows]); rad=np.array([x['radar'] for x in rows]); K=np.array([x['kind'] for x in rows])
for kd in ('ruptura','exceso','barrido'):
    for per,(a,b) in [('17-21',(ts(2017),ts(2022))),('22-26',(ts(2022),ts(2027)))]:
        m=(K==kd)&off&~rad&(T>=a)&(T<b); print(kd,per,'n',m.sum(),'win',round(float((r[m]>0).mean()),3),'R/op',round(float(r[m].mean()),3))

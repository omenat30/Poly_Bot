# Laboratorio Radar → oficina: datos de las señales del Radar con el contexto que ve cada agente en ese instante (sin mirar el futuro)
import json, numpy as np, pickle, engine, datetime as dt
from engine import H, DD, ts, sma
RT=json.load(open(engine.D+'../panel_trades.json'))
REGEN=pickle.load(open(engine.D+'regen.pkl','rb'))
t=H['t']; c=H['c']; h=H['h']; l=H['l']
A14=engine.atr(H,14); A720=engine.sma(A14,720)
d=np.diff(c,prepend=c[0]); up=engine.ema(np.maximum(d,0),14); dn=engine.ema(np.maximum(-d,0),14); RSI=100-100/(1+up/np.maximum(dn,1e-9))
S200=sma(c,4800); S50h=sma(c,1200)
FZ=np.load(engine.D+'funding_h.npz'); F3=np.nan_to_num(FZ['F3'])
dc=DD['c']; dtt=DD['t']; D50=sma(dc,50); D200=sma(dc,200)
def mature(T): k=np.searchsorted(dtt,T,side='right')-2; return k>=0 and D50[k]<D200[k]
MASK=np.load(engine.D+'office_mask2.npy')
MESA={'vega':('vega',50,2,'B1',None),'ortega':('ortega',5,2,'B1',None),'paz':('paz',40,2,'B1',0,'nub')}
IV={a:[(int(x[8]),int(x[4])+3600,int(x[1])) for x in REGEN[k]] for a,k in MESA.items()}   # la salida solo se conoce al cerrar su vela   # (entrada, salida, lado) conocidos en tiempo real
def pos_at(a,T):
    for e0,e1,s in IV[a]:
        if e0<=T<e1: return s
    return 0
def office_at(T):
    i=np.searchsorted(t,T//3600*3600); return bool(MASK[min(i,len(t)-1)])
rows=[]
for x in RT:
    T=int(x['sigT']); i=np.searchsorted(t,T-3600,side='right')-1   # última vela de 1 h CERRADA en el instante de la señal (t+3600 <= T)
    if i<4800: continue
    s=x['side']; vol=A14[i]/c[i]; w=dt.datetime.utcfromtimestamp(T)
    rows.append(dict(T=T,T1=int(x['exitT']),s=s,r=x['r'],risk_f=x['risk']/x['entry'],entry=x['entry'],kind=x['kind'],grade=x['grade'],reason=x['reason'],
        office=office_at(T), hour=w.hour, dow=w.weekday(),
        f=dict(sma200=float(np.sign(c[i]-S200[i])*s), ret24=float((c[i]/c[i-24]-1)/vol/5*s), ret7d=float((c[i]/c[i-168]-1)/vol/12*s), volrel=float(np.log(A14[i]/A720[i])),
               rsi=float((RSI[i]-50)/50*s), fund=float(F3[i]*1e4*s), pos20=float(((c[i]-l[i-480:i].min())/(h[i-480:i].max()-l[i-480:i].min()+1e-9)*2-1)*s),
               vega=pos_at('vega',T)*s, ortega=pos_at('ortega',T)*s, paz=pos_at('paz',T)*s, nub=float(mature(T)), risk=float(x['risk']/x['entry']*100))))
pickle.dump(rows,open(engine.D+'rl_rows.pkl','wb'))
r=np.array([x['r'] for x in rows]); off=np.array([x['office'] for x in rows]); T=np.array([x['T'] for x in rows])
for lab,m in [('todas',np.ones(len(r),bool)),('en horario',off),('fuera',~off)]:
    for per,(a,b) in [('17-21',(ts(2017),ts(2022))),('22-26',(ts(2022),ts(2027)))]:
        k=m&(T>=a)&(T<b); print(f'{lab:10s} {per} n={k.sum():4d} win={np.mean(r[k]>0):.2f} R/op={r[k].mean():+.3f} R/año={r[k].sum()/((min(b,engine.H["t"][-1])-a)/31557600):+.1f}')

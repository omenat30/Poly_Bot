import numpy as np, pickle, datetime, engine, strategies as S
from engine import *
from zoneinfo import ZoneInfo
P=pickle.load(open(D+'desk2.pkl','rb'))
t=H['t']; c=H['c']; dc=DD['c']
hd=np.searchsorted(DD['t'],t,side='right')-2
def dh(x): o=np.full(len(t),np.nan); ok=hd>=0; o[ok]=x[hd[ok]]; return o
S20=dh(sma(dc,20)); S50=dh(sma(dc,50)); S200=dh(sma(dc,200)); C=dh(dc)
m20=np.full(len(dc),np.nan); m20[20:]=dc[20:]/dc[:-20]-1; M20=dh(m20)
A1=atr(H,24); vol=A1/c; vr=np.full(len(c),np.nan)
from numpy.lib.stride_tricks import sliding_window_view as sw
w=sw(vol,720); vr[719:]=(w<w[:,-1:]).mean(1)
tz=ZoneInfo('Europe/Madrid')
idx={int(x):i for i,x in enumerate(t)}
def feats(x):
    i=idx[int(x[0])-3600]; s=x[1]
    return dict(side=s, al20=int(np.sign(C[i]-S20[i])==s), al200=int(np.sign(C[i]-S200[i])==s), mom=int(np.sign(M20[i])==s),
        allal=int(np.sign(C[i]-S20[i])==s and np.sign(C[i]-S200[i])==s and np.sign(M20[i])==s),
        vq=int(vr[i]*3) if vr[i]==vr[i] else -1, hr=datetime.datetime.fromtimestamp(int(x[0]),tz).hour//4, dow=datetime.datetime.fromtimestamp(int(x[0]),tz).weekday()>=5)
for ag in ('paz','rios','ortega','vega'):
    T=P[ag]; F=[feats(x) for x in T]
    print('=====',ag,len(T))
    for k in ('side','al20','al200','mom','allal','vq','hr','dow'):
        for v in sorted(set(f[k] for f in F)):
            for lab,(a,b) in (('TR',TRAIN),('TE',(TEST[0],1e11))):
                r=np.array([x[2] for x,f in zip(T,F) if f[k]==v and a<=x[0]<b])
                if len(r)<5: continue
                print(f'{k}={v} {lab} n={len(r):4d} win={np.mean(r>0)*100:4.1f}% exp={r.mean():+.3f}', end='  ')
            print()

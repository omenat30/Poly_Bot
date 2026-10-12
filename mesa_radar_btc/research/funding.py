import csv, numpy as np, datetime, engine
from engine import H
D=engine.D+'../fund/'
def load(f,tcol,rcol):
    out={}
    for r in csv.DictReader(open(f)):
        t=datetime.datetime.fromisoformat(r[tcol].replace('+00:00','')).replace(tzinfo=datetime.timezone.utc)
        out[int(t.timestamp())//3600*3600]=float(r[rcol])
    return out
A=load(D+'funding-rate-arb/data/raw/btc_funding_rate.csv','timestamp','fundingRate')
B=load(D+'HMM-Decentralised-Perpetual-Futures/data/interim/binance_BTCUSDT_funding.csv','time','fundingRate')
ov=[k for k in A if k in B]
FR=dict(A); FR.update(B)
ft=np.array(sorted(FR)); fr=np.array([FR[k] for k in ft])
t=H['t']
# funding conocido en la hora t (la última liquidación ya publicada <= t)
j=np.searchsorted(ft,t+3600,side='right')-1   # al cierre de la vela t
FH=np.where(j>=0,fr[np.maximum(j,0)],np.nan); FH[t+3600<ft[0]]=np.nan; FH[t>ft[-1]+8*3600]=np.nan
def roll(n):  # media de las últimas n liquidaciones
    c=np.cumsum(np.r_[0,fr]); m=np.full(len(fr),np.nan); m[n-1:]=(c[n:]-c[:-n])/n
    return np.where(j>=n-1,m[np.maximum(j,0)],np.nan)
F3=roll(9); F30=roll(90)
if __name__=='__main__':
    print('solape',len(ov),'difs max',max(abs(A[k]-B[k]) for k in ov) if ov else None, 'desde',datetime.datetime.utcfromtimestamp(ft[0]),'hasta',datetime.datetime.utcfromtimestamp(ft[-1]),'n',len(ft))
    print('percentiles funding 8h (%):',np.round(np.percentile(fr,[5,25,50,75,95,99])*100,4))
    np.savez(engine.D+'funding_h.npz',FH=FH,F3=F3,F30=F30)

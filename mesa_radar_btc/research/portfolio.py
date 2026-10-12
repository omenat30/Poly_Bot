import numpy as np, pickle, engine
from strategies import *
PICK={'vega':(vega,dict(n=20,k=3.5,shorts=0,mom=1)),
      'ortega2':(ortega2,dict(N=5,k=2,shorts=0,reg=0)),
      'rios2':(rios2,dict(q=0.2,vm=1.0,k=4,reg=50,shorts=0))}
def run(fee=0.0014):
    engine.FEE=fee
    return {k:f(**p) for k,(f,p) in PICK.items()}
def yearly(T):
    import datetime; Y={}
    for x in T: Y.setdefault(datetime.datetime.utcfromtimestamp(int(x[0])).year,[]).append(x[2])
    return {y:(len(v),round(sum(v),1)) for y,v in sorted(Y.items())}
def port(S):
    allT=sorted([x for v in S.values() for x in v], key=lambda x:x[4])  # por fecha de salida
    return allT
if __name__=='__main__':
    for label,fee in [('costes reales 0,14%',0.0014),('costes x2 0,28%',0.0028)]:
        S=run(fee); P=port(S)
        print('=====',label)
        for k,T in S.items(): print(f'{k:8s} TRAIN',fmt(stats(T,*TRAIN)),'| TEST',fmt(stats(T,*TEST)))
        print('MESA     TRAIN',fmt(stats(P,*TRAIN)),'| TEST',fmt(stats(P,*TEST)))
        print('por año (n, R):',yearly([x for x in P if x[0]>=ts(2017)]))
    S=run(); pickle.dump(S,open(D+'portfolio.pkl','wb'))
    # % con 1% de riesgo por operación (sin compuesto)
    P=port(S); import datetime
    for a,b,lab in [(ts(2017),ts(2022),'2017-21'),(ts(2022),10**10,'2022-26')]:
        r=np.array([x[2] for x in P if a<=x[4]<b]); yrs=((min(b,P[-1][4]))-a)/31557600
        cum=np.cumsum(r); dd=(np.maximum.accumulate(np.r_[0,cum])[1:]-cum).max()
        print(lab,'R/año',round(r.sum()/yrs,1),'caída máx R',round(dd,1),'ops/año',round(len(r)/yrs,1))

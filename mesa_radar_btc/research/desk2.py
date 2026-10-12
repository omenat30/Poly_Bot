from desk import *
import engine
W={'vega':1.0,'ortega':1.0,'paz':0.5,'rios':0.5}
def build():
    return dict(vega=S.vega(n=20,k=3.5,shorts=0,mom=1), ortega=S.ortega2(N=5,k=2,shorts=1,reg=50),
                paz=paz3(rsi_lo=45,reg=50,shorts=1,maxh=96,tk=5,en=50), rios=S.rios2(q=0.2,vm=1.0,k=4,reg=50,shorts=1))
def wstats(parts,a,b):
    P=sorted([(x[4],x[2]*W[k],x[2]) for k,T in parts.items() for x in T if a<=x[0]<b],key=lambda z:z[0])
    r=np.array([p[1] for p in P]); raw=np.array([p[2] for p in P]); yrs=(min(b,END)-a)/31557600
    cum=np.cumsum(r); dd=(np.maximum.accumulate(np.r_[0,cum])[1:]-cum).max()
    return dict(nw=len(r)/yrs/52.18, win=(raw>0).mean(), expR=raw.mean(), expW=r.mean(), t=r.mean()/r.std(ddof=1)*np.sqrt(len(r)), perY=r.sum()/yrs, dd=dd)
for fee in (0.0014,0.0028):
    engine.FEE=fee; parts=build()
    for lab,(a,b) in (('17-21',TRAIN),('22-26',(TEST[0],10**11))):
        s=wstats(parts,a,b); print(fee,lab,{k:round(float(v),3) for k,v in s.items()})
    if fee==0.0014:
        import pickle; pickle.dump(parts,open(D+'desk2.pkl','wb'))
        for k,T in parts.items():
            Y={}
            for x in T:
                if x[0]>=ts(2017): Y.setdefault(datetime.datetime.utcfromtimestamp(int(x[0])).year,[]).append(x[2]*W[k])
            print(k,' '.join(f'{y}:{sum(v):+.1f}' for y,v in sorted(Y.items())))
        Y={}
        for k,T in parts.items():
            for x in T:
                if x[0]>=ts(2017): Y.setdefault(datetime.datetime.utcfromtimestamp(int(x[0])).year,[]).append(x[2]*W[k])
        print('MESA',' '.join(f'{y}:{sum(v):+.1f}({len(v)})' for y,v in sorted(Y.items())))

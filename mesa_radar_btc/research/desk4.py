from desk3 import *
import pickle, datetime
MG=[{}, dict(tp=1.5,f=0.33,be=0.75,beoff=0.3), dict(tp=1,f=0.5,be=0.75,beoff=0.3), dict(be=1,beoff=0.3), dict(be=1.5,beoff=0.3)]
def build():
    V=agent('vega',{}); O=agent('ortega',MG[1]); IV=ivs(V)+ivs(O); f=lambda tt,s: inany(IV,tt,s)
    return dict(vega=V,ortega=O,paz=agent('paz',MG[4],f),rios=agent('rios',MG[3],f))
for fee in (0.0014,0.0028):
    engine.FEE=fee; mgmt.FEE=fee; P=build(); desk(P,f'v3 fee={fee}')
    if fee==0.0014:
        pickle.dump(P,open(engine.D+'desk3.pkl','wb'))
        for k,T in P.items(): 
            for nm,(a,b) in (('TR',TRAIN),('TE',(TEST[0],1e11))):
                r=np.array([x[2] for x in T if a<=x[0]<b]); yrs=(min(b,END)-a)/31557600
                print(f'  {k:6s} {nm} {len(r)/yrs/52.18:.2f}/sem win={np.mean(r>0)*100:.0f}% exp={r.mean():+.3f}',end='')
            print()
        Z=sorted([(x[4],x[2]*W[k],x[0]) for k,T in P.items() for x in T if x[0]>=TEST[0]]); cum=np.cumsum([z[1] for z in Z]); print('  DD TE',round(float((np.maximum.accumulate(np.r_[0,cum])[1:]-cum).max()),1))
        Y={}
        for k,T in P.items():
            for x in T:
                if x[0]>=ts(2017): Y.setdefault(datetime.datetime.utcfromtimestamp(int(x[0])).year,[]).append(x[2]*W[k])
        print('  ',' '.join(f'{y}:{sum(v):+.0f}({len(v)})' for y,v in sorted(Y.items())))

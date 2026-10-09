from paz3 import *
import datetime
S.sim=off
def desk(parts,label):
    P=sorted([x for T in parts.values() for x in T if x[0]>=ts(2017)],key=lambda x:x[4])
    print('==',label)
    for k,T in parts.items(): rep('  '+k,T)
    a=stats(P,*TRAIN); b=stats(P,*TEST)
    print(f'  MESA TR n/sem={a["n"]/5/52.18:.2f} e={a["exp"]:+.3f} t={a["t"]:+.2f} win={a["win"]*100:.0f}% dd={a["dd"]:.1f} | TE n/sem={b["n"]/TEY/52.18:.2f} e={b["exp"]:+.3f} t={b["t"]:+.2f} win={b["win"]*100:.0f}% dd={b["dd"]:.1f}')
    Y={}
    for x in P: Y.setdefault(datetime.datetime.utcfromtimestamp(int(x[0])).year,[]).append(x[2])
    print('  ', ' '.join(f'{y}:{sum(v):+.0f}({len(v)})' for y,v in sorted(Y.items())))
    return P
if __name__=='__main__':
    V=S.vega(n=20,k=3.5,shorts=0,mom=1); V2=S.vega(n=20,k=3.5,shorts=1,mom=1)
    rep('vega shorts',V2)
    O=S.ortega2(N=5,k=2,shorts=0,reg=0); O2=S.ortega2(N=5,k=1.5,shorts=1,reg=0); O3=S.ortega2(N=5,k=2,shorts=1,reg=50)
    R=S.rios2(q=0.2,vm=1.0,k=4,reg=50,shorts=0); R2=S.rios2(q=0.2,vm=1.0,k=4,reg=50,shorts=1)
    rep('rios2 shorts',R2)
    P1=paz3(rsi_lo=45,reg=50,shorts=1,maxh=96,tk=5,en=50); P0=paz3(rsi_lo=45,reg=50,shorts=0,maxh=96,tk=5,en=50)
    desk(dict(vega=V,ortega=O),'actual')
    desk(dict(vega=V,ortega=O,paz=P1),'A: +paz')
    desk(dict(vega=V,ortega=O,paz=P1,rios=R),'B: +paz +rios')
    desk(dict(vega=V,ortega=O3,paz=P1,rios=R2),'C: shorts reg50 everywhere')
    desk(dict(vega=V,ortega=O2,paz=P1,rios=R),'D: ortega shorts reg0')

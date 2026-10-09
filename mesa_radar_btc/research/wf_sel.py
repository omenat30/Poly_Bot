import numpy as np, pickle, datetime, engine
from engine import ts, H
C=pickle.load(open(engine.D+'wf_cands.pkl','rb')); END=int(H['t'][-1]); HL=2*31557600
AG=['vega','ortega','paz','rios']
def wstats(T, ref, start=ts(2017)):
    Z=[(x[0],x[2]) for x in T if start<=x[0]<ref]
    if len(Z)<15: return None
    t=np.array([z[0] for z in Z]); r=np.array([z[1] for z in Z]); w=0.5**((ref-t)/HL)
    m=(w*r).sum()/w.sum(); sd=np.sqrt((w*(r-m)**2).sum()/w.sum()); neff=w.sum()**2/(w**2).sum()
    yrs_w=sum(0.5**((ref-(start+i*31557600+15778800))/HL) for i in range(int((ref-start)/31557600)))  # años ponderados
    return dict(m=m, t=m/sd*np.sqrt(neff), Ry=(w*r).sum()/max(yrs_w,1e-9), win=(w*(r>0)).sum()/w.sum())
def choose(ref, tmin=1.5):
    pick={}
    for a in AG:
        best=None
        for k,T in C.items():
            if k[0]!=a: continue
            s=wstats(T,ref)
            if s and s['t']>=tmin and (best is None or s['Ry']>best[1]['Ry']): best=(k,s)
        pick[a]=best
    tm=max([b[1]['t'] for b in pick.values() if b] or [1])
    W={a:(0 if not b else max(0.25,round(b[1]['t']/tm*4)/4)) for a,b in pick.items()}
    return pick,W
def desk(years, sel):
    Z=[]
    for y in years:
        a,b=ts(y),ts(y+1)
        for ag,(k,w) in sel(y).items():
            if k is None or w==0: continue
            Z+=[(x[4],x[2],w,ag,y) for x in C[k] if a<=x[0]<b]
    Z.sort(); r=np.array([z[1] for z in Z]); wr=np.array([z[1]*z[2] for z in Z]); yrs=(min(ts(years[-1]+1),END)-ts(years[0]))/31557600
    cum=np.cumsum(wr); dd=(np.maximum.accumulate(np.r_[0,cum])[1:]-cum).max()
    Y={}
    for z in Z: Y.setdefault(z[4],0); Y[z[4]]+=z[1]*z[2]
    return dict(nw=len(r)/yrs/52.18, win=np.mean(r>0), exp=r.mean(), Ry=wr.sum()/yrs, dd=dd, t=wr.mean()/wr.std()*np.sqrt(len(wr)), Y={k:round(v,1) for k,v in Y.items()})
V3={'vega':(('vega',20,3.5,0,'0'),1),'ortega':(('ortega',5,2,'O1'),1),'paz':(('paz',45,'P4',1),0.5),'rios':(('rios',1.0,'R3',1),0.5)}
SEL={}
for y in range(2020,2027):
    pick,W=choose(ts(y)); SEL[y]={a:(pick[a][0] if pick[a] else None,W[a]) for a in AG}
    print(y, {a:(SEL[y][a][0][1:] if SEL[y][a][0] else None, SEL[y][a][1]) for a in AG})
yrs=list(range(2020,2027))
fmt=lambda d:' '.join(f'{k}={v:.3f}' if isinstance(v,float) else f'{k}={v}' for k,v in d.items())
print('v3 fijo (L-V 7-21) ', fmt(desk(yrs,lambda y:V3)))
print('v4 walk-forward    ', fmt(desk(yrs,lambda y:SEL[y])))
for a in AG:
    print('  solo',a, fmt({k:v for k,v in desk(yrs,lambda y:{a:SEL[y][a]}).items() if k!='Y'}))
pick,W=choose(END+1); print('LIVE pick', {a:(pick[a][0] if pick[a] else None, W[a], {k:round(v,3) for k,v in pick[a][1].items()} if pick[a] else None) for a in AG})
pickle.dump((SEL,pick,W),open(engine.D+'wf_sel.pkl','wb'))

import numpy as np, pickle, itertools, sys, engine
from engine import ts, H
from wf_sel import wstats, AG, END
C=pickle.load(open(engine.D+'wf2_cands.pkl','rb'))
FW={'vega':1,'ortega':1,'paz':0.5,'rios':0.5}
yrs=list(range(2020,2027))
def choose(ref, obj, tmin, wmin, allow_rad=True):
    pick={}
    for a in AG:
        best=None
        for k,T in C.items():
            if k[0]!=a or (not allow_rad and k[-1]): continue
            s=wstats(T,ref)
            if not s or s['t']<tmin or s['win']<wmin: continue
            v=obj(s)
            if best is None or v>best[2]: best=(k,s,v)
        pick[a]=best
    return pick
def desk(sel):
    Z=[]
    for y in yrs:
        for a,b in sel[y].items():
            if not b: continue
            Z+=[(x[4],x[2],FW[a]) for x in C[b[0]] if ts(y)<=x[0]<ts(y+1)]
    Z.sort(); r=np.array([z[1] for z in Z]); wr=np.array([z[1]*z[2] for z in Z]); yrs_=(END-ts(2020))/31557600
    cum=np.cumsum(wr); dd=(np.maximum.accumulate(np.r_[0,cum])[1:]-cum).max()
    return dict(nw=len(r)/yrs_/52.18, win=np.mean(r>0), exp=r.mean(), Ry=wr.sum()/yrs_, dd=dd, t=wr.mean()/wr.std()*np.sqrt(len(wr)))
OBJ={'Ry':lambda s:s['Ry'], 'm':lambda s:s['m'], 'Ry*win':lambda s:s['Ry']*s['win'], 'm*win':lambda s:s['m']*s['win'], 'tw':lambda s:s['t']*s['win']}
res=[]
for (on,o),tmin,wmin,rad in itertools.product(OBJ.items(),(1.0,1.5),(0,0.4,0.5),(True,False)):
    sel={y:choose(ts(y),o,tmin,wmin,rad) for y in yrs}
    d=desk(sel); res.append(((on,tmin,wmin,rad),d,sel))
    print(f'{on:7s} tmin={tmin} wmin={wmin} radar={int(rad)}', ' '.join(f'{k}={v:.3f}' for k,v in d.items()), flush=True)
pickle.dump(res,open(engine.D+'wf2_res.pkl','wb'))

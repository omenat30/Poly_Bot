import numpy as np, itertools, engine, strategies as S, mgmt, paz3 as PZ, json, sys
from engine import stats, TRAIN, TEST, H, ts
END=int(H['t'][-1])
def mk(cfg, filt=None):
    def sim(sigs, trail=None, exit_mask=None):
        if filt: sigs=[s for s in sigs if filt(H['t'][s[0]]+3600, s[1])]
        return mgmt.sim_m(sigs, trail, exit_mask, **cfg)
    return sim
def agent(name, cfg, filt=None):
    S.sim=mk(cfg,filt); PZ.off=S.sim
    if name=='vega': return S.vega(n=20,k=3.5,shorts=0,mom=1)
    if name=='ortega': return S.ortega2(N=5,k=2,shorts=1,reg=50)
    if name=='paz': return PZ.paz3(rsi_lo=45,reg=50,shorts=1,maxh=96,tk=5,en=50)
    if name=='rios': return S.rios2(q=0.2,vm=1.0,k=4,reg=50,shorts=1)
def ivs(T): return [(x[0],x[4],x[1]) for x in T]
def inany(IV, tt, side): return any(a<=tt<b and s==side for a,b,s in IV)
W={'vega':1,'ortega':1,'paz':0.5,'rios':0.5}
def desk(parts, lab):
    out={}
    for nm,(a,b) in (('TR',TRAIN),('TE',(TEST[0],1e11))):
        Z=[(x[2],W[k]) for k,T in parts.items() for x in T if a<=x[0]<b]; r=np.array([z[0] for z in Z]); w=np.array([z[0]*z[1] for z in Z]); yrs=(min(b,END)-a)/31557600
        out[nm]=dict(nw=len(r)/yrs/52.18, win=np.mean(r>0), exp=r.mean(), t=w.mean()/w.std()*np.sqrt(len(w)), Ry=w.sum()/yrs)
    print(f"{lab:60s} " + ' | '.join(f"{nm} {o['nw']:.2f}/sem win={o['win']*100:4.1f}% exp={o['exp']:+.3f} t={o['t']:+.2f} R/año={o['Ry']:+.1f}" for nm,o in out.items()), flush=True)
    return out
BASE={}
V=agent('vega',{}); O=agent('ortega',{})
desk(dict(vega=V,ortega=O,paz=agent('paz',{}),rios=agent('rios',{})),'actual (v2)')
MG=[{}, dict(tp=1.5,f=0.33,be=0.75,beoff=0.3), dict(tp=1,f=0.5,be=0.75,beoff=0.3), dict(be=1,beoff=0.3), dict(be=1.5,beoff=0.3), dict(tp=1,f=0.5,be=1,beoff=0.1)]
res=[]
for mo in MG:
    Om=agent('ortega',mo); IV=ivs(V)+ivs(Om); f=lambda tt,s: inany(IV,tt,s)
    for mp in MG:
        Pm=agent('paz',mp,f)
        for rconf in (0,1):
            for mr in (MG[0],MG[3]):
                Rm=agent('rios',mr,f if rconf else None)
                o=desk(dict(vega=V,ortega=Om,paz=Pm,rios=Rm), f'O{MG.index(mo)} P{MG.index(mp)}c R{MG.index(mr)}{"c" if rconf else ""}')
                res.append(((MG.index(mo),MG.index(mp),rconf,MG.index(mr)),o))
json.dump([[k,{n:{a:float(b) for a,b in v.items()} for n,v in o.items()}] for k,o in res],open('desk3.json','w'))

import numpy as np, json
from audit_base import *
from engine import stats
exec(open('funding.py').read().split("if __name__")[0])
out={}
DFm=None
def with_fund(Z):
    dfm={a:np.nanmedian([z[6] for z in Z if z[3]==a]) for a in set(z[3] for z in Z)}
    return [z[:2]+(z[2]-z[4]*fr[(ft>z[9])&(ft<=z[1])].sum()/(z[6] if z[6]==z[6] and z[6]>0 else dfm[z[3]]),)+z[3:] for z in Z]
Z=with_fund(stream_full()); base=summ(run_log(Z)); out['base_con_funding']={k:round(v,2) for k,v in base.items()}
# 1) reglas de parada sobre la cartera walk-forward (P&L cerrado ponderado)
def run_stop(Z, wk=(3,7,7), peak=(10,30), cap=2.0, ddth=(8,0.5)):
    open_=[]; eq=0; pk=0; closed=[]; pause_until=0; log=[]; acts={'semana':0,'maximo':0}; skipped=[]
    for z in Z:
        t0,t1,r,a,s=z[0],z[1],z[2],z[3],z[4]
        for o in sorted([o for o in open_ if o[1]<=t0],key=lambda o:o[1]):
            eq+=o[2]*o[5]; pk=max(pk,eq); closed.append((o[1],o[2]*o[5])); open_.remove(o)
            if wk and sum(v for tt,v in closed if tt>o[1]-wk[1]*86400)<=-wk[0] and pause_until<o[1]: pause_until=o[1]+wk[2]*86400; acts['semana']+=1
            if peak and pk-eq>=peak[0] and pause_until<o[1]: pause_until=o[1]+peak[1]*86400; acts['maximo']+=1; pk=eq
        if t0<pause_until: skipped.append(r*BASE[a]); continue
        w=BASE[a]
        if ddth and pk-eq>ddth[0]: w*=ddth[1]
        if cap and sum(o[5] for o in open_)+w>cap:
            w=cap-sum(o[5] for o in open_)
            if w<=0.2: continue
        open_.append((t0,t1,r,a,s,w)); log.append(dict(t0=t0,t1=t1,a=a,s=s,r=r,w=w,st='tomada',brake=False))
    s=summ(log); return dict(Ry=round(s['Ry'],2),dd=round(s['dd'],2),RyDD=round(s['RyDD'],2),n=s['n'],activaciones=acts,R_no_operado=round(sum(skipped),1),n_no_operado=len(skipped))
for lab,kw in [('ninguna',dict(wk=None,peak=None)),('-3R/7d pausa 7d',dict(peak=None)),('-10R pausa 30d',dict(wk=None)),('ambas',{})]:
    out['parada '+lab]=run_stop(Z,**kw)
# 2) regla de selección: sensibilidad (no se elige la mejor; se informa)
import wf4
Wm=wf4.W
def chooseX(ref, obj='mw', tmin=1.0, act=None):
    pick={}
    for a in AGS:
        best=None
        for k,T in C.items():
            if k[0]!=a or k[-1]=='na': continue
            if a=='paz' and not (k[-1]=='nub' and k[4]==0): continue
            if a=='rios' and not (k[-1]=='nub' or 'fund' in k): continue
            if a=='funding' and len(k)==7: continue
            s=Wm.wstats(T,ref)
            if not s or s['t']<tmin: continue
            if act and sum(1 for x in T if ref-act[1]*31557600<=x[0]<ref)<act[0]: continue
            v={'mw':s['m']*s['win'],'m':s['m'],'t':s['t']}[obj]
            if best is None or v>best[2]: best=(k,s,v)
        pick[a]=best
    return pick
REGEN_=REGEN
for lab,kw in [('actual m×acierto t≥1',{}),('m t≥1',dict(obj='m')),('t',dict(obj='t')),('m×acierto t≥2',dict(tmin=2)),('m×acierto t≥1 + actividad 6 op/2 años',dict(act=(6,2))),('m t≥2 + actividad',dict(obj='m',tmin=2,act=(6,2)))]:
    sel={y:chooseX(ts(y),**kw) for y in Wm.yrs}
    Zs=with_fund(stream_full(sel)); s=summ(run_log(Zs))
    out['seleccion '+lab]=dict(Ry=round(s['Ry'],2),dd=round(s['dd'],2),RyDD=round(s['RyDD'],2),nw=round(s['nw'],2),win=round(s['win'],2),
        por_ano={y:round(sum(l['r']*l['w'] for l in run_log(Zs) if ts(y)<=l['t0']<ts(y+1)),1) for y in range(2020,2027)},
        rios={y:(sel[y]['rios'][0] if sel[y]['rios'] else None) for y in (2022,2026)})
# 3) Nubarrones fuera de su periodo de diseño: cortos de Paz y Ríos en bajista maduro 2017-2019 (sin veto)
from engine import DD as DDd, sma
dc=DDd['c']; dt=DDd['t']; S50=sma(dc,50); S200=sma(dc,200)
def mature(tt): d=np.searchsorted(dt,tt,side='right')-2; return S50[d]<S200[d]
for k in [('paz',40,2,'B1',0,None),('paz',45,1.5,'0',0,None),('rios',4,'0',None)]:
    T=[x for x in REGEN[k] if x[1]==-1 and mature(x[0])]
    out['nub_pre '+str(k)]={p:(lambda s:dict(n=s['n'],exp=round(s['exp'],3),tot=round(s['tot'],1)))(stats(T,*ab)) for p,ab in {'2017-19':(ts(2017),ts(2020)),'2020-26':(ts(2020),None)}.items()}
json.dump(out,open(engine.D+'../audit/a4.json','w'),indent=1,default=str)
for k,v in out.items(): print(k,v)

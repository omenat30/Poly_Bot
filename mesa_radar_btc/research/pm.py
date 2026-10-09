# Gestor de carteras sobre el walk-forward (sin mirar el futuro): reparto de riesgo, tope de riesgo abierto y freno por caída
import numpy as np, pickle, itertools, engine
from engine import ts
import wf2_sel as W
C=pickle.load(open(engine.D+'wf3_cands.pkl','rb')); FC=pickle.load(open(engine.D+'fund_cands.pkl','rb'))
for k,v in FC.items(): C[('funding',)+k]=v
W.C=C
AG=['vega','ortega','paz','funding']
def chooseY(ref):
    pick={}
    for a in AG:
        best=None
        for k,T in C.items():
            if k[0]!=a or k[-1]=='na': continue
            if a=='paz' and not (k[-1]=='nub' and k[4]==0): continue
            s=W.wstats(T,ref)
            if not s or s['t']<1.0: continue
            v=s['m']*s['win']
            if best is None or v>best[2]: best=(k,s,v)
        pick[a]=best
    return pick
sel={y:chooseY(ts(y)) for y in W.yrs}
def stream(agents):
    Z=[]
    for y in W.yrs:
        for a in agents:
            b=sel[y][a]
            if b: Z+=[(x[0],x[4],x[2],a,x[1]) for x in C[b[0]] if ts(y)<=x[0]<ts(y+1)]
    return sorted(Z)
BASE={'vega':1,'ortega':1,'paz':0.75,'funding':0.5}
def run(Z, base=BASE, cap=None, ddth=None, dyn=None, dedup=None):
    """cap: riesgo abierto máximo (R); ddth: (umbral R, factor) recorta el riesgo si la caída realizada supera el umbral;
       dyn: n -> peso por agente según el R medio de sus últimas n operaciones cerradas (×1,25 si > +0,3, ×0,5 si < 0);
       dedup: factor para una segunda posición del mismo sentido abierta a la vez."""
    open_=[]; eq=0; peak=0; real=[]; hist={a:[] for a in base}; taken=[]; ev=[]
    for (t0,t1,r,a,s) in Z:
        # cerrar las que terminaron antes de esta entrada
        for o in sorted([o for o in open_ if o[1]<=t0],key=lambda o:o[1]):
            eq+=o[2]*o[5]; peak=max(peak,eq); hist[o[3]].append(o[2]); open_.remove(o)
        w=base[a]
        if dyn and len(hist[a])>=dyn:
            m=np.mean(hist[a][-dyn:]); w*= 1.25 if m>0.3 else 0.5 if m<0 else 1
        if ddth and peak-eq>ddth[0]: w*=ddth[1]
        if dedup and any(o[4]==s for o in open_): w*=dedup
        if cap and sum(o[5] for o in open_)+w>cap:
            w=cap-sum(o[5] for o in open_)
            if w<=0.2: continue
        open_.append((t0,t1,r,a,s,w)); taken.append((t1,r,w))
    taken.sort(); r=np.array([x[1] for x in taken]); wr=np.array([x[1]*x[2] for x in taken]); yrs=(W.END-ts(2020))/31557600
    cum=np.cumsum(wr); dd=(np.maximum.accumulate(np.r_[0,cum])[1:]-cum).max()
    return dict(nw=len(r)/yrs/52.18, win=np.mean(r>0), exp=r.mean(), Ry=wr.sum()/yrs, dd=dd, RyDD=wr.sum()/yrs/dd, t=wr.mean()/wr.std()*np.sqrt(len(wr)))
f=lambda d:' '.join(f'{k}={v:.3f}' for k,v in d.items())
if __name__=='__main__':
    for lab,ag in (('v6 con Ríos (ref.)',None),('sin Ríos',['vega','ortega','paz']),('sin Ríos + funding',AG)):
        if ag is None: continue
        Z=stream(ag); print(f'{lab:22s} base          ',f(run(Z)))
        for cap,ddth,dyn,dedup in itertools.product((None,2.0,2.5),(None,(8,0.5),(12,0.5)),(None,10),(None,0.5)):
            d=run(Z,cap=cap,ddth=ddth,dyn=dyn,dedup=dedup); print(f'{lab:22s} cap={cap} dd={ddth} dyn={dyn} dedup={dedup}',f(d))
    print({y:{a:(b[0] if b else None) for a,b in sel[y].items()} for y in (2025,2026)})

# Base común de la auditoría: flujo de señales del walk-forward v8/v9 con el detalle de cada operación
import numpy as np, pickle, io, contextlib, engine
from engine import ts, H
with contextlib.redirect_stdout(io.StringIO()):
    import wf4b, pm, wf4
W=wf4.W; C=wf4.C; BASE=dict(wf4.BASE); SEL=wf4b.sel; END=W.END; YRS=(END-ts(2020))/31557600
AGS=['vega','ortega','paz','rios','funding']
MASK=np.load(engine.D+'office_mask2.npy')
try: REGEN=pickle.load(open(engine.D+'regen.pkl','rb'))
except Exception: REGEN={}
def stream_full(sel=SEL, agents=AGS):
    """(t0, t1, r, agente, lado, e, dist_frac, why, variante) de las variantes elegidas cada año."""
    Z=[]
    for y in W.yrs:
        for a in agents:
            b=sel[y].get(a)
            if not b: continue
            RG=REGEN.get(b[0]); rgm={(int(q[0]),int(q[1])):q for q in RG} if RG else {}
            for x in C[b[0]]:
                if ts(y)<=x[0]<ts(y+1):
                    q=rgm.get((int(x[0]),int(x[1])))
                    df=q[7] if q is not None else np.nan; te=q[8] if q is not None else int(x[0])
                    Z.append((int(x[0]),int(x[4]),float(x[2]),a,int(x[1]),float(x[5]),df,x[3],b[0],te))
    Z.sort(key=lambda z:(z[0],z[1],z[2],z[3],z[4])); return Z
def run_log(Z, base=BASE, cap=2.0, ddth=(8,0.5), rcol=2):
    """Réplica de pm.run con registro de cada señal: tomada/rechazada, peso, freno activo."""
    open_=[]; eq=0; peak=0; log=[]
    for z in Z:
        t0,t1,a,s=z[0],z[1],z[3],z[4]; r=z[rcol]
        for o in sorted([o for o in open_ if o[1]<=t0],key=lambda o:o[1]):
            eq+=o[2]*o[5]; peak=max(peak,eq); open_.remove(o)
        w=base[a]; brake=False
        if ddth and peak-eq>ddth[0]: w*=ddth[1]; brake=True
        st='tomada'
        if cap and sum(o[5] for o in open_)+w>cap:
            w=cap-sum(o[5] for o in open_)
            if w<=0.2: log.append(dict(t0=t0,t1=t1,a=a,s=s,r=r,w=0.0,st='rechazada_tope',brake=brake)); continue
            st='recortada_tope'
        open_.append((t0,t1,r,a,s,w)); log.append(dict(t0=t0,t1=t1,a=a,s=s,r=r,w=w,st=st,brake=brake))
    return log
def summ(log):
    tk=[l for l in log if l['w']>0]; r=np.array([l['r'] for l in tk]); wr=np.array([l['r']*l['w'] for l in tk])
    order=np.argsort([l['t1'] for l in tk]); cum=np.cumsum(wr[order]); dd=(np.maximum.accumulate(np.r_[0,cum])[1:]-cum).max() if len(cum) else 0
    return dict(n=len(tk), nw=len(tk)/YRS/52.18, win=float(np.mean(r>0)), exp=float(r.mean()), wexp=float(wr.mean()), Ry=float(wr.sum()/YRS), tot=float(wr.sum()), dd=float(dd), RyDD=float(wr.sum()/YRS/dd) if dd else np.nan)
def daily(log, start=None, end=None):
    """P&L diario de cartera (R ponderado) asignado al día de cierre."""
    d0=ts(2020)//86400; d1=END//86400+1; v=np.zeros(d1-d0)
    for l in log:
        if l['w']>0: v[min(d1-1,l['t1']//86400)-d0]+=l['r']*l['w']
    return v

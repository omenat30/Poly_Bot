exec(open('rl_final.py').read().split('OV=[m')[0])
import wf4 as _w
CC=_w.C
def own(key, w, a='x'):
    return [(int(x[0]),int(x[4]),float(x[2]),w,a) for x in CC[key] if MASK_ok(x[0])]
MK=np.load(engine.D+'office_mask2.npy'); tt=engine.H['t']
def MASK_ok(T): return True   # las variantes ya entran solo en horario (sim_m con la máscara de oficina)
core=radar(lambda x:radar_live(x) and pazv(x))
for lab,ko,kv in [('salida propia (B1)',('ortega',5,2,'B1',None),('vega',50,2,'B1',None)),('objetivo 1,5R (T1.5)',('ortega',5,2,'T1.5',None),('vega',50,2,'T1.5',None)),('objetivo 2R (T2)',('ortega',5,2,'T2',None),('vega',50,2,'T2',None))]:
    for wt in (0.5,1.0):
        tr=core+own(ko,wt,'ortega')+own(kv,0.75*wt,'vega')
        for per,(a,b) in [('18-21',(ts(2018),ts(2022))),('22-26',(ts(2022),END_))]:
            s=port(tr,a,b); print(f'{lab:22s} peso {wt} {per} win={s["win"]:.3f} R/op={s["Rop"]:+.3f} cart/op={s["Rop_cart"]:+.3f} R/año={s["Ry"]:+.1f} caída={s["dd"]:.1f} Sharpe={s["SR"]:.2f}')
    for k,nm in ((ko,'ortega'),(kv,'vega')):
        for per,(a,b) in [('18-21',(ts(2018),ts(2022))),('22-26',(ts(2022),END_))]:
            r=np.array([x[2] for x in CC[k] if a<=x[0]<b]); print(f'   {nm} {lab} {per} n={len(r)} win={np.mean(r>0):.2f} R/op={r.mean():+.3f}')

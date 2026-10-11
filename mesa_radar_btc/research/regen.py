# Regenera las variantes elegidas en el walk-forward guardando la distancia del stop (fracción del precio) y la hora real de entrada
import numpy as np, pickle, io, contextlib, engine, mgmt
from engine import H
_orig=mgmt.sim_m
def sim_m2(sigs, trail=None, exit_mask=None, mask=mgmt.M, tp=None, f=0.5, be=None, beoff=0.2):
    o,c,t=H['o'],H['c'],H['t']; N=len(t); info={}
    for (i,side,stop,tgt,maxh) in sigs:
        j0=i+1
        while j0<N and not mask[j0]: j0+=1
        if j0<N: info[(int(t[i]+3600),side)]=(abs(c[i]-stop)/o[j0], int(t[j0]))
    out=_orig(sigs,trail,exit_mask,mask,tp,f,be,beoff)
    return [x[:7]+info.get((int(x[0]),x[1]),(np.nan,np.nan)) for x in out]
mgmt.sim_m=sim_m2
with contextlib.redirect_stdout(io.StringIO()):
    import strategies as S, paz3 as PZ, wf2, wf3, collab, fund_strat as FS, wf4b
G={'0':({},None),'B1':(dict(be=1,beoff=0.3),None)}
for T in (1,1.5,2,3): G[f'T{T}']=({},T)
for T in (2,3): G[f'T{T}b']=(dict(be=1,beoff=0.3),T)
keys=set(b[0] for y in wf4b.sel for b in wf4b.sel[y].values() if b)
live=wf4b.chooseAny(wf4b.W.END+1); keys|=set(b[0] for b in live.values() if b)
keys|={('rios',4,'0','nub')}
# variantes de Paz y Ríos sin veto, para la prueba de Nubarrones
keys|={k[:-1]+(None,) for k in list(keys) if k[0] in ('paz','rios') and k[-1]=='nub'}
R={}
for k in sorted(keys,key=str):
    a=k[0]
    if a=='vega': g,T=G[k[3]]; R[k]=wf2.run(S.vega,g,T,None,k[4],n=k[1],k=k[2],shorts=1,mom=1)
    elif a=='ortega': g,T=G[k[3]]; R[k]=wf2.run(S.ortega2,g,T,None,k[4],N=k[1],k=k[2],shorts=1,reg=50)
    elif a=='paz':
        g,T=G[k[3]]; filt=wf3.nubf(wf2.f if k[4] else None) if k[5]=='nub' else (wf2.f if k[4] else None)
        R[k]=wf2.run(PZ.paz3,g,T,filt,None if k[5]=='nub' else k[5],rsi_lo=k[1],reg=50,shorts=1,maxh=96,tk=5,en=50,k=k[2])
    elif a=='rios':
        g,T=G[k[2]]
        if len(k)==6: R[k]=wf2.run(S.rios2,g,T,collab.fund_ok(k[4],k[5]),None,q=0.2,vm=1.0,k=k[1],reg=50,shorts=1)
        else: R[k]=wf2.run(S.rios2,g,T,wf3.nubf(None) if k[3]=='nub' else None,None if k[3]=='nub' else k[3],q=0.2,vm=1.0,k=k[1],reg=50,shorts=1)
    elif a=='funding': g,T=G[k[5]]; S.sim=wf2.mk(g,T); R[k]=FS.squeeze(k[1],k[2],k[3],k[4])
    old=wf4b.wf4.C.get(k)
    same = old is not None and len(old)==len(R[k]) and abs(sum(x[2] for x in old)-sum(x[2] for x in R[k]))<1e-6
    print(k,len(R[k]),'idéntica' if same else ('NUEVA' if old is None else f'DIFIERE {len(old)} {sum(x[2] for x in old):.2f} vs {sum(x[2] for x in R[k]):.2f}'),flush=True)
pickle.dump(R,open(engine.D+'regen.pkl','wb'))

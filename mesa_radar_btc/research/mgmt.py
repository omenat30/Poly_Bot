# Gestión de la salida en horario de oficina: parcial a +T R (orden límite 24 h) y stop a break-even tras +B R (solo se mueve en horario)
import numpy as np, engine
from engine import H, FEE, STOPSLIP
M=np.load(engine.D+'office_mask.npy')
def sim_m(sigs, trail=None, exit_mask=None, mask=M, tp=None, f=0.5, be=None, beoff=0.2):
    h,l,o,c,t=H['h'],H['l'],H['o'],H['c'],H['t']; N=len(t); out=[]; busy=-1
    for (i,side,stop,tgt,maxh) in sigs:
        if i<=busy or i+1>=N: continue
        j0=i+1
        while j0<N and not mask[j0]: j0+=1
        if j0>=N or j0-i>14: continue
        dist=abs(c[i]-stop); e=o[j0]; sl=e-side*dist
        tg=np.nan if tgt!=tgt else e+side*abs(tgt-c[i])
        risk=dist; j=j0; end=min(N-1,i+maxh); px=None; why=None; best=e
        part=0.0; booked=0.0; beOn=False; armBE=False
        while j<=end:
            if (l[j]<=sl if side==1 else h[j]>=sl): px=sl; why='stop'; break
            if tp and part==0 and (h[j]>=e+side*tp*risk if side==1 else l[j]<=e+side*tp*risk): part=f; booked=f*tp
            if tg==tg and (h[j]>=tg if side==1 else l[j]<=tg): px=tg; why='target'; break
            if exit_mask is not None and exit_mask[side][j] and j<end:
                k2=j+1
                while k2<N and not mask[k2]: k2+=1
                if k2<N: px=o[k2]; why='senal'; j=k2; break
            best=max(best,h[j]) if side==1 else min(best,l[j])
            if be and not beOn and (best-e)*side>=be*risk: armBE=True
            if mask[j]:
                if armBE and not beOn: beOn=True; sl=max(sl,e+beoff*risk) if side==1 else min(sl,e-beoff*risk)
                if trail is not None:
                    k,A=trail; sl=max(sl,best-k*A[j]) if side==1 else min(sl,best+k*A[j])
            j+=1
        if px is None: j=min(j,end); px=c[j]; why='tiempo'
        cost=(FEE+(STOPSLIP*(1-part) if why=='stop' else 0))*e
        r=booked+(1-part)*(px-e)*side/risk-cost/risk
        out.append((t[i]+3600, side, r, why, t[j], e, sl, 0))
        busy=j
    return out

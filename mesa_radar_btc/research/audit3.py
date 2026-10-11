import numpy as np, json, pickle, math
from audit_base import *
from scipy_free import norm_ppf, norm_cdf
Z=stream_full(); L=run_log(Z); S=summ(L); out={}
t=H['t']; c=H['c']
# --- 1) funding de los perpetuos (el backtest es spot) ---
exec(open('funding.py').read().split("if __name__")[0])   # ft, fr: liquidaciones de Binance 2019-26
def entry_t(z): return z[9]
def _unused(z):
    e0=entry_t(z); m=(ft>e0)&(ft<=z[1]); return z[4]*fr[m].sum()/z[6] if z[6]==z[6] and z[6]>0 else 0.0
DFm={a:np.nanmedian([z[6] for z in Z if z[3]==a]) for a in AGS}
DF=np.array([z[6] if z[6]==z[6] and z[6]>0 else DFm[z[3]] for z in Z]); out['dist_stop_mediana_%']={a:round(float(v*100),2) for a,v in DFm.items()}; out['sin_distancia']=int(sum(1 for z in Z if not z[6]==z[6]))
FC=np.array([z[4]*fr[(ft>z[9])&(ft<=z[1])].sum()/DF[k] for k,z in enumerate(Z)]); out['funding_R_medio']=round(float(FC.mean()),4); out['funding_R_total_sin_ponderar']=round(float(FC.sum()),1)
out['funding_por_agente']={a:round(float(np.mean([f for f,z in zip(FC,Z) if z[3]==a])),4) for a in AGS}
def with_adj(adj):
    Z2=[z[:2]+(z[2]-a,)+z[3:] for z,a in zip(Z,adj)]; return summ(run_log(Z2))
s=with_adj(FC); out['con_funding']={k:round(v,2) for k,v in s.items()}
# --- 2) costes: comisión extra de ida y vuelta (en % del precio) ---
for extra in (0.0004,0.0010,0.0020):
    s=with_adj(FC+extra/DF); out[f'coste_extra_{extra*100:.2f}%']={k:round(v,2) for k,v in s.items()}
# --- 3) retraso de ejecución manual: precio 15/30/60 min después de la apertura de entrada (velas de 15 min) ---
M=dict(np.load(engine.D+'m15.npz'))
def px_at(T): j=np.searchsorted(M['t'],T); return M['o'][min(j,len(M['t'])-1)]
for d in (15,30,60):
    adj=np.array([z[4]*(px_at(entry_t(z)+d*60)-px_at(entry_t(z)))/px_at(entry_t(z))/DF[k] for k,z in enumerate(Z)])
    out[f'retraso_{d}min_R_medio']=round(float(adj.mean()),4)
    s=with_adj(FC+adj); out[f'retraso_{d}min_cartera']={k:round(v,2) for k,v in s.items()}
# --- 4) t con dependencia (Newey-West) y bootstrap por bloques del P&L diario ---
dpl=daily(L); T_=len(dpl)
def nw_t(x,lag=10):
    x=x-x.mean(); g=[(x[:len(x)-k]*x[k:]).sum()/len(x) for k in range(lag+1)]; v=g[0]+2*sum((1-k/(lag+1))*g[k] for k in range(1,lag+1)); return x.size and (dpl.mean()/math.sqrt(v/len(dpl)))
out['t_iid_diaria']=round(float(dpl.mean()/dpl.std()*math.sqrt(T_)),2); out['t_newey_west_10']=round(float(nw_t(dpl)),2)
rng=np.random.default_rng(7)
def sboot(n, p=1/20):   # bootstrap estacionario (Politis-Romano), bloque medio 20 días
    idx=np.empty(n,int); i=rng.integers(n)
    for k in range(n):
        idx[k]=i; i= rng.integers(n) if rng.random()<p else (i+1)%n
    return idx
B=2000; Ry_b=np.array([dpl[sboot(T_)].sum()/YRS for _ in range(B)])
out['bootstrap_Ry']=dict(p5=round(float(np.percentile(Ry_b,5)),1),p50=round(float(np.percentile(Ry_b,50)),1),p95=round(float(np.percentile(Ry_b,95)),1),prob_neg=round(float((Ry_b<0).mean()),4))
rec=dpl[-(END-ts(2024))//86400:]; Rr=np.array([rec[sboot(len(rec))].sum()/((END-ts(2024))/31557600) for _ in range(B)])
out['bootstrap_Ry_2024_26']=dict(media=round(float(rec.sum()/((END-ts(2024))/31557600)),1),p5=round(float(np.percentile(Rr,5)),1),p95=round(float(np.percentile(Rr,95)),1),prob_neg=round(float((Rr<0).mean()),3))
# --- 5) universo de pruebas: todas las variantes guardadas, P&L diario 2020-26 ---
CAND={}
for f in ['wf_cands','wf2_cands','wf3_cands','fund_cands','collab_cands','nub_cands']:
    for k,v in pickle.load(open(engine.D+f+'.pkl','rb')).items(): CAND[(f,)+tuple(map(str,k))]=v
uniq={}
for k,v in CAND.items():
    sig=(len(v), round(sum(x[2] for x in v),6))
    uniq.setdefault(sig,(k,v))
d0=ts(2020)//86400
def dser(T):
    v=np.zeros(T_); 
    for x in T:
        if x[4]>=ts(2020): v[min(T_-1,int(x[4])//86400-d0)]+=x[2]
    return v
X=np.array([dser(v) for k,v in uniq.values()]); X=X[X.std(1)>0]
out['variantes_guardadas']=len(CAND); out['variantes_distintas']=int(X.shape[0])
SRk=X.mean(1)/X.std(1); out['SR_diario_variantes']=dict(media=round(float(SRk.mean()),4),sd=round(float(SRk.std()),4),max=round(float(SRk.max()),4))
# --- 6) Deflated Sharpe Ratio (Bailey y López de Prado 2014) de la cartera ---
def psr(x, sr0):
    sr=x.mean()/x.std(); g3=((x-x.mean())**3).mean()/x.std()**3; g4=((x-x.mean())**4).mean()/x.std()**4
    return norm_cdf((sr-sr0)*math.sqrt(len(x)-1)/math.sqrt(1-g3*sr+(g4-1)/4*sr**2)), sr, g3, g4
EG=0.5772156649
dsr={}
for N in (500,2500,10000):
    sr0=SRk.std()*((1-EG)*norm_ppf(1-1/N)+EG*norm_ppf(1-1/(N*math.e)))
    p,sr,g3,g4=psr(dpl,sr0); dsr[N]=dict(SR0_diario=round(sr0,4),DSR=round(p,3))
out['DSR']=dsr; out['SR_cartera_diario']=round(float(dpl.mean()/dpl.std()),4); out['SR_cartera_anual']=round(float(dpl.mean()/dpl.std()*math.sqrt(365)),2); out['asimetria']=round(g3,2); out['curtosis']=round(g4,1)
# --- 7) Reality Check de White / SPA de Hansen sobre el universo de variantes (bootstrap estacionario) ---
mu=X.mean(1); sd=X.std(1); Tn=X.shape[1]; stat=np.max(np.sqrt(Tn)*mu/sd)
thr=-np.sqrt(2*np.log(np.log(Tn)))*sd/np.sqrt(Tn)
cen_rc=mu; cen_spa=np.where(mu>=thr, mu, 0.0)
bs_rc=[]; bs_spa=[]
for b in range(500):
    ix=sboot(Tn); mb=X[:,ix].mean(1)
    bs_rc.append(np.max(np.sqrt(Tn)*(mb-cen_rc)/sd)); bs_spa.append(np.max(np.sqrt(Tn)*(mb-cen_spa)/sd))
out['RC_estadistico']=round(float(stat),2); out['RC_p']=round(float(np.mean(np.array(bs_rc)>=stat)),3); out['SPA_p']=round(float(np.mean(np.array(bs_spa)>=stat)),3)
# p de la cartera walk-forward (media > 0) con bootstrap por bloques
bm=np.array([dpl[sboot(T_)].mean()-dpl.mean() for _ in range(2000)]); out['p_cartera_wf']=round(float(np.mean(bm>=dpl.mean())),4)
json.dump(out,open(engine.D+'../audit/a3.json','w'),indent=1,default=str)
for k,v in out.items(): print(k,v)
# --- 8) robustez semanal de DSR y SPA ---
nw_=T_//7; Xw=X[:,:nw_*7].reshape(X.shape[0],nw_,7).sum(2); dw=dpl[:nw_*7].reshape(nw_,7).sum(1)
SRw=Xw.mean(1)/Xw.std(1); w={}
for N in (100,500,2500):
    sr0=SRw.std()*((1-EG)*norm_ppf(1-1/N)+EG*norm_ppf(1-1/(N*math.e))); p,sr,g3,g4=psr(dw,sr0); w[N]=dict(SR0=round(sr0,3),DSR=round(p,3))
mu=Xw.mean(1); sd=Xw.std(1); Tn=Xw.shape[1]; stat=np.max(np.sqrt(Tn)*mu/sd); thr=-np.sqrt(2*np.log(np.log(Tn)))*sd/np.sqrt(Tn); cen=np.where(mu>=thr,mu,0)
bs=[];bs2=[]
for b in range(1000):
    ix=sboot(Tn,1/4); mb=Xw[:,ix].mean(1); bs.append(np.max(np.sqrt(Tn)*(mb-mu)/sd)); bs2.append(np.max(np.sqrt(Tn)*(mb-cen)/sd))
out['semanal']=dict(SR_cartera=round(float(dw.mean()/dw.std()),3),SR_anual=round(float(dw.mean()/dw.std()*math.sqrt(52)),2),asim=round(float(g3),2),SR_variantes_sd=round(float(SRw.std()),3),SR_max=round(float(SRw.max()),3),DSR=w,RC_p=round(float(np.mean(np.array(bs)>=stat)),3),SPA_p=round(float(np.mean(np.array(bs2)>=stat)),3))
json.dump(out,open(engine.D+'../audit/a3.json','w'),indent=1,default=str); print('semanal',out['semanal'])

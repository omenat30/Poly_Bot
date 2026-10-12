import numpy as np, json
from audit_base import *
Z=stream_full(); L=run_log(Z); S=summ(L)
out={}
# 1) reconciliación
st={}; 
for l in L: st[l['st']]=st.get(l['st'],0)+1
tk=[l for l in L if l['w']>0]
raw=sum(z[2] for z in Z); unw_t=sum(l['r'] for l in tk); w_nobrake=sum(l['r']*BASE[l['a']] for l in tk)
out['recon']=dict(senales=len(Z), estados=st, tomadas=len(tk), anos=round(YRS,3),
  R_todas_senales_sin_ponderar=round(raw,1), R_medio_senal=round(raw/len(Z),3),
  R_tomadas_sin_ponderar=round(unw_t,1), R_medio_tomada=round(unw_t/len(tk),3),
  R_tomadas_peso_base=round(w_nobrake,1), R_cartera_final=round(S['tot'],1), R_medio_cartera_por_op=round(S['tot']/len(tk),3),
  Ry=round(S['Ry'],2), dd=round(S['dd'],2), frenadas=sum(1 for l in tk if l['brake']))
# efecto de cada capa
for lab,kw in [('sin_gestor',dict(cap=None,ddth=None)),('solo_tope',dict(ddth=None)),('solo_freno',dict(cap=None)),('peso1_sin_gestor',dict(base={a:1 for a in AGS},cap=None,ddth=None))]:
    s=summ(run_log(Z,**{**dict(base=BASE,cap=2.0,ddth=(8,0.5)),**kw})); out['capa_'+lab]={k:round(v,3) for k,v in s.items()}
# 2) por agente y año (todas las señales, sin ponderar)
pa={}
for a in AGS:
    pa[a]={}
    for y in range(2020,2027):
        r=np.array([z[2] for z in Z if z[3]==a and ts(y)<=z[0]<ts(y+1)])
        pa[a][y]=dict(n=len(r),win=round(float(np.mean(r>0)),2) if len(r) else None,exp=round(float(r.mean()),2) if len(r) else None,tot=round(float(r.sum()),1))
    pa[a]['variantes']={y:(str(SEL[y][a][0]) if SEL[y].get(a) else None) for y in range(2020,2027)}
out['por_agente_ano']=pa
json.dump(out,open(engine.D+'../audit/a1.json','w'),indent=1,default=str)
import pprint; pprint.pprint(out['recon']); 
for k in out:
    if k.startswith('capa'): print(k,out[k])
for a in AGS: print(a,{y:(v['n'],v['exp'],v['tot']) for y,v in pa[a].items() if y!='variantes'}); print('  ',pa[a]['variantes'])

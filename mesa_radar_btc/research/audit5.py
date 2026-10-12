import numpy as np, json
exec(open('audit4.py').read().split('# 1) reglas')[0])
exec(open('audit4.py').read().split('# 2) regla de selección: sensibilidad (no se elige la mejor; se informa)')[1].split('REGEN_=REGEN')[0])
res={}
V10={'vega':0.75,'ortega':1.0,'paz':0.5,'rios':0.0,'funding':0.0}
def port(Z, base, cap=2.0, ddth=(8,0.5)):
    Z=[z for z in Z if base.get(z[3],0)>0]; L=run_log(Z,base=base,cap=cap,ddth=ddth); s=summ(L)
    py={y:round(sum(l['r']*l['w'] for l in L if ts(y)<=l['t0']<ts(y+1)),1) for y in range(2020,2027)}
    pa={a:round(sum(l['r']*l['w'] for l in L if l['a']==a)/YRS,1) for a in base if base[a]>0}
    return dict({k:round(v,2) for k,v in s.items()},por_ano=py,por_agente=pa)
Zv9=with_fund(stream_full()); res['v9_con_funding']=port(Zv9,BASE)
res['v10_seleccion_actual']=port(Zv9,V10)
selA={y:chooseX(ts(y),act=(6,2)) for y in Wm.yrs}; ZA=with_fund(stream_full(selA))
res['v10_seleccion_con_actividad']=port(ZA,V10)
DFm_={a:np.nanmedian([z[6] for z in ZA if z[3]==a]) for a in AGS}
ZAc=[z[:2]+(z[2]-0.0004/(z[6] if z[6]==z[6] and z[6]>0 else DFm_[z[3]]),)+z[3:] for z in ZA]
res['v10_actividad_coste_extra_0.04%']=port(ZAc,V10)
json.dump(res,open(engine.D+'../audit/a5.json','w'),indent=1,default=str)
for k,v in res.items(): print(k,v)

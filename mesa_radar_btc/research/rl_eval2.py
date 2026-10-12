exec(open('rl_eval.py').read().split('CF={}')[0])
keep=lambda x:x['office'] and pazv(x) and not (x['q']==x['q'] and x['q']<0.2)
sz=lambda x:1.0 if x['q']!=x['q'] else 0.5+x['q']
OV=[m for m in mesaL if m[4] in ('ortega','vega')]
CF={'Radar 24/7 (papel)':radar(lambda x:True),'Radar horario real (L-V 7-22)':radar(radar_live),
 'G1 filtro 20% + tamaño':radar(keep,w=sz),'G2 filtro 20% + Ortega/Vega':radar(keep)+OV,'G3 filtro 20% + tamaño + Ortega/Vega':radar(keep,w=sz)+OV,
 'G4 tamaño + Ortega/Vega':radar(lambda x:x['office'] and pazv(x),w=sz)+OV,'G5 filtro 20% + tamaño + v10 completa':radar(keep,w=sz)+mesaL}
for per,(a,b) in [('2018-21 (elección)',(ts(2018),ts(2022))),('2022-26 (prueba)',(ts(2022),END_)),('2020-26',(ts(2020),END_))]:
    print('=====',per)
    for k,v in CF.items():
        s=port(v,a,b); print(f'{k:40s} n/sem={s["sem"]:.2f} win={s["win"]:.3f} R/op={s["Rop"]:+.3f} cart/op={s["Rop_cart"]:+.3f} R/año={s["Ry"]:+.1f} caída={s["dd"]:.1f} Sharpe={s["SR"]:.2f}', s['py'] if per=='2020-26' else '')

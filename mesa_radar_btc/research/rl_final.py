exec(open('rl_eval.py').read().split('CF={}')[0])
OV=[m for m in mesaL if m[4] in ('ortega','vega')]
half=[(a,b,c,d*0.5,e) for a,b,c,d,e in OV]
CF={'Radar 24/7 (papel)':radar(lambda x:True),'Radar horario real (L-V 7-22)':radar(radar_live),
 'H1 Oficina 7-22 + veto Paz':radar(lambda x:radar_live(x) and pazv(x)),
 'H2 H1 + Ortega/Vega propios (v10)':radar(lambda x:radar_live(x) and pazv(x))+OV,
 'H3 H1 + Ortega/Vega propios a mitad':radar(lambda x:radar_live(x) and pazv(x))+half,
 'H4 24/7 + veto Paz':radar(pazv)}
for per,(a,b) in [('2018-21 (elección)',(ts(2018),ts(2022))),('2022-26 (prueba)',(ts(2022),END_)),('2020-26',(ts(2020),END_))]:
    print('=====',per)
    for k,v in CF.items():
        s=port(v,a,b); print(f'{k:38s} n/sem={s["sem"]:.2f} win={s["win"]:.3f} R/op={s["Rop"]:+.3f} cart/op={s["Rop_cart"]:+.3f} R/año={s["Ry"]:+.1f} caída={s["dd"]:.1f} Sharpe={s["SR"]:.2f}', s['py'] if per=='2020-26' else '')

exec(open('v12_eval.py').read().split("CF={'v10':mesa}")[0])
RU={int(d['sigT']):d['ru'] for d in json.load(open(engine.D+'mx_ru.json'))}
EXf=[x for x in EX if RU.get(int(x['sigT']),np.nan)==RU.get(int(x['sigT']),np.nan) and RU[int(x['sigT'])]<0.8]
for a in V10:
    for per,(lo,hi) in (('18-21',(ts(2018),ts(2022))),('22-26',(ts(2022),END))):
        r=np.array([z[2] for z in Zm if z[3]==a and lo<=z[0]<hi]); print(a,per,'n',len(r),'win',round(float((r>0).mean()),3),'R/op',round(float(r.mean()),3))
ap=lambda w,S=EXf:[(int(x['sigT']),int(x['exitT']),x['rn'],w,'aprendiz') for x in S]
mesaNoPaz=[m for m in mesa if m[4]!='paz']
CF={'v10':mesa,'v12a: v10 + aprendiz <0,8R 0,5R':mesa+ap(0.5),'v12b: v10 + aprendiz <0,8R 1R':mesa+ap(1.0),
    'v12c: Ortega+Vega + aprendiz 1R (Paz propia a sombra)':mesaNoPaz+ap(1.0),'v12d: Ortega+Vega + aprendiz 0,5R':mesaNoPaz+ap(0.5)}
for per,(a,b) in [('2018-21',(ts(2018),ts(2022))),('2022-26',(ts(2022),END)),('2020-26',(ts(2020),END))]:
    print('=====',per)
    for k,v in CF.items():
        s=port(v,a,b); print(f'{k:52s} n/sem={s["sem"]:.2f} win={s["win"]:.3f} R/op={s["Rop"]:+.3f} cart/op={s["cop"]:+.3f} R/año={s["Ry"]:+.1f} caída={s["dd"]:.1f} Sharpe={s["SR"]:.2f}', s['py'] if per=='2020-26' else '')

exec(open('v12_eval2.py').read().split("for a in V10:")[0])
ap=lambda w,S=EXf:[(int(x['sigT']),int(x['exitT']),x['rn'],w,'aprendiz') for x in S]
def mw(wv):
    return [(m[0],m[1],m[2],wv if m[4]=='vega' else m[3],m[4]) for m in mesa if not (m[4]=='vega' and wv==0)]
CF={'v10':mesa,'v12a: v10 + aprendiz 0,5R':mesa+ap(0.5),'v12e: Vega a sombra + aprendiz 0,5R':mw(0)+ap(0.5),'v12f: Vega 0,375R + aprendiz 0,5R':mw(0.375)+ap(0.5),'v12g: Vega a sombra + aprendiz 1R':mw(0)+ap(1.0)}
for per,(a,b) in [('2018-21',(ts(2018),ts(2022))),('2022-26',(ts(2022),END)),('2020-26',(ts(2020),END))]:
    print('=====',per)
    for k,v in CF.items():
        s=port(v,a,b); print(f'{k:40s} n/sem={s["sem"]:.2f} win={s["win"]:.3f} R/op={s["Rop"]:+.3f} cart/op={s["cop"]:+.3f} R/año={s["Ry"]:+.1f} caída={s["dd"]:.1f} Sharpe={s["SR"]:.2f}', s['py'] if per=='2020-26' else '')

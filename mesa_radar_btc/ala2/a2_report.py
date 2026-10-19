# Ala 2 · cifras del backtest para el informe de competición del panel (antes y después de costes, por régimen y año a año)
import numpy as np, json, a2_eval5 as E
L = E.L; costL, costS = L['costL'], L['costS']; Q = E.Q
X = np.fromfile(E.D + 'feat5.bin', dtype=np.float64).reshape(len(E.td), 40)
names = [l.strip().strip("'") for l in open('/home/user/Poly_Bot/mesa_radar_btc/office/ala2_feat.js').read().split('const NAMES = [')[1].split('];')[0].replace('\n', ' ').split(',')]
vr, d50 = X[:, names.index('tec_volreg')], X[:, names.index('tec_d50')]
def stats(tk, a, b):
    s = E.st(tk, a, b)
    if not s: return None
    cost = np.array([(costL if x[4] == 1 else costS)[x[6]] for x in tk]); r = np.array([x[2] for x in tk])
    return dict(n=s['n'], sem=round(s['sem'], 2), win=round(s['win'], 3), rop=round(s['rop'], 3), ropBruto=round(float((r + cost).mean()), 3), costeOp=round(float(cost.mean()), 3), payoff=round(s['payoff'], 2), pf=round(s['pf'], 2), ry=round(s['ry'], 1), sh=round(s['sh'], 2), dd=round(s['dd'], 1), ev=round(s['evp'], 3))
OUT = {}
for key, agg, thr in (('campeon', 'avg', 0.05), ('retador', 'dir', -9)):
    a, b = E.ts(2022), E.END; tk = E.run(agg, thr, a, b); o = dict(p1822=stats(E.run(agg, thr, E.ts(2018), E.ts(2022)), E.ts(2018), E.ts(2022)), p2226=stats(tk, a, b), años={}, regimen={})
    for y in range(2018, 2027):
        t2 = E.run(agg, thr, E.ts(y), E.ts(y + 1)); s = stats(t2, E.ts(y), min(E.ts(y + 1), E.END)); o['años'][y] = s and dict(n=s['n'], win=s['win'], rop=s['rop'], ry=s['ry'])
    for nm, f in (('volátil', lambda i: vr[i] > 1.3), ('normal', lambda i: 0.8 <= vr[i] <= 1.3), ('tranquilo', lambda i: vr[i] < 0.8), ('sobre SMA50', lambda i: d50[i] >= 0), ('bajo SMA50', lambda i: d50[i] < 0)):
        sub = [x for x in tk if f(x[6])]; r = np.array([x[2] for x in sub])
        o['regimen'][nm] = dict(n=len(sub), win=round(float((r > 0).mean()), 3) if len(r) else None, rop=round(float(r.mean()), 3) if len(r) else None)
    OUT[key] = o
OUT['nota'] = 'Walk-forward mensual 2018-2026 (106 versiones), elegido con 2018-21 y probado en 2022-26 sin tocar. Costes 0,14% + 0,03% en stops + funding. Entrada a los 5 min de la decisión.'
json.dump(OUT, open('/home/user/Poly_Bot/mesa_radar_btc/page/ala2_backtest.json', 'w'), ensure_ascii=False)
print(json.dumps({k: (v['p1822'], v['p2226'], v['regimen']) for k, v in OUT.items() if k != 'nota'}, ensure_ascii=False, indent=0)[:2500])

# Ala 2 (v2, velas de 5 min) · walk-forward mensual versionado + calibración de Beltrán.
# Montes (liquidez) y Aranda (técnico) predicen el R neto de un largo y de un corto con su familia de variables (+ régimen);
# Lagos (director) combina sus predicciones FUERA DE MUESTRA con el régimen. Cada mes solo se entrena con operaciones ya cerradas antes del día 1.
# Beltrán calibra: regresión isotónica del R realizado (y del acierto) frente a la predicción, con los últimos 6-24 meses fuera de muestra.
import numpy as np, lightgbm as lgb, datetime as dt, pickle, sys, json
from sklearn.isotonic import IsotonicRegression
D = '/tmp/claude-0/-home-user-Poly-Bot/62062f9b-9ffe-50c1-8835-98e9f5ba9b0f/scratchpad/ala2/'
L = np.load(D + 'a2_lab5.npz'); td = L['td']; NC = 40
names = [l.strip().strip("'") for l in open('/home/user/Poly_Bot/mesa_radar_btc/office/ala2_feat.js').read().split('const NAMES = [')[1].split('];')[0].replace('\n', ' ').split(',')]
X = np.fromfile(D + 'feat5.bin', dtype=np.float64).reshape(len(td), NC)[:, :38].astype(np.float32)
fam = [n[:3] for n in names]; assert len(names) == 38
rL, rS, texL, texS = L['rL'], L['rS'], L['texL'], L['texS']
ix = lambda f: [i for i, x in enumerate(fam) if x == f]
LIQ, TEC, REG = ix('liq') + ix('reg'), ix('tec') + ix('reg'), ix('reg')
P = dict(objective='regression', learning_rate=0.04, num_leaves=15, min_data_in_leaf=300, feature_fraction=0.7, bagging_fraction=0.7, bagging_freq=1, lambda_l2=20, verbose=-1, num_threads=4, seed=7, deterministic=True)
PD = dict(P, num_leaves=7, min_data_in_leaf=500)
ms = lambda y, m: int(dt.datetime(y, m, 1, tzinfo=dt.timezone.utc).timestamp())
def dcols(O, i=None):
    cols = [O['liqL'], O['liqS'], O['tecL'], O['tecS'], X[:, REG[0]], X[:, REG[1]], X[:, names.index('tec_volreg')], X[:, names.index('tec_d50')]]
    return np.column_stack(cols)
step = 3; base = (np.arange(len(td)) % step == 0) & (td >= ms(2016, 3))
def train_all(lo, te=None):
    """Entrena los 6 modelos con lo cerrado antes de lo. Devuelve los modelos."""
    w = 0.5 ** ((lo - td) / (2 * 31557600)); M = {}
    for nm, cols in (('liq', LIQ), ('tec', TEC)):
        for side, r, tex in (('L', rL, texL), ('S', rS, texS)):
            tr = base & (tex < lo) & (tex > 0) & np.isfinite(r)
            M[nm + side] = lgb.train(P, lgb.Dataset(X[tr][:, cols], np.clip(r[tr], -1.5, 1.6), weight=w[tr]), 250)
    return M, w
if __name__ == '__main__':
    months = [(y, m) for y in range(2018, 2027) for m in range(1, 13) if ms(y, m) < td[-1]]
    OOS = {k: np.full(len(td), np.nan) for k in ('liqL', 'liqS', 'tecL', 'tecS', 'dirL', 'dirS')}
    for y, m in months:
        lo = ms(y, m); hi = ms(y + (m == 12), m % 12 + 1); te = (td >= lo) & (td < hi)
        if not te.any(): continue
        M, w = train_all(lo)
        for k, cols in (('liqL', LIQ), ('liqS', LIQ), ('tecL', TEC), ('tecS', TEC)): OOS[k][te] = M[k].predict(X[te][:, cols])
        Dm = dcols(OOS)
        for side, r, tex in (('L', rL, texL), ('S', rS, texS)):
            tr = base & (tex < lo) & (tex > 0) & np.isfinite(r) & np.isfinite(OOS['liqL']) & np.isfinite(OOS['tecL'])
            if tr.sum() > 5000: OOS['dir' + side][te] = lgb.train(PD, lgb.Dataset(Dm[tr], np.clip(r[tr], -1.5, 1.6), weight=w[tr]), 150).predict(Dm[te])
        print(f'{y}-{m:02d}', end=' ', flush=True)
    # calibración de Beltrán, mes a mes, con lo fuera de muestra ya cerrado (6-24 meses)
    CAL = {f'{a}{s}{k}': np.full(len(td), np.nan) for a in ('dir', 'avg') for s in 'LS' for k in ('ev', 'pw')}
    for y, m in months:
        lo = ms(y, m); hi = ms(y + (m == 12), m % 12 + 1); te = (td >= lo) & (td < hi)
        for a in ('dir', 'avg'):
            for s, r, tex in (('L', rL, texL), ('S', rS, texS)):
                p = OOS['dir' + s] if a == 'dir' else (OOS['liq' + s] + OOS['tec' + s]) / 2
                cw = (td >= lo - 2 * 31557600) & (tex < lo) & (tex > 0) & np.isfinite(p) & np.isfinite(r)
                if cw.sum() == 0 or td[cw].min() > lo - 0.5 * 31557600: continue
                ok = te & np.isfinite(p)
                CAL[f'{a}{s}ev'][ok] = IsotonicRegression(out_of_bounds='clip').fit(p[cw], r[cw]).predict(p[ok])
                CAL[f'{a}{s}pw'][ok] = IsotonicRegression(out_of_bounds='clip', y_min=0, y_max=1).fit(p[cw], (r[cw] > 0).astype(float)).predict(p[ok])
    pickle.dump(dict(OOS=OOS, CAL=CAL), open(D + 'a2_oos5.pkl', 'wb')); print('\nok')

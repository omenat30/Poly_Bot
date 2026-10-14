# Segunda ala · aprendizaje walk-forward mensual (versionado). Montes (liquidez) y Aranda (técnico) predicen el R neto de un largo y de un corto
# con su propia familia de variables; Lagos (director) aprende a combinarlos con las predicciones FUERA DE MUESTRA de ambos + régimen.
# Cada mes: se entrena solo con decisiones cuya operación ya se cerró antes del 1 del mes; peso por recencia (vida media 2 años).
import numpy as np, lightgbm as lgb, datetime as dt, pickle, sys
Z = np.load('a2_bank.npz'); X = Z['X']; names = list(Z['names']); fam = list(Z['fam']); td = Z['td']
rL, rS, texL, texS = Z['rL'], Z['rS'], Z['texL'], Z['texS']
ix = lambda f: [i for i, x in enumerate(fam) if x == f]
LIQ, TEC, REG = ix('liq'), ix('tec'), ix('reg')
P = dict(objective='regression', learning_rate=0.04, num_leaves=15, min_data_in_leaf=300, feature_fraction=0.7, bagging_fraction=0.7, bagging_freq=1, lambda_l2=20, verbose=-1, num_threads=4)
def ms(y, m): return int(dt.datetime(y, m, 1, tzinfo=dt.timezone.utc).timestamp())
months = [(y, m) for y in range(2018, 2027) for m in range(1, 13) if ms(y, m) < td[-1]]
OOS = {k: np.full(len(td), np.nan) for k in ('liqL', 'liqS', 'tecL', 'tecS', 'dirL', 'dirS')}
VERS = []
step = 3   # una de cada 3 decisiones (30 min) para entrenar: menos solape entre etiquetas
for y, m in months:
    lo = ms(y, m); hi = ms(y + (m == 12), m % 12 + 1)
    te = (td >= lo) & (td < hi)
    if not te.any(): continue
    base = (np.arange(len(td)) % step == 0) & (td >= ms(2016, 3))
    w_all = 0.5 ** ((lo - td) / (2 * 31557600))
    for nm, cols in (('liq', LIQ), ('tec', TEC)):
        for side, r, tex in (('L', rL, texL), ('S', rS, texS)):
            tr = base & (tex < lo) & np.isfinite(r)
            mdl = lgb.train(P, lgb.Dataset(X[tr][:, cols], np.clip(r[tr], -1.5, 1.6), weight=w_all[tr]), 250)
            OOS[nm + side][te] = mdl.predict(X[te][:, cols])
    # director: aprende de las predicciones fuera de muestra ya disponibles (desde 2018) + régimen
    for side, r, tex in (('L', rL, texL), ('S', rS, texS)):
        D = np.column_stack([OOS['liqL'], OOS['liqS'], OOS['tecL'], OOS['tecS'], X[:, REG], X[:, names.index('tec_volreg')], X[:, names.index('tec_d50')]])
        tr = base & (tex < lo) & np.isfinite(r) & np.isfinite(OOS['liqL']) & np.isfinite(OOS['tecL'])
        if tr.sum() > 5000:
            mdl = lgb.train(dict(P, num_leaves=7, min_data_in_leaf=500), lgb.Dataset(D[tr], np.clip(r[tr], -1.5, 1.6), weight=w_all[tr]), 150)
            OOS['dir' + side][te] = mdl.predict(D[te])
    VERS.append(dict(v=f'ala2-{y}{m:02d}', desde=lo, entreno_hasta=lo))
    print(f'{y}-{m:02d}', flush=True, end=' ')
pickle.dump(dict(OOS=OOS, VERS=VERS), open('a2_oos.pkl', 'wb')); print('\nok')

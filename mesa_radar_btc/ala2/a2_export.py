# Ala 2 · exporta una versión de los modelos para la oficina (JSON compacto que lee office/ala2_model.js) y un caso de paridad Python/JS.
# Uso: python3 a2_export.py AAAA MM  -> versión ala2-AAAAMM entrenada con todo lo cerrado antes del día 1 de ese mes.
import numpy as np, lightgbm as lgb, pickle, json, sys
from sklearn.isotonic import IsotonicRegression
sys.argv += [] ; import a2_ml5 as B
y, m = int(sys.argv[1]), int(sys.argv[2]); lo = B.ms(y, m); ver = f'ala2-{y}{m:02d}'
Q = pickle.load(open(B.D + 'a2_oos5.pkl', 'rb')); OOS = Q['OOS']
M, w = B.train_all(lo)
Dm = B.dcols(OOS)
for side, r, tex in (('L', B.rL, B.texL), ('S', B.rS, B.texS)):
    tr = B.base & (tex < lo) & (tex > 0) & np.isfinite(r) & np.isfinite(OOS['liqL']) & np.isfinite(OOS['tecL'])
    M['dir' + side] = lgb.train(B.PD, lgb.Dataset(Dm[tr], np.clip(r[tr], -1.5, 1.6), weight=w[tr]), 150)
def conv(b):
    trees = []
    for ti in b.dump_model()['tree_info']:
        T = dict(f=[], th=[], dl=[], mt=[], lc=[], rc=[], lv=[])
        def walk(nd):
            if 'leaf_value' in nd: T['lv'].append(nd['leaf_value']); return ~(len(T['lv']) - 1)
            k = len(T['f']); [T[a].append(0) for a in ('f', 'th', 'dl', 'mt', 'lc', 'rc')]
            T['f'][k] = nd['split_feature']; T['th'][k] = nd['threshold']; T['dl'][k] = 1 if nd['default_left'] else 0
            T['mt'][k] = {'None': 0, 'Zero': 1, 'NaN': 2}[nd['missing_type']]; assert nd['decision_type'] == '<='
            T['lc'][k] = walk(nd['left_child']); T['rc'][k] = walk(nd['right_child']); return k
        root = ti['tree_structure']
        if 'leaf_value' in root: T['lv'] = [root['leaf_value']]
        else: walk(root)
        trees.append(T)
    return dict(trees=trees)
cal = {}
for a in ('dir', 'avg'):
    for s, r, tex in (('L', B.rL, B.texL), ('S', B.rS, B.texS)):
        p = OOS['dir' + s] if a == 'dir' else (OOS['liq' + s] + OOS['tec' + s]) / 2
        cw = (B.td >= lo - 2 * 31557600) & (tex < lo) & (tex > 0) & np.isfinite(p) & np.isfinite(r)
        for k, yy, kw in (('ev', r[cw], {}), ('pw', (r[cw] > 0).astype(float), dict(y_min=0, y_max=1))):
            ir = IsotonicRegression(out_of_bounds='clip', **kw).fit(p[cw], yy)
            cal[f'{a}{s}{k}'] = dict(x=[round(float(v), 7) for v in ir.X_thresholds_], y=[round(float(v), 6) for v in ir.y_thresholds_])
nm = B.names
V = dict(ver=ver, trainedTo=lo, names=nm, cols=dict(liq=[nm[i] for i in B.LIQ], tec=[nm[i] for i in B.TEC], dir=['reg_hour', 'reg_wd', 'tec_volreg', 'tec_d50']),
         models={k: conv(b) for k, b in M.items()}, cal=cal, rr=1.5, kstop=1.5, holdH=24)
json.dump(V, open(B.D + f'{ver}.json', 'w'), separators=(',', ':'))
# paridad: 300 decisiones recientes
idx = np.where(np.isfinite(B.X).all(1) | True)[0][-300:]
X = B.X[idx]; pl = {k: M[k].predict(X[:, B.LIQ if k.startswith('liq') else B.TEC]) for k in ('liqL', 'liqS', 'tecL', 'tecS')}
xd = lambda s: np.column_stack([pl['liqL'], pl['liqS'], pl['tecL'], pl['tecS'], X[:, B.REG[0]], X[:, B.REG[1]], X[:, nm.index('tec_volreg')], X[:, nm.index('tec_d50')]])
pd_ = {('dir' + s): M['dir' + s].predict(xd(s)) for s in 'LS'}
json.dump(dict(t=B.td[idx].tolist(), x=[[None if not np.isfinite(v) else float(v) for v in row] for row in X.astype(np.float64)], **{k: v.tolist() for k, v in {**pl, **pd_}.items()}), open(B.D + 'parity.json', 'w'))
print(ver, 'árboles', sum(len(v['trees']) for v in V['models'].values()))

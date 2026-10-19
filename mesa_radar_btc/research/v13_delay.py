#!/usr/bin/env python3
"""v13 · adenda de fidelidad: los aprendices del Radar con entrada a mercado d minutos después de la señal y guarda de precio (ver v13_prereg.md).
Mismo método que mx_delay.py (velas de 1 min, stop y objetivo fijos de la señal, costes de la Mesa), ahora en 2018-21 y 2022-26.
Ejecutar desde la carpeta de datos (donde están h1.npz, office_mask2.npy y mx_ru.json), con research/ en PYTHONPATH."""
import json, numpy as np, engine
from engine import ts
A = np.fromfile(engine.D + '../min.bin', dtype=np.float64).reshape(-1, 6); mt = A[:, 0].astype(np.int64); mo, mh, ml, mc = A[:, 1], A[:, 2], A[:, 3], A[:, 4]
MASK = np.load(engine.D + 'office_mask2.npy'); Ht = engine.H['t']
def office(T): k = np.searchsorted(Ht, (T - 1) // 3600 * 3600); return bool(MASK[min(k, len(Ht) - 1)])
RU = {int(d['sigT']): d['ru'] for d in json.load(open(engine.D + 'mx_ru.json'))}
X = [x for x in json.load(open(engine.D + '../multi_trades.json')) if x['extra'] and x['side'] == x['radarSide'] and office(x['sigT']) and RU.get(int(x['sigT']), 9) < 0.8 and x['sigT'] >= ts(2018)]
def resim(x, d, guard):
    T = x['sigT'] + d * 60; j = np.searchsorted(mt, T); e = mo[j]; s = x['side']; R = x['risk']; sl = x['entry'] - s * R; tp = x['entry'] + s * 1.65 * R
    if guard is not None and abs((e - x['entry']) * s / R) > guard: return 'salta'
    if (e - sl) * s <= 0: return -1.0
    if (tp - e) * s <= 0: return None
    end = np.searchsorted(mt, x['sigT'] + 72 * 3600)
    for k in range(j, end):
        if (ml[k] <= sl if s == 1 else mh[k] >= sl): px = sl; w = 'stop'; break
        if (mh[k] >= tp if s == 1 else ml[k] <= tp): px = tp; w = 'target'; break
    else: px = mc[end - 1]; w = 'tiempo'
    risk = abs(e - sl); return ((px - e) * s - (0.0014 + (0.0003 if w == 'stop' else 0)) * e) / risk
def run(a, b, d, guard):
    xs = [x for x in X if a <= x['sigT'] < b]; vals = [resim(x, d, guard) for x in xs]
    sk = sum(1 for v in vals if v == 'salta'); r = np.array([v for v in vals if v is not None and v != 'salta'])
    return len(xs), sk, len(r), float((r > 0).mean()), float(r.mean())
if __name__ == '__main__':
    for nm, (a, b) in (('2018-21 (elección)', (ts(2018), ts(2022))), ('2022-26 (prueba)', (ts(2022), ts(2100)))):
        print(f'\n{nm}')
        base = run(a, b, 0, None); print(f'  inmediata (d=0)      : señales {base[0]} · tomadas {base[2]} · acierto {base[3]*100:.1f}% · R/op {base[4]:+.3f}')
        for lab, d, g in (('L1  d=20 + guarda 0,25R', 20, 0.25), ('L2  d=35 + guarda 0,25R', 35, 0.25), ('L3  d=35 sin guarda    ', 35, None), ('    d=5  (referencia)  ', 5, None), ('    d=15 (referencia)  ', 15, None)):
            n, sk, m, w, r = run(a, b, d, g)
            print(f'  {lab}: tomadas {m} (saltadas por la guarda {sk}) · acierto {w*100:.1f}% · R/op {r:+.3f} · frente a inmediata: R/op {r/base[4]*100:.0f}% · acierto {100*(w-base[3]):+.1f} pts')

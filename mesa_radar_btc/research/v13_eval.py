#!/usr/bin/env python3
"""v13 · prueba de las 9 variantes pre-registradas (ver v13_prereg.md). Se eligen con 2018-21; 2022-26 solo se enseña de la elegida.
Datos de mercado (h1.npz, d1.npz, funding_h.npz) en V13_DATA (por defecto, esta carpeta). Operaciones: v12g_trades.json (la cartera en vivo).
Todas las variables de cada operación se calculan solo con velas cerradas antes del cierre de su señal (t0)."""
import json, math, os, sys, datetime as dt
import numpy as np
from zoneinfo import ZoneInfo
RES = os.path.dirname(os.path.abspath(__file__)); DATA = os.environ.get('V13_DATA', RES)
base = json.load(open(os.path.join(RES, 'v12g_trades.json'))); END = base['end']; B = base['trades']
ts = lambda y: int(dt.datetime(y, 1, 1, tzinfo=dt.timezone.utc).timestamp()); P1, P2 = (ts(2018), ts(2022)), (ts(2022), END)
H = np.load(DATA + '/h1.npz'); D = np.load(DATA + '/d1.npz'); FZ = np.load(DATA + '/funding_h.npz')
t, h, l, c = H['t'], H['h'], H['l'], H['c']
def ema(x, n):
    a = 2 / (n + 1); o = np.empty_like(x); s = x[0]
    for i, v in enumerate(x): s = a * v + (1 - a) * s if i else v; o[i] = s
    return o
pc = np.r_[c[0], c[:-1]]; tr = np.maximum(h - l, np.maximum(abs(h - pc), abs(l - pc))); A1 = ema(tr, 24)
med = np.full(len(A1), np.nan)
for s in range(720, len(A1), 2000):
    e = min(len(A1), s + 2000); w = np.lib.stride_tricks.sliding_window_view(A1[s - 720:e - 1], 720); med[s:e] = np.median(w, axis=1)
RATIO = A1 / med; F3 = FZ['F3']
dt_, dc = D['t'], D['c']; cs = np.cumsum(np.r_[0, dc]); S50 = np.full(len(dc), np.nan); S50[49:] = (cs[50:] - cs[:-50]) / 50
tz = ZoneInfo('Europe/Madrid')
def feats(x):
    i = int(np.searchsorted(t, x['t0'] - 3600, 'right')) - 1         # última hora cerrada al cierre de la señal
    d = int(np.searchsorted(dt_, x['t0'] - 3600, 'right')) - 2       # último día cerrado
    reg = 0 if d < 49 or np.isnan(S50[d]) else (1 if dc[d] > S50[d] else -1)
    loc = dt.datetime.fromtimestamp(x['t0'], tz)
    return dict(fund=F3[i], ratio=RATIO[i], reg=reg, friday_late=(loc.weekday() == 4 and loc.hour >= 19))
for x in B: x.update(feats(x))
for x in B: x['apr'] = x['src'].startswith('aprendiz')
Bs = sorted(B, key=lambda x: x['t0'])
for j, x in enumerate(Bs):   # apilado: otra operación del mismo lado ya abierta en el cierre de la señal
    x['stack'] = any(y is not x and y['t0'] < x['t0'] < y['t1'] and y['side'] == x['side'] for y in Bs[max(0, j - 40):j])
# ---- cartera y estadísticas: idénticas a validate.py ----
def port(items, a, b):
    Z = sorted([z for z in items if a <= z['t0'] < b], key=lambda z: z['t0']); op = []; eq = pk = 0; tk = []
    for z in Z:
        for o in sorted([o for o in op if o['t1'] <= z['t0']], key=lambda o: o['t1']): eq += o['r'] * o['wt']; pk = max(pk, eq); op.remove(o)
        w = z['w'] * (0.5 if pk - eq > 8 else 1); w = min(w, 2.0 - sum(o['wt'] for o in op))
        if w < 0.2: continue
        y = dict(z, wt=w); op.append(y); tk.append(y)
    return tk
def stats(tk, a, b, HL=2.0):
    yrs = (min(b, END) - a) / 31557600
    if len(tk) < 2: return None
    r = [x['r'] for x in tk]; wr = [x['r'] * x.get('wt', 1) for x in tk]
    d0 = a // 86400; v = [0.0] * (min(b, END) // 86400 - d0 + 1)
    for x, q in zip(tk, wr): v[min(len(v) - 1, x['t1'] // 86400 - d0)] += q
    m = sum(v) / len(v); sd = math.sqrt(sum((q - m) ** 2 for q in v) / len(v)) or 1e-9
    e = min(b, END) // 86400; wd = [0.5 ** ((e - (d0 + i)) / (HL * 365.25)) for i in range(len(v))]; W = sum(wd)
    mw = sum(q * k for q, k in zip(v, wd)) / W; sdw = math.sqrt(sum(k * (q - mw) ** 2 for q, k in zip(v, wd)) / W) or 1e-9
    cum = pk = dd = 0
    for x, q in sorted(zip(tk, wr), key=lambda p: p[0]['t1']): cum += q; pk = max(pk, cum); dd = max(dd, pk - cum)
    return dict(n=len(r), sem=len(r) / yrs / 52.18, win=sum(q > 0 for q in r) / len(r), rop=sum(r) / len(r), cop=sum(wr) / len(wr), ry=sum(wr) / yrs, sh=m / sd * math.sqrt(365), shw=mw / sdw * math.sqrt(365), dd=dd)
def line(s): return f"ops/sem {s['sem']:.2f} · acierto {s['win']*100:.1f}% · R/op {s['rop']:+.3f} (cartera {s['cop']:+.3f}) · R/año {s['ry']:+.1f} · Sharpe {s['sh']:.2f} (rec. {s['shw']:.2f}) · caída {s['dd']:.1f}R"
# ---- variantes ----
def mod(f):   # f(x) -> None (saltar) | factor de riesgo
    out = []
    for x in B:
        k = f(x)
        if k is None: continue
        out.append(dict(x, w=x['w'] * k))
    return out
VAR = {
    'F1': lambda x: None if (not np.isnan(x['fund']) and ((x['side'] == 1 and x['fund'] > 0.0003) or (x['side'] == -1 and x['fund'] < -0.0003))) else 1,
    'F2': lambda x: None if (not np.isnan(x['fund']) and ((x['side'] == 1 and x['fund'] > 0.0006) or (x['side'] == -1 and x['fund'] < -0.0006))) else 1,
    'V1': lambda x: 0.5 if (not np.isnan(x['ratio']) and x['ratio'] >= 2.0) else 1,
    'V2': lambda x: 0.5 if (not np.isnan(x['ratio']) and x['ratio'] >= 1.5) else 1,
    'T1': lambda x: 0.5 if (x['apr'] and x['reg'] != 0 and x['reg'] != x['side']) else 1,
    'T2': lambda x: None if (x['apr'] and x['reg'] != 0 and x['reg'] != x['side']) else 1,
    'S1': lambda x: 0.5 if x['stack'] else 1,
    'W1': lambda x: None if x['friday_late'] else 1,
}
if __name__ == '__main__':
    s0 = {nm: stats(port(B, *p), *p) for nm, p in (('p1', P1), ('p2', P2))}
    print('v12 base · 2018-21:', line(s0['p1']))
    print(f"\nafectadas (todo el periodo): " + ' · '.join(f"{k} {sum(1 for x in B if VAR[k](x) != 1)}" for k in VAR) + f" de {len(B)}\n")
    res1 = {}
    for k, f in VAR.items():
        res1[k] = stats(port(mod(f), *P1), *P1); print(f'{k} · 2018-21:', line(res1[k]))
    ok = {k: s for k, s in res1.items() if s['sem'] >= 0.9 * s0['p1']['sem']}
    best = max(ok, key=lambda k: ok[k]['shw']); print(f"\nELEGIDA con 2018-21 (mayor Sharpe reciente con ≥ 0,9× las operaciones/semana de la v12): {best} · Sharpe rec. {ok[best]['shw']:.2f} frente a {s0['p1']['shw']:.2f}")
    mejora = [k for k, s in ok.items() if s['shw'] > s0['p1']['shw']]; print('Variantes que mejoran la elección:', mejora)
    out = dict(best=best, mejoran_eleccion=mejora, trades=mod(VAR[best]))
    json.dump(out, open(os.path.join(os.environ.get('V13_OUT', '/tmp'), 'v13_candidata.json'), 'w'))
    print(f'\n2022-26 (prueba) de la elegida {best}:', line(stats(port(mod(VAR[best]), *P2), *P2)), '\n2022-26 v12:', line(s0['p2']))

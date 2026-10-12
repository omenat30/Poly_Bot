#!/usr/bin/env python3
"""Juez de estrategias de la Mesa Radar.
Uso: python3 validate.py candidata.json [--peso 1.0] [--reemplaza src1,src2] [--costes-extra-pb 4] [--pruebas N] [--no-registrar]
candidata.json: lista (o {"trades": [...]}) de operaciones {t0, t1, r, side[, risk_pct][, src]} con r NETO de costes y funding,
en R del riesgo propio; t0 = cierre de la vela de señal (s UTC), t1 = salida. risk_pct = distancia al stop / entrada (para el estrés de costes).
Informe: la candidata sola y la cartera v12 con y sin ella (tope 2R, freno 8R), 2018-21 (elección) frente a 2022-26 (prueba), año a año,
estrés de costes, bootstrap del Sharpe y Deflated Sharpe con el inventario de pruebas. Termina con un veredicto."""
import json, math, sys, argparse, datetime as dt, random, os
from statistics import NormalDist
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
RES = os.path.join(ROOT, 'mesa_radar_btc', 'research')
ts = lambda y: int(dt.datetime(y, 1, 1, tzinfo=dt.timezone.utc).timestamp())
ap = argparse.ArgumentParser(); ap.add_argument('cand'); ap.add_argument('--peso', type=float, default=1.0)
ap.add_argument('--reemplaza', default=''); ap.add_argument('--costes-extra-pb', type=float, default=4)
ap.add_argument('--pruebas', type=int, default=1); ap.add_argument('--no-registrar', action='store_true')
A = ap.parse_args()
base = json.load(open(os.path.join(RES, 'v12g_trades.json'))); END = base['end']; B = base['trades']
C = json.load(open(A.cand)); C = C['trades'] if isinstance(C, dict) else C
for x in C: x.setdefault('src', 'candidata'); x['w'] = A.peso
P1, P2 = (ts(2018), ts(2022)), (ts(2022), END)

def port(items, a, b):
    Z = sorted([z for z in items if a <= z['t0'] < b], key=lambda z: z['t0']); op = []; eq = pk = 0; tk = []
    for z in Z:
        for o in sorted([o for o in op if o['t1'] <= z['t0']], key=lambda o: o['t1']): eq += o['r'] * o['wt']; pk = max(pk, eq); op.remove(o)
        w = z['w'] * (0.5 if pk - eq > 8 else 1); w = min(w, 2.0 - sum(o['wt'] for o in op))
        if w < 0.2: continue
        y = dict(z, wt=w); op.append(y); tk.append(y)
    return tk
def stats(tk, a, b, weighted=True):
    yrs = (min(b, END) - a) / 31557600
    if len(tk) < 2: return None
    r = [x['r'] for x in tk]; wr = [x['r'] * (x.get('wt', 1) if weighted else 1) for x in tk]
    d0 = a // 86400; v = [0.0] * (min(b, END) // 86400 - d0 + 1)
    for x, q in zip(tk, wr): v[min(len(v) - 1, x['t1'] // 86400 - d0)] += q
    m = sum(v) / len(v); sd = math.sqrt(sum((q - m) ** 2 for q in v) / len(v)) or 1e-9
    cum = pk = dd = 0
    for x, q in sorted(zip(tk, wr), key=lambda p: p[0]['t1']): cum += q; pk = max(pk, cum); dd = max(dd, pk - cum)
    return dict(n=len(r), sem=len(r) / yrs / 52.18, win=sum(q > 0 for q in r) / len(r), rop=sum(r) / len(r), cop=sum(wr) / len(wr), ry=sum(wr) / yrs, sh=m / sd * math.sqrt(365), dd=dd, v=v)
def line(s): return '—' if not s else f"ops/sem {s['sem']:.2f} · acierto {s['win']*100:.1f}% · R/op {s['rop']:+.3f} (cartera {s['cop']:+.3f}) · R/año {s['ry']:+.1f} · Sharpe {s['sh']:.2f} · caída {s['dd']:.1f}R"
def years(tk):
    out = {}
    for y in range(2018, 2027): out[y] = round(sum(x['r'] * x.get('wt', 1) for x in tk if ts(y) <= x['t0'] < ts(y + 1)), 1)
    return out
rep = set(s for s in A.reemplaza.split(',') if s)
Bk = [x for x in B if x['src'] not in rep]
print(f'# Validación · {os.path.basename(A.cand)} · peso {A.peso}R' + (f' · reemplaza {sorted(rep)}' if rep else ''))
res = {}
for nm, (a, b) in (('2018-21 (elección)', P1), ('2022-26 (prueba)', P2)):
    sc = stats([dict(x, wt=1) for x in C if a <= x['t0'] < b], a, b, weighted=False)
    s0 = stats(port(B, a, b), a, b); s1 = stats(port(Bk + C, a, b), a, b); res[nm] = (sc, s0, s1)
    print(f'\n## {nm}\n- Candidata sola: {line(sc)}\n- Mesa v12:       {line(s0)}\n- v12 + candidata:{line(s1)}')
y0 = years(port(B, ts(2018), END)); y1 = years(port(Bk + C, ts(2018), END))
print('\n## Año a año (R de cartera)\n| año | v12 | con candidata | Δ |\n|---|---|---|---|')
for y in y0: print(f'| {y} | {y0[y]:+.1f} | {y1[y]:+.1f} | {y1[y]-y0[y]:+.1f} |')
mejora_años = sum(1 for y in y0 if y >= 2022 and y1[y] > y0[y] + 0.05)
# estrés de costes
if all('risk_pct' in x for x in C):
    Cs = [dict(x, r=x['r'] - A.costes_extra_pb / 1e4 / x['risk_pct']) for x in C]
    ss = stats([dict(x, wt=1) for x in Cs if P2[0] <= x['t0'] < P2[1]], *P2, weighted=False)
    print(f'\n## Estrés: +{A.costes_extra_pb:g} pb de coste por operación (2022-26)\n- Candidata sola: {line(ss)}')
else: ss = None; print('\n## Estrés de costes: sin risk_pct en las operaciones, no se puede calcular (añádelo).')
# bootstrap estacionario del Sharpe diario 2022-26 (bloques medios de 10 días)
def boot(v, n=1000, L=10):
    N = len(v); out = []
    rnd = random.Random(7)
    for _ in range(n):
        s = []; i = rnd.randrange(N)
        while len(s) < N:
            s.append(v[i]); i = (i + 1) % N if rnd.random() > 1 / L else rnd.randrange(N)
        m = sum(s) / N; sd = math.sqrt(sum((q - m) ** 2 for q in s) / N) or 1e-9; out.append(m / sd * math.sqrt(365))
    out.sort(); return out[int(0.05 * n)], out[int(0.95 * n)]
s0, s1 = res['2022-26 (prueba)'][1], res['2022-26 (prueba)'][2]
d = [p - q for p, q in zip(s1['v'], s0['v'])]
lo, hi = boot(s1['v']); print(f'\n## Bootstrap (2022-26)\n- Sharpe v12 + candidata: {s1["sh"]:.2f} (90%: {lo:.2f} a {hi:.2f})')
# Deflated Sharpe de la candidata sola (por operación) con el inventario
inv_p = os.path.join(RES, 'inventory.json'); inv = json.load(open(inv_p)); N = inv['trials'] + A.pruebas
sc2 = res['2022-26 (prueba)'][0]; dsr = None
if sc2 and sc2['n'] > 10:
    r = [x['r'] for x in C if P2[0] <= x['t0'] < P2[1]]; n = len(r); m = sum(r) / n; sd = math.sqrt(sum((q - m) ** 2 for q in r) / (n - 1)); sr = m / sd
    sk = sum(((q - m) / sd) ** 3 for q in r) / n; ku = sum(((q - m) / sd) ** 4 for q in r) / n
    Z = NormalDist().inv_cdf; g = 0.5772; sr0 = math.sqrt(1 / n) * ((1 - g) * Z(1 - 1 / N) + g * Z(1 - 1 / (N * math.e)))
    dsr = NormalDist().cdf((sr - sr0) * math.sqrt(n - 1) / math.sqrt(max(1e-9, 1 - sk * sr + (ku - 1) / 4 * sr * sr)))
    print(f'\n## Deflated Sharpe (candidata sola, 2022-26)\n- SR por operación {sr:.3f} · umbral por {N} pruebas {sr0:.3f} · DSR = {dsr:.3f} (≥ 0,95 = ventaja demostrada)')
if not A.no_registrar:
    inv['trials'] = N; json.dump(inv, open(inv_p, 'w'), ensure_ascii=False); print(f'- Inventario actualizado: {N} pruebas.')
# veredicto: sobre la cartera, con la regla de elección en 2018-21 y la confirmación en 2022-26
e0, e1 = res['2018-21 (elección)'][1], res['2018-21 (elección)'][2]
mejora_eleccion = e1['sh'] > e0['sh']
mejora_prueba = s1['sh'] > s0['sh'] and s1['cop'] >= s0['cop'] - 0.005
no_rompe = s1['dd'] <= s0['dd'] * 1.25 and (ss is None or ss['rop'] > 0)
print('\n## Veredicto')
if mejora_eleccion and mejora_prueba and no_rompe and mejora_años >= 3: v = 'ADOPTAR (en prueba en real, riesgo mínimo)'
elif mejora_eleccion and (mejora_prueba or mejora_años >= 3): v = 'DUDOSO: mejora parcial; no adoptar sin más evidencia'
else: v = 'DESCARTAR'
print(f'- {v}')
print(f'- Mejora el Sharpe de la cartera en la elección: {"sí" if mejora_eleccion else "no"} · en la prueba: {"sí" if mejora_prueba else "no"} · años 2022-26 que mejora: {mejora_años} de 5 · caída y costes aceptables: {"sí" if no_rompe else "no"}')
if dsr is not None and dsr < 0.95: print('- Aviso: la ventaja de la candidata sola no es estadísticamente demostrable tras corregir por todas las pruebas.')

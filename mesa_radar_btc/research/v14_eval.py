#!/usr/bin/env python3
"""v14 · 8 variantes pre-registradas (ver v14_prereg.md). Se eligen con 2018-21; 2022-26 solo se enseña de la elegida.
Ejecutar desde la carpeta de datos (h1.npz, d1.npz, funding_h.npz, office_mask2.npy), con research/ en PYTHONPATH.
Funding: FH (por 8 h) vigente cada hora; si falta (antes de 2019-20) se supone 0,0001. Salida: v14_cands.json (todas las variantes) y resumen."""
import json, math, sys, numpy as np, datetime as dt
import engine
from engine import H, DD, sim, atr, ema, sma, rollmax, rollmin, ts, FEE
t, o, h, l, c, v = H['t'], H['h'] * 0 + H['o'], H['h'], H['l'], H['c'], H['v']; N = len(t)
MASK = np.load(engine.D + 'office_mask2.npy'); FH = np.nan_to_num(np.load(engine.D + 'funding_h.npz')['FH'], nan=0.0001)
A24 = atr(H, 24); A24s = A24
def rmed(x, n):
    out = np.full(len(x), np.nan)
    for s in range(n, len(x), 2000):
        e = min(len(x), s + 2000); w = np.lib.stride_tricks.sliding_window_view(x[s - n:e - 1], n); out[s:e] = np.median(w, axis=1)
    return out
RATIO = A24 / rmed(A24, 720)
EMA21 = ema(c, 21); EMA100 = ema(c, 100)
dc = DD['c']; dt_ = DD['t']
def day_sma(n):
    cs = np.cumsum(np.r_[0, dc]); s = np.full(len(dc), np.nan); s[n - 1:] = (cs[n:] - cs[:-n]) / n; return s
def reg_h(n):   # +1/-1 según el último cierre DIARIO ya cerrado frente a su SMA n
    S = day_sma(n); d = np.searchsorted(dt_, t - 86400, 'right') - 1   # último día completo cerrado antes de la hora
    d = np.clip(d, 0, len(dc) - 1); r = np.where(np.isnan(S[d]), 0, np.where(dc[d] > S[d], 1, -1)); return r
RET1 = c / o - 1
HI48 = rollmax(h, 48); LO48 = rollmin(l, 48)
HI12 = rollmax(h, 12); LO12 = rollmin(l, 12)
def lag(x, k=1):   # valor conocido al cierre de la vela anterior
    return np.r_[np.full(k, np.nan), x[:-k]]
ok_entry = lambda i: i + 1 < N and MASK[i + 1]
def finish(res, label, trail=None):
    out = []
    for (T0, side, r, why, T1, e, stop, _) in res:
        j0 = int(np.searchsorted(t, T0)) - 1; j1 = int(np.searchsorted(t, T1))
        rp = abs(e - stop) / e
        fund = side * FH[j0 + 1:max(j1, j0 + 2)].sum() / 8 / rp
        out.append(dict(t0=int(T0), t1=int(T1), side=int(side), r=float(r - fund), risk_pct=float(rp), src=label))
    return out
# ---- generadores de señales (i = vela que cierra la decisión) ----
def sig_A(theta):
    s = []
    for i in range(800, N - 80):
        if not ok_entry(i) or not RATIO[i] < theta: continue
        if c[i] > HI48[i - 1]: s.append((i, 1, c[i] - 2 * A24[i], np.nan, 72))
        elif c[i] < LO48[i - 1]: s.append((i, -1, c[i] + 2 * A24[i], np.nan, 72))
    return s, (3.0, A24)
def sig_B(n):
    R = reg_h(n); s = []
    for i in range(800, N - 80):
        if not ok_entry(i): continue
        under = np.any(c[i - 12:i] < EMA21[i - 12:i] - A24[i - 12:i]); over = np.any(c[i - 12:i] > EMA21[i - 12:i] + A24[i - 12:i])
        if R[i] == 1 and EMA21[i] > EMA100[i] and under and c[i] > EMA21[i] and c[i - 1] <= EMA21[i - 1]:
            st = l[i - 12:i + 1].min(); s.append((i, 1, st, c[i] + 2 * (c[i] - st), 72))
        elif R[i] == -1 and EMA21[i] < EMA100[i] and over and c[i] < EMA21[i] and c[i - 1] >= EMA21[i - 1]:
            st = h[i - 12:i + 1].max(); s.append((i, -1, st, c[i] - 2 * (st - c[i]), 72))
    return s, None
def sig_C(k):
    s = []
    for i in range(800, N - 80):
        if not ok_entry(i): continue
        if abs(RET1[i]) * c[i] >= k * A24[i - 1]:
            sd = 1 if RET1[i] > 0 else -1; s.append((i, sd, c[i] - sd * 1.5 * A24[i], np.nan, 48))
    return s, (2.5, A24)
SMA48 = sma(c, 48); SD48 = np.sqrt(np.maximum(sma(c * c, 48) - SMA48 ** 2, 0)); VMA = sma(v, 48)
def sig_D():
    s = []
    for i in range(800, N - 80):
        if not ok_entry(i): continue
        p = i - 1   # vela de exceso = i-1 ; i confirma que vuelve a la banda
        if np.isnan(SD48[p]): continue
        hi = c[p] > SMA48[p] + 3 * SD48[p]; lo = c[p] < SMA48[p] - 3 * SD48[p]
        if (hi or lo) and v[p] >= 2 * VMA[p]:
            if hi and c[i] < SMA48[p] + 3 * SD48[p]: s.append((i, -1, max(h[p], h[i]), SMA48[i], 48))
            if lo and c[i] > SMA48[p] - 3 * SD48[p]: s.append((i, 1, min(l[p], l[i]), SMA48[i], 48))
    return s, None
def sig_E():
    s = []; lastwk = -1
    dcl = dc; ret20 = np.r_[np.full(20, np.nan), dcl[20:] / dcl[:-20] - 1]; ret100 = np.r_[np.full(100, np.nan), dcl[100:] / dcl[:-100] - 1]
    for i in range(800, N - 400):
        if not ok_entry(i): continue
        wk = t[i] // (7 * 86400)
        if wk == lastwk: continue
        d = int(np.searchsorted(dt_, t[i] - 86400, 'right') - 1)
        if np.isnan(ret100[d]): continue
        if ret20[d] > 0 and ret100[d] > 0: sd = 1
        elif ret20[d] < 0 and ret100[d] < 0: sd = -1
        else: continue
        lastwk = wk; s.append((i, sd, c[i] - sd * 4 * A24[i], np.nan, 336))
    return s, (4.0, A24)
VARS = {'A1': lambda: sig_A(0.8), 'A2': lambda: sig_A(0.6), 'B1': lambda: sig_B(50), 'B2': lambda: sig_B(100),
        'C1': lambda: sig_C(3), 'C2': lambda: sig_C(4), 'D1': sig_D, 'E1': sig_E}
P1, P2 = (ts(2018), ts(2022)), (ts(2022), int(t[-1]))
def summ(T, a, b):
    X = [x for x in T if a <= x['t0'] < b]
    if len(X) < 5: return None
    yrs = (b - a) / 31557600; r = np.array([x['r'] for x in X]); d0 = a // 86400; ndays = (b - a) // 86400 + 1
    day = np.zeros(ndays)
    for x in X: day[min(ndays - 1, x['t1'] // 86400 - d0)] += x['r']
    m = day.mean(); sd = day.std() or 1e-9; e = (b) // 86400; w = 0.5 ** ((e - (d0 + np.arange(ndays))) / (2 * 365.25)); mw = (day * w).sum() / w.sum(); sdw = math.sqrt((w * (day - mw) ** 2).sum() / w.sum()) or 1e-9
    cum = np.cumsum([x['r'] for x in sorted(X, key=lambda z: z['t1'])]); dd = (np.maximum.accumulate(np.r_[0, cum])[1:] - cum).max()
    return dict(n=len(X), sem=len(X) / yrs / 52.18, win=float((r > 0).mean()), rop=float(r.mean()), ry=float(r.sum() / yrs), sh=float(m / sd * math.sqrt(365)), shw=float(mw / sdw * math.sqrt(365)), dd=float(dd))
def line(s): return 'sin datos' if s is None else f"ops/sem {s['sem']:.2f} · acierto {s['win']*100:.1f}% · R/op {s['rop']:+.3f} · R/año {s['ry']:+.1f} · Sharpe {s['sh']:.2f} (rec. {s['shw']:.2f}) · caída {s['dd']:.1f}R"
if __name__ == '__main__':
    ALL = {}; s1 = {}
    for k, f in VARS.items():
        sg, tr = f(); res = sim(sg, trail=tr) if tr else sim(sg); T = finish(res, k); ALL[k] = T; s1[k] = summ(T, *P1)
        print(f'{k} · 2018-21: {len(sg)} señales · ' + line(s1[k]))
    json.dump(ALL, open('/tmp/v14_cands.json', 'w'))
    ok = {k: s for k, s in s1.items() if s and s['sem'] >= 0.4 and s['rop'] > 0.10}
    print('\npasan el corte de 2018-21:', list(ok))
    if ok:
        best = max(ok, key=lambda k: ok[k]['shw']); print('ELEGIDA:', best, line(ok[best]))
        print('2022-26 (prueba) de la elegida:', line(summ(ALL[best], *P2)))
        json.dump(ALL[best], open('/tmp/v14_elegida.json', 'w'))
        print('año a año (R):', {y: round(sum(x['r'] for x in ALL[best] if ts(y) <= x['t0'] < ts(y + 1)), 1) for y in range(2018, 2027)})

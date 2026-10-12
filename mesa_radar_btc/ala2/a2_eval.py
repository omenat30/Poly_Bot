# Segunda ala · operativa simulada con el gestor de riesgo (Beltrán). Variantes cerradas antes de mirar: agregador {director, media de especialistas}
# × umbral de R neto previsto {0,05; 0,10; 0,20; 0,30} = 8. Reglas de Beltrán (fijas): 1 posición a la vez, 1R por operación,
# veto si el R neto previsto no supera el umbral, parada diaria −2R (no más entradas ese día), freno a mitad de riesgo si cae > 8R.
import numpy as np, pickle, datetime as dt, math, json, sys
from zoneinfo import ZoneInfo
Z = np.load('a2_bank.npz'); td = Z['td']; O = pickle.load(open('a2_oos.pkl', 'rb'))['OOS']
rL, rS, texL, texS = Z['rL'], Z['rS'], Z['texL'], Z['texS']
ts = lambda y: int(dt.datetime(y, 1, 1, tzinfo=dt.timezone.utc).timestamp()); END = int(td[-1])
def ic(a, b, m): m = m & np.isfinite(a) & np.isfinite(b); return np.corrcoef(a[m], b[m])[0, 1]
for per, (a, b) in (('18-21', (ts(2018), ts(2022))), ('22-26', (ts(2022), END))):
    m = (td >= a) & (td < b)
    print(per, 'IC liqL %.3f liqS %.3f tecL %.3f tecS %.3f dirL %.3f dirS %.3f' % tuple(ic(O[k], r, m) for k, r in (('liqL', rL), ('liqS', rS), ('tecL', rL), ('tecS', rS), ('dirL', rL), ('dirS', rS))))
tz = ZoneInfo('Europe/Madrid')
def run(agg, thr, a, b):
    pL = O['dirL'] if agg == 'dir' else (O['liqL'] + O['tecL']) / 2; pS = O['dirS'] if agg == 'dir' else (O['liqS'] + O['tecS']) / 2
    busy = 0; eq = pk = 0; tk = []; day = None; dayR = 0; pend = []
    for i in np.where((td >= a) & (td < b) & np.isfinite(pL) & np.isfinite(pS))[0]:
        t = td[i]
        for p in [p for p in pend if p[0] <= t]: eq += p[1]; pk = max(pk, eq); dayR += p[1] if p[2] == day else 0; pend.remove(p)
        d = dt.datetime.fromtimestamp(int(t), tz).date()
        if d != day: day = d; dayR = 0
        if t < busy or dayR <= -2: continue
        s = 1 if pL[i] >= pS[i] else -1; pr = max(pL[i], pS[i])
        if pr < thr: continue
        w = 0.5 if pk - eq > 8 else 1.0; r = rL[i] if s == 1 else rS[i]; tex = texL[i] if s == 1 else texS[i]
        tk.append((int(t), int(tex), float(r), w, s, float(pr))); busy = tex; pend.append((tex, r * w, d))
    return tk
def st(tk, a, b, HL=2.0):
    if len(tk) < 5: return None
    yrs = (min(b, END) - a) / 31557600; r = np.array([x[2] for x in tk]); wr = np.array([x[2] * x[3] for x in tk])
    d0 = a // 86400; v = np.zeros(min(b, END) // 86400 - d0 + 1)
    for x in tk: v[min(len(v) - 1, x[1] // 86400 - d0)] += x[2] * x[3]
    e = len(v); w = 0.5 ** ((e - np.arange(e)) / (HL * 365.25)); mw = (v * w).sum() / w.sum(); sdw = math.sqrt((w * (v - mw) ** 2).sum() / w.sum())
    cum = np.cumsum(wr[np.argsort([x[1] for x in tk])]); dd = (np.maximum.accumulate(np.r_[0, cum])[1:] - cum).max()
    gw = r[r > 0].mean() if (r > 0).any() else 0; gl = -r[r < 0].mean() if (r < 0).any() else 1
    return dict(n=len(r), sem=len(r) / yrs / 52.18, win=(r > 0).mean(), rop=r.mean(), ry=wr.sum() / yrs, sh=v.mean() / v.std() * math.sqrt(365), shw=mw / sdw * math.sqrt(365), dd=dd, payoff=gw / gl, pf=r[r > 0].sum() / max(1e-9, -r[r < 0].sum()))
f = lambda s: '—' if not s else f"ops/sem {s['sem']:.2f} acierto {s['win']*100:.1f}% R/op {s['rop']:+.3f} payoff {s['payoff']:.2f} PF {s['pf']:.2f} R/año {s['ry']:+.1f} Sharpe {s['sh']:.2f} (rec {s['shw']:.2f}) caída {s['dd']:.1f}"
P1, P2 = (ts(2018), ts(2022)), (ts(2022), END); best = None
for agg in ('dir', 'avg'):
    for thr in (0.05, 0.10, 0.20, 0.30):
        s1 = st(run(agg, thr, *P1), *P1); s2 = st(run(agg, thr, *P2), *P2)
        print(f'{agg} thr {thr:.2f} | 18-21 {f(s1)}\n               | 22-26 {f(s2)}')
        if s1 and s1['win'] >= 0.40 and s1['sem'] >= 1 and (best is None or s1['shw'] > best[2]['shw']): best = (agg, thr, s1)
print('ELEGIDA con 2018-21:', best[:2] if best else None)

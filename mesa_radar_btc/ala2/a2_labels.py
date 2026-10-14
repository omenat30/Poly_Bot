# Ala 2 · etiquetas con el camino de 1 min: entrada en la apertura del minuto t+5 (la ronda corre a los 7 min y la vela de 5 min ya cerró),
# stop 1,5 ATR(1h) (ATR del mismo código JS que el vivo), objetivo 1,5R, máx 24 h, stop primero si coinciden. Costes 0,14% + 0,03% en stops + funding.
import numpy as np, json
D = '/tmp/claude-0/-home-user-Poly-Bot/62062f9b-9ffe-50c1-8835-98e9f5ba9b0f/scratchpad/'
FEE, SLIP, RR, KSTOP, HOLD, DELAY = 0.0014, 0.0003, 1.5, 1.5, 1440, 5
A = np.fromfile(D + 'min.bin', dtype=np.float64).reshape(-1, 6)
t0 = int(A[0, 0]); N = int((A[-1, 0] - t0) // 60) + 1; idx = ((A[:, 0] - t0) // 60).astype(np.int64)
c = np.full(N, np.nan); c[idx] = A[:, 4]; o = np.full(N, np.nan); o[idx] = A[:, 1]; h = np.full(N, np.nan); h[idx] = A[:, 2]; l = np.full(N, np.nan); l[idx] = A[:, 3]
m = np.isnan(c); ix = np.where(~m, np.arange(N), 0); np.maximum.accumulate(ix, out=ix); c = c[ix]
for arr in (o, h, l): mm = np.isnan(arr); arr[mm] = c[mm]
T = t0 + 60 * np.arange(N)
FU = np.array(json.load(open(D + 'ala2/fund_hist.json'))); ft, fr = FU[:, 0], FU[:, 1]; cf = np.cumsum(np.r_[0, fr])
fund_between = lambda ta, tb: cf[np.searchsorted(ft, tb, 'right')] - cf[np.searchsorted(ft, ta, 'right')]
td = np.fromfile(D + 'ala2/td.bin', dtype=np.int64); NC = 40
X = np.fromfile(D + 'ala2/feat5.bin', dtype=np.float64).reshape(len(td), NC); atr = X[:, 38]
im = ((td - t0) // 60).astype(np.int64); ie = im + DELAY; e = o[ie]; risk = KSTOP * atr
ok = np.isfinite(risk) & (ie + HOLD < N)
out = {}
for s, nm in ((1, 'L'), (-1, 'S')):
    sl = e - s * risk; tp = e + s * RR * risk; r = np.full(len(td), np.nan); ex = np.full(len(td), -1); why = np.zeros(len(td), np.int8)
    done = ~ok; mfe = np.zeros(len(td)); mae = np.zeros(len(td)); iec = np.where(ok, ie, 0)
    for j in range(HOLD):
        ii = iec + j; hs = (l[ii] <= sl) if s == 1 else (h[ii] >= sl); ht = (h[ii] >= tp) if s == 1 else (l[ii] <= tp)
        fav = ((h[ii] - e) if s == 1 else (e - l[ii])) / risk; adv = ((e - l[ii]) if s == 1 else (h[ii] - e)) / risk
        mfe = np.where(done, mfe, np.maximum(mfe, fav)); mae = np.where(done, mae, np.maximum(mae, adv))
        mm = ~done & hs; r[mm] = -1 - SLIP * e[mm] / risk[mm]; ex[mm] = ii[mm]; why[mm] = 1; done |= mm
        mm = ~done & ht; r[mm] = RR; ex[mm] = ii[mm]; why[mm] = 2; done |= mm
    mm = ~done & ok; ii = iec + HOLD - 1; r[mm] = (c[ii[mm]] - e[mm]) * s / risk[mm]; ex[mm] = ii[mm]; why[mm] = 3
    tex = np.where(ok, T[np.maximum(ex, 0)] + 60, 0)
    fund = np.array([fund_between(a, b) if k else 0 for a, b, k in zip(T[iec], tex, ok)])
    cost = FEE * e / risk + s * fund * e / risk
    r = r - cost
    out[nm] = dict(r=r, tex=tex, why=why, mfe=mfe, mae=mae, cost=cost + np.where(why == 1, SLIP * e / risk, 0))
    print(nm, 'R medio', np.nanmean(r).round(3), 'acierto', np.nanmean(r[ok] > 0).round(3), flush=True)
np.savez_compressed(D + 'ala2/a2_lab5.npz', td=td, entry=e, risk=risk, ok=ok, **{k + nm: v for nm in out for k, v in out[nm].items()})
print('ok', ok.sum())

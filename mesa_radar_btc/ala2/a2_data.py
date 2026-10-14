# Segunda ala · banco de decisiones cada 10 min (L-V 7-21 Madrid) con variables de liquidez y técnicas, y etiquetas de una operación fija.
# Sin mirar el futuro: solo minutos cerrados antes de la decisión t. Entrada en la apertura del minuto t+2 (retraso de ejecución manual).
import numpy as np, sys, datetime as dt
from zoneinfo import ZoneInfo
from math import erf
sys.path.insert(0, '../research')
D = '/tmp/claude-0/-home-user-Poly-Bot/62062f9b-9ffe-50c1-8835-98e9f5ba9b0f/scratchpad/'
FEE, SLIP, RR, KSTOP, HOLD, DELAY = 0.0014, 0.0003, 1.5, 1.5, 1440, 2
A = np.fromfile(D + 'min.bin', dtype=np.float64).reshape(-1, 6)
t0 = int(A[0, 0]); N = int((A[-1, 0] - t0) // 60) + 1
idx = ((A[:, 0] - t0) // 60).astype(np.int64)
c = np.full(N, np.nan); c[idx] = A[:, 4]; o = np.full(N, np.nan); o[idx] = A[:, 1]; h = np.full(N, np.nan); h[idx] = A[:, 2]; l = np.full(N, np.nan); l[idx] = A[:, 3]
v = np.zeros(N); v[idx] = A[:, 5]
# minutos sin operaciones: precio plano al último cierre
for arr in (c,):
    m = np.isnan(arr); ix = np.where(~m, np.arange(N), 0); np.maximum.accumulate(ix, out=ix); arr[:] = arr[ix]
for arr in (o, h, l): m = np.isnan(arr); arr[m] = c[m]
T = t0 + 60 * np.arange(N)            # inicio de cada minuto
print('minutos', N, flush=True)
# ---- funding (liquidaciones de 8 h de Binance) ----
import engine
exec(open('../research/funding.py').read().split("t=H['t']")[0].replace('from engine import H', ''))
cf = np.cumsum(np.r_[0, fr])
def fund_between(ta, tb):   # suma de tasas liquidadas en (ta, tb]
    return cf[np.searchsorted(ft, tb, 'right')] - cf[np.searchsorted(ft, ta, 'right')]
# ---- barras horarias cerradas ----
H0 = (T[0] // 3600 + 1) * 3600; hb = (T - H0) // 3600
nh = int(hb[-1]) + 1; ok = hb >= 0
Hh = np.full(nh, -np.inf); Hl = np.full(nh, np.inf); Hc = np.zeros(nh); Hv = np.zeros(nh)
np.maximum.at(Hh, hb[ok], h[ok]); np.minimum.at(Hl, hb[ok], l[ok]); np.add.at(Hv, hb[ok], v[ok])
last = np.searchsorted(hb, np.arange(nh), 'right') - 1; Hc = c[last]; Ht = H0 + 3600 * np.arange(nh)
def ema(x, n):
    a = 2 / (n + 1); out = np.empty_like(x); s = x[0]
    for i in range(len(x)): s = a * x[i] + (1 - a) * s if i else x[i]; out[i] = s
    return out
pc = np.r_[Hc[0], Hc[:-1]]; tr = np.maximum(Hh - Hl, np.maximum(abs(Hh - pc), abs(Hl - pc))); ATR = ema(tr, 14)
E20, E50, E200 = ema(Hc, 20), ema(Hc, 50), ema(Hc, 200)
def rsi(x, n=14):
    d = np.diff(x, prepend=x[0]); u = ema(np.maximum(d, 0), n); dn = ema(np.maximum(-d, 0), n); return 100 - 100 / (1 + u / np.maximum(dn, 1e-12))
R1 = rsi(Hc); H4c = Hc[3::4]; R4 = np.repeat(rsi(H4c), 4)[:nh] if len(H4c) else R1 * 0
R4 = np.r_[np.full(3, 50), R4][:nh]
def roll_med(x, n):
    out = np.full(len(x), np.nan)
    for i in range(n, len(x), 24): out[i:i + 24] = np.median(x[i - n:i])
    return out
ATRm = roll_med(ATR, 720)
m20 = np.convolve(Hc, np.ones(20) / 20, 'full')[:nh]; s20 = np.sqrt(np.maximum(np.convolve(Hc ** 2, np.ones(20) / 20, 'full')[:nh] - m20 ** 2, 0)); BW = 4 * s20 / m20
def roll_rank(x, n):
    out = np.full(len(x), np.nan)
    for i in range(n, len(x)): out[i] = (x[i - n:i] < x[i]).mean()
    return out
BWr = roll_rank(BW, 720)
day = (Ht // 86400); dc = {}
for i in range(nh): dc[day[i]] = Hc[i]
days = np.array(sorted(dc)); dclose = np.array([dc[d] for d in days]); dS50 = np.convolve(dclose, np.ones(50) / 50, 'full')[:len(days)]; dS50[:49] = np.nan
# ---- decisiones: cada 10 min, minuto t = inicio de un múltiplo de 600 s, L-V 7-21 Madrid ----
tz = ZoneInfo('Europe/Madrid')
cand = T[(T % 600 == 0) & (T >= T[0] + 40 * 86400) & (T + (DELAY + HOLD) * 60 < T[-1])]
loc = [dt.datetime.fromtimestamp(int(x), tz) for x in cand]
office = np.array([d.weekday() < 5 and 7 <= d.hour < 21 for d in loc])
td = cand[office]; hour = np.array([d.hour for d, f in zip(loc, office) if f]); wd = np.array([d.weekday() for d, f in zip(loc, office) if f])
im = ((td - t0) // 60).astype(np.int64)        # minuto de la decisión: se conocen los minutos < im
ih = np.searchsorted(Ht, td - 3600, 'right') - 1  # última hora cerrada
print('decisiones', len(td), flush=True)
# ---- variables de liquidez (minuto a minuto) ----
lr = np.diff(np.log(c), prepend=np.log(c[0]))
sig = np.sqrt(np.convolve(lr ** 2, np.ones(1440) / 1440, 'full')[:N]) + 1e-9
Phi = lambda z: 0.5 * (1 + np.vectorize(erf)(z / np.sqrt(2))) if False else None
from scipy.special import ndtr
bv = v * (2 * ndtr(lr / sig) - 1)                 # volumen comprador menos vendedor estimado (BVC)
cv, cbv = np.cumsum(np.r_[0, v]), np.cumsum(np.r_[0, bv])
cam = np.cumsum(np.r_[0, np.abs(lr) / np.maximum(v, 1e-6) * (v > 0)]); cn = np.cumsum(np.r_[0, (v > 0).astype(float)])
def win(cs, i, W): return cs[i] - cs[np.maximum(i - W, 0)]
F = {}; FAM = {}
vol7 = win(cv, im, 10080) / 10080
for W in (10, 60, 240):
    vw = win(cv, im, W); F[f'liq_imb{W}'] = win(cbv, im, W) / np.maximum(vw, 1e-9)
    F[f'liq_volz{W}'] = np.log((vw / W + 1e-9) / (vol7 + 1e-9))
    hi = np.array([h[i - W:i].max() for i in im]) if W <= 60 else None
    FAM.update({f'liq_imb{W}': 'liq', f'liq_volz{W}': 'liq'})
for W in (60, 240):
    hiW = np.array([h[i - W:i].max() for i in im]); loW = np.array([l[i - W:i].min() for i in im]); oW = o[im - W]; cW = c[im - 1]
    rng = np.maximum(hiW - loW, 1e-9); at = ATR[ih]
    F[f'liq_absorb{W}'] = F[f'liq_volz{W}'] - np.log(rng / at + 1e-6)
    F[f'liq_upwick{W}'] = (hiW - np.maximum(oW, cW)) / rng; F[f'liq_lowick{W}'] = (np.minimum(oW, cW) - loW) / rng
    am = win(cam, im, W) / np.maximum(win(cn, im, W), 1); am7 = win(cam, im, 10080) / np.maximum(win(cn, im, 10080), 1)
    F[f'liq_amihud{W}'] = np.log((am + 1e-12) / (am7 + 1e-12))
    for k in ('absorb', 'upwick', 'lowick', 'amihud'): FAM[f'liq_{k}{W}'] = 'liq'
cpv = np.cumsum(np.r_[0, c * v]); vwap = win(cpv, im, 1440) / np.maximum(win(cv, im, 1440), 1e-9)
F['liq_vwapdist'] = (c[im - 1] - vwap) / ATR[ih]; FAM['liq_vwapdist'] = 'liq'
F['liq_bvc1d'] = win(cbv, im, 1440) / np.maximum(win(cv, im, 1440), 1e-9); FAM['liq_bvc1d'] = 'liq'
jf = np.searchsorted(ft, td, 'right') - 1; f3 = np.array([fr[max(0, j - 8):j + 1].mean() if j >= 0 else np.nan for j in jf])
F['liq_fund'] = np.where((jf >= 0) & (td - ft[np.maximum(jf, 0)] < 9 * 3600), fr[np.maximum(jf, 0)] * 1e4, np.nan); F['liq_fund3d'] = f3 * 1e4
FAM['liq_fund'] = FAM['liq_fund3d'] = 'liq'
# ---- variables técnicas ----
px = c[im - 1]; at = ATR[ih]
for nm, W in (('10m', 10), ('1h', 60), ('4h', 240), ('1d', 1440), ('7d', 10080)):
    F[f'tec_ret{nm}'] = (px - c[im - 1 - W]) / at; FAM[f'tec_ret{nm}'] = 'tec'
F['tec_e20'] = (px - E20[ih]) / at; F['tec_e50'] = (px - E50[ih]) / at; F['tec_e200'] = (px - E200[ih]) / at
F['tec_e50slope'] = (E50[ih] - E50[np.maximum(ih - 24, 0)]) / at
F['tec_rsi1h'] = R1[ih]; F['tec_rsi4h'] = R4[ih]
hi24 = np.array([h[i - 1440:i].max() for i in im]); lo24 = np.array([l[i - 1440:i].min() for i in im])
hi5d = np.array([Hh[max(0, j - 119):j + 1].max() for j in ih]); lo5d = np.array([Hl[max(0, j - 119):j + 1].min() for j in ih])
F['tec_pos24h'] = (px - lo24) / np.maximum(hi24 - lo24, 1e-9); F['tec_pos5d'] = (px - lo5d) / np.maximum(hi5d - lo5d, 1e-9)
F['tec_dist24hi'] = (hi24 - px) / at; F['tec_dist24lo'] = (px - lo24) / at
F['tec_volreg'] = at / ATRm[ih]; F['tec_bwrank'] = BWr[ih]
di = np.searchsorted(days, td // 86400, 'left') - 1   # último día cerrado
F['tec_d50'] = (px - dS50[np.maximum(di, 0)]) / (at * 24 ** 0.5)
for k in F:
    if k.startswith('tec_') and k not in FAM: FAM[k] = 'tec'
F['reg_hour'] = hour.astype(float); F['reg_wd'] = wd.astype(float); FAM['reg_hour'] = FAM['reg_wd'] = 'reg'
# ---- etiquetas: largo y corto, stop 1,5 ATR(1h), objetivo 1,5R, máx 24 h, stop primero si coinciden en el mismo minuto ----
ie = im + DELAY; e = o[ie]; risk = KSTOP * at
out = {}
for s, nm in ((1, 'L'), (-1, 'S')):
    sl = e - s * risk; tp = e + s * RR * risk; r = np.full(len(td), np.nan); ex = np.full(len(td), -1); why = np.zeros(len(td), np.int8)
    done = np.zeros(len(td), bool); mfe = np.zeros(len(td)); mae = np.zeros(len(td))
    for j in range(HOLD):
        ii = ie + j; hs = (l[ii] <= sl) if s == 1 else (h[ii] >= sl); ht = (h[ii] >= tp) if s == 1 else (l[ii] <= tp)
        fav = ((h[ii] - e) if s == 1 else (e - l[ii])) / risk; adv = ((e - l[ii]) if s == 1 else (h[ii] - e)) / risk
        mfe = np.where(done, mfe, np.maximum(mfe, fav)); mae = np.where(done, mae, np.maximum(mae, adv))
        m = ~done & hs; r[m] = -1 - SLIP * e[m] / risk[m]; ex[m] = ii[m]; why[m] = 1; done |= m
        m = ~done & ht; r[m] = RR; ex[m] = ii[m]; why[m] = 2; done |= m
    m = ~done; ii = ie + HOLD - 1; r[m] = (c[ii[m]] - e[m]) * s / risk[m]; ex[m] = ii[m]; why[m] = 3
    tex = T[ex] + 60
    fund = np.array([fund_between(a, b) for a, b in zip(T[ie], tex)])
    r = r - FEE * e / risk - s * fund * e / risk
    out[nm] = dict(r=r, tex=tex, why=why, mfe=mfe, mae=mae)
    print(nm, 'R medio', np.nanmean(r).round(3), 'acierto', np.nanmean(r > 0).round(3), flush=True)
names = sorted(F); X = np.vstack([F[k] for k in names]).T.astype(np.float32)
np.savez_compressed('/tmp/claude-0/-home-user-Poly-Bot/62062f9b-9ffe-50c1-8835-98e9f5ba9b0f/scratchpad/ala2/a2_bank.npz', X=X, names=np.array(names), fam=np.array([FAM[k] for k in names]), td=td, te=T[ie], entry=e, risk=risk,
    rL=out['L']['r'], rS=out['S']['r'], texL=out['L']['tex'], texS=out['S']['tex'], whyL=out['L']['why'], whyS=out['S']['why'],
    mfeL=out['L']['mfe'], maeL=out['L']['mae'], mfeS=out['S']['mfe'], maeS=out['S']['mae'])
print('ok', X.shape)

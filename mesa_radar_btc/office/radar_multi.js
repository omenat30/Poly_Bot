// Motor de la estrategia (idéntico al del panel)
// "Ruptura de momentum" — the single validated strategy, run causally over 15m candles.
// Shared by the Node verification harness and the artifact. Higher timeframes are built from the 15m bars.
// Conocimiento del Radar para la oficina (v12): motor del Radar BTC 15m (idéntico, parámetros V20) que además registra
// las señales de su propio modelo que el Radar no puede tomar por tener ya una operación abierta (extra: true).
(function (root) {
  'use strict';
  // v5 (6 oct 2026): v4 + longs only while the 4H trend is not mature (ADX(14) on 4H below 30).
  // v4: v3 + stricter shorts (1H MACD histogram below zero and breakout volume above 1.5x).
  // v3: fresh levels only (no equal highs/lows = no liquidity pools), 15m EMA alignment,
  // breakeven at +1R and a 3R target. Range 6h, stop 2 ATR(1H), time stop 72h.
  const DEF = {
    rangeBars: 24,      // 15m bars that define the range to break (6h)
    rvolMin: 1.0,       // breakout bar volume above its 20-bar average
    rangeAtrMin: 0,     // minimum range width, ATR(15m)
    rangeAtrMax: 12,    // skip ranges wider than 12 ATR(15m)
    trendMin: -0.5, trendMax: 2.5, // 1H close distance from EMA50(1H), in ATR(1H), in trade direction
    adxMax: 1e9,        // ADX(1H) cap (off)
    longNeeds4H: false, // 4H trend filter for longs (off)
    freshLevel: true,   // the broken level must be fresh: no other bar in the range within 0.15 ATR of it
    touchTol: 0.15,
    emaAlign: true,     // 15m EMA21 vs EMA50 must point the way of the trade
    shortVolMin: 1.5,   // shorts: breakout bar volume above 1.5x its 20-bar average
    shortMacd1H: true,  // shorts: 1H MACD histogram (12,26,9) below zero
    longAdx4Max: 30,    // longs: ADX(14) on 4H below 30 (late longs in a mature 4H trend fail)
    longPdhZone: null,  // [lo, hi] in ATR(1H): skip longs when (previous UTC day high - close) is inside this band (v6, 1.65R mode: [-0.5, 1])
    shortExtPdl: null,  // v7 (1.65R mode: -4): shorts also allowed beyond the 1H trend band when close is this many ATR(1H) below the previous UTC day low
    longRsi4Max: null,  // v8 (1.65R mode: 62): longs only while RSI(14) on 4H is below this (no late longs into an overbought 4H)
    skipHourUTC: null,  // v8 (1.65R mode: 21): no new signals on 15m bars closing in this UTC hour (after the US close, breakouts fade)
    poolZone: null,     // v9 (1.65R mode: [0.7, 1.2]): skip a breakout when the nearest untaken swing high (long) / low (short) of the last 48 h sits this many R ahead — a wall before the target
    oppPool: null,      // v11 adds {lo2: 1, hi2: 1.5, w2: 3.5}: a very strong cluster right beyond the stop (1–1.5R behind) — price runs to it and takes the stop
                        // v10 (1.65R mode: {lo: 0.5, hi: 1, w: 2}): skip a breakout when a strong liquidity cluster (equal untaken swing lows for a long / highs for a short,
                        //   weighted by the relative volume that built them) sits between lo and hi R behind the entry — it pulls price to the stop
    sweep: null,        // v12 (1.65R mode: {lb: 96, macdLo: 1.5, macdHi: 3}): liquidity sweeps. A sweep = a 15m wick through an untaken 3-bar pivot
                        //   (last 192 bars) that closes back inside, weighted by the volume that built the pivot (min 3 per pivot).
                        //   Breakouts need an opposite-side sweep in the last `lb` bars (sell-side swept before a long, buy-side before a short);
                        //   a short that only fails the 1H MACD condition is rescued when that sweep weight is in (macdLo, macdHi]
    volRegime: null,    // v15 (1.65R mode: {spike: 2, calm: 0.8, calmTouchTol: 0.08, calmShortVolMin: 1.2}): ATR(1H) vs its median of the previous 720 hours.
                        //   No new trades when it is >= spike x (stops too wide in a volatility burst); when it is <= calm x, the equal-highs/lows tolerance
                        //   and the short volume minimum are relaxed (breakouts from quiet markets have room to run)
    ichiCloudMax: null, // v16 (1.65R mode: 2.5): skip breakouts when the 15m Ichimoku cloud (9/26/52, displaced 26) under the bar is this many ATR(15m) thick or more
    quality: null,      // v17 (1.65R mode: {min: -1}): breakout quality score, the breakout is skipped below min:
                        //   +1 swing structure 3-4 of 4 (HH/HL for longs), -1 structure 0-1, +1 prior compression (mean TR 12 bars < 0.8 x mean TR 96),
                        //   -1 MACD(15m) histogram divergence (below its max of the range bars), -1 7-day high (long) / low (short) between entry and 1.65R
    roundWall: null,    // v16 test: {step: 1000, minR: 0.15}: skip breakouts with a round price level less than minR ahead
    momo: null,         // v16 (1.65R mode: {emaRoc: 1.4, adx4Rsi: 14}): 1H momentum overrides — a breakout against the 15m EMA21/50 is allowed when the 1H close moved >= emaRoc ATR(1H) its way in the last 4 hours;
                        //   a long in a mature 4H trend (ADX 4H >= longAdx4Max) is allowed when RSI(14) 1H rose >= adx4Rsi points in the last 3 hours
    bw1Max: null,       // v14 (1.65R mode: 0.97): skip breakouts when the 1H Bollinger band width ranks above this among the last 120 hours (volatility climax)
    mr: null,           // v9 (1.65R mode: {dev: 3.5, back: 1, win: 16, adxMax: 22}; v12: dev 3, swLb 32, swLo 0.8, swHi 3.5): mean reversion in a trendless market (ADX 1H < adxMax):
                        //   after a close more than `dev` ATR(15m) away from the 15m EMA20, trade the snap-back once the close returns within `back` ATR (within `win` bars)
    swp: null,          // v19.2 (1.65R mode: {adxMax: 22, eq: 3, vr: 1.2, dropMax: 12}): rebound after a liquidity sweep, in a trendless 1H (ADX < adxMax) on the right side of the 4H EMA 200:
                        //   a new 48h low (high) made in the last 4 h, then the first close back over (under) the 15m EMA 20, with a cluster of equal untaken highs (lows) of weight >= eq
                        //   within 3R on the target side, ATR(1H) < vr x its 30-day median and the move into the sweep < dropMax ATR(1H). One entry per swept extreme.
    grade: null,        // v20 (1.65R mode: {a: 6, b: 3}): signal quality A/B/C (information + suggested risk; never blocks a trade). One point each for:
                        //   liquidity — opposite-side sweep weight >= 2.5 in the last 8 h, equal untaken levels on the target side (cluster >= 0.5 within 3R, >= 1 within 1.65R),
                        //   untaken swings of weight >= 2 between entry and target, the nearest one < 0.25R away; extension — close < 2.5 ATR(15m) from the 15m EMA 20
                        //   and < 1 ATR(1H) beyond the 15m EMA 50 in the trade direction; regime — ADX 1H < 30, ADX 4H < 20, ATR 1H < 0.9x its 30-day median, bar volume < 3x.
    stopAtr: 2,         // initial stop = 2 x ATR(1H)
    rr: 3,              // take profit at 3R
    beAt: 1,            // move the stop to breakeven (entry + costs) once price has gone +1R (0 = off)
    maxBars: 288,       // time stop: 72h
    fee: 0.0008,        // round-trip cost (fees + slippage), fraction of price
    weekdaysOnly: true,
  };

  function ema(src, n) { const o = new Float64Array(src.length).fill(NaN), k = 2 / (n + 1); let p = NaN, s = 0;
    for (let i = 0; i < src.length; i++) { if (i < n) { s += src[i]; if (i === n - 1) { p = s / n; o[i] = p; } continue; } p = src[i] * k + p * (1 - k); o[i] = p; } return o; }
  function wma(src, n) { const o = new Float64Array(src.length).fill(NaN), den = n * (n + 1) / 2; for (let i = n - 1; i < src.length; i++) { let s = 0; for (let k = 0; k < n; k++) s += src[i - k] * (n - k); o[i] = s / den; } return o; }
  function sma(src, n) { const o = new Float64Array(src.length).fill(NaN); let s = 0;
    for (let i = 0; i < src.length; i++) { s += src[i]; if (i >= n) s -= src[i - n]; if (i >= n - 1) o[i] = s / n; } return o; }
  function atr(h, l, c, n) { const o = new Float64Array(h.length).fill(NaN); let p = 0;
    for (let i = 0; i < h.length; i++) { const tr = i === 0 ? h[i] - l[i] : Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1]));
      if (i < n) { p += tr; if (i === n - 1) { p /= n; o[i] = p; } continue; } p = (p * (n - 1) + tr) / n; o[i] = p; } return o; }
  function rsi(c, n) { const o = new Float64Array(c.length).fill(NaN); let ag = 0, al = 0;
    for (let i = 1; i < c.length; i++) { const d = c[i] - c[i - 1], g = d > 0 ? d : 0, l = d < 0 ? -d : 0;
      if (i <= n) { ag += g; al += l; if (i === n) { ag /= n; al /= n; o[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al); } continue; }
      ag = (ag * (n - 1) + g) / n; al = (al * (n - 1) + l) / n; o[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al); } return o; }
  function macdHist(c) { const a = ema(c, 12), b = ema(c, 26), line = new Float64Array(c.length); for (let i = 0; i < c.length; i++) line[i] = a[i] - b[i];
    const f = line.findIndex(x => !isNaN(x)), sig = new Float64Array(c.length).fill(NaN);
    if (f >= 0) { const e = ema(line.subarray(f), 9); sig.set(e, f); }
    const h = new Float64Array(c.length); for (let i = 0; i < c.length; i++) h[i] = line[i] - sig[i]; return h; }

  // Aggregate 15m bars (struct of arrays) into a higher timeframe of `sec` seconds
  function aggregate(B, sec) {
    const t = [], o = [], h = [], l = [], c = [], v = [];
    for (let i = 0; i < B.t.length; i++) {
      const k = Math.floor(B.t[i] / sec) * sec, n = t.length - 1;
      if (n >= 0 && t[n] === k) { h[n] = Math.max(h[n], B.h[i]); l[n] = Math.min(l[n], B.l[i]); c[n] = B.c[i]; v[n] += B.v[i]; }
      else { t.push(k); o.push(B.o[i]); h.push(B.h[i]); l.push(B.l[i]); c.push(B.c[i]); v.push(B.v[i]); }
    }
    return { t, o, h, l, c, v };
  }
  function adx(h, l, c, n) {
    const len = h.length, out = new Float64Array(len).fill(NaN);
    let trS = 0, pS = 0, mS = 0, dxSum = 0, dxN = 0, prev = NaN;
    for (let i = 1; i < len; i++) {
      const up = h[i] - h[i - 1], dn = l[i - 1] - l[i];
      const pdm = up > dn && up > 0 ? up : 0, mdm = dn > up && dn > 0 ? dn : 0;
      const tr = Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1]));
      if (i <= n) { trS += tr; pS += pdm; mS += mdm; if (i < n) continue; }
      else { trS = trS - trS / n + tr; pS = pS - pS / n + pdm; mS = mS - mS / n + mdm; }
      const pdi = 100 * pS / trS, mdi = 100 * mS / trS, dx = 100 * Math.abs(pdi - mdi) / Math.max(pdi + mdi, 1e-9);
      if (isNaN(prev)) { dxSum += dx; dxN++; if (dxN === n) { prev = dxSum / n; out[i] = prev; } }
      else { prev = (prev * (n - 1) + dx) / n; out[i] = prev; }
    }
    return out;
  }
  function htfIndicators(X) {
    return { e21: ema(X.c, 21), e50: ema(X.c, 50), e200: ema(X.c, 200), atr: atr(X.h, X.l, X.c, 14), rsi: rsi(X.c, 14), hist: macdHist(X.c), adx: adx(X.h, X.l, X.c, 14) };
  }

  // B: {t,o,h,l,c,v} arrays of 15m bars (t = open time, unix seconds, contiguous enough)
  function run(B, opt) {
    const P = Object.assign({}, DEF, opt || {});
    const n = B.t.length, F = P.barSec || 900, SB = x => Math.max(1, Math.round(x * 900 / F));
    const A15 = atr(B.h, B.l, B.c, 14), vma = P.vmaKind === 'ema' ? ema(B.v, 20) : P.vmaKind === 'wma' ? wma(B.v, 20) : sma(B.v, 20), e21 = ema(B.c, P.emaFast || 21), e50 = ema(B.c, P.emaSlow || 50), r15 = rsi(B.c, 14), mh15 = macdHist(B.c);
    const H1 = aggregate(B, 3600), H4 = aggregate(B, 14400);
    // previous UTC day high for every 15m bar
    const pdh = new Float64Array(n).fill(NaN), pdl = new Float64Array(n).fill(NaN);
    { let day = -1, hi = -Infinity, lo = Infinity, ph = NaN, pl = NaN; for (let i = 0; i < n; i++) { const dk = Math.floor(B.t[i] / 86400); if (dk !== day) { if (day >= 0) { ph = hi; pl = lo; } day = dk; hi = -Infinity; lo = Infinity; } pdh[i] = ph; pdl[i] = pl; if (B.h[i] > hi) hi = B.h[i]; if (B.l[i] < lo) lo = B.l[i]; } }
    const I1 = htfIndicators(H1), I4 = htfIndicators(H4);
    // map each 15m bar to the last CLOSED 1H / 4H bar at its close time
    const j1 = new Int32Array(n), j4 = new Int32Array(n);
    let p1 = -1, p4 = -1;
    for (let i = 0; i < n; i++) {
      const ct = B.t[i] + F;
      while (p1 + 1 < H1.t.length && H1.t[p1 + 1] + 3600 <= ct) p1++;
      while (p4 + 1 < H4.t.length && H4.t[p4 + 1] + 14400 <= ct) p4++;
      j1[i] = p1; j4[i] = p4;
    }

    // 3-bar pivots (confirmed 3 bars later) for the liquidity-pool filter
    const PK = 3, pivH = new Uint8Array(n), pivL = new Uint8Array(n);
    for (let j = PK; j < n - PK; j++) { let ph = 1, pl = 1; for (let q = j - PK; q <= j + PK; q++) { if (q === j) continue; if (B.h[q] >= B.h[j]) ph = 0; if (B.l[q] <= B.l[j]) pl = 0; } pivH[j] = ph; pivL[j] = pl; }
    function nearestPool(i, s, R) { // nearest untaken pivot in the trade direction (last 192 bars), distance in R
      let ext = s === 1 ? -Infinity : Infinity, best = Infinity;
      for (let j = i; j >= Math.max(PK, i - SB(192)); j--) {
        if (j <= i - PK && (s === 1 ? pivH[j] : pivL[j])) { const p = s === 1 ? B.h[j] : B.l[j]; if (s === 1 ? p > ext : p < ext) { const dd = (p - B.c[i]) * s / R; if (dd > 0 && dd < best) best = dd; } }
        ext = s === 1 ? Math.max(ext, B.h[j]) : Math.min(ext, B.l[j]);
      }
      return best;
    }
    function oppCluster(i, s, R, tol, zlo, zhi) { // strongest cluster weight of untaken pivots on the stop side, between oppPool.lo and .hi R behind
      const lv = []; let ext = s === 1 ? Infinity : -Infinity;   // opposite direction: lows for a long, highs for a short
      for (let j = i; j >= Math.max(PK, i - SB(192)); j--) {
        if (j <= i - PK && (s === 1 ? pivL[j] : pivH[j])) { const p = s === 1 ? B.l[j] : B.h[j]; if (s === 1 ? p < ext : p > ext) lv.push([p, Math.min(3, B.v[j] / Math.max(vma[j], 1e-12))]); }
        ext = s === 1 ? Math.min(ext, B.l[j]) : Math.max(ext, B.h[j]);
      }
      let best = 0;
      for (const [p] of lv) { const dd = (B.c[i] - p) * s / R; if (!(dd > zlo && dd <= zhi)) continue;
        let cw = 0; for (const [q, w] of lv) if (Math.abs(q - p) <= tol) cw += w; if (cw > best) best = cw; }
      return best;
    }
    // v12 liquidity sweeps per bar: swL = sell-side (lows) swept with a close back above, swH = buy-side (highs) swept with a close back below
    const swL = new Float64Array(n), swH = new Float64Array(n);
    if (P.sweep || (P.mr && P.mr.swLb) || (P.mrBB && P.mrBB.swLb)) for (let k = 200; k < n; k++) {
      let extL = Infinity, extH = -Infinity;
      for (let j = k - 1; j >= k - SB(192); j--) {
        if (j <= k - 1 - PK) {
          if (pivL[j] && B.l[j] < extL && B.l[k] < B.l[j] && B.c[k] > B.l[j]) swL[k] += Math.min(3, B.v[j] / Math.max(vma[j], 1e-12));
          if (pivH[j] && B.h[j] > extH && B.h[k] > B.h[j] && B.c[k] < B.h[j]) swH[k] += Math.min(3, B.v[j] / Math.max(vma[j], 1e-12));
        }
        extL = Math.min(extL, B.l[j]); extH = Math.max(extH, B.h[j]);
      }
    }
    // strongest opposite-side sweep (lows for a long, highs for a short) in bars [i-N, i]
    function sweepOpp(i, s, N) { const A = s === 1 ? swL : swH; let m = 0; for (let k = Math.max(0, i - N); k <= i; k++) if (A[k] > m) m = A[k]; return m; }
    // v13: Bollinger(20, 2) of the 1H closes, for the %B filter of the reversions; 15m Bollinger z-score for the second reversion
    const bb1m = sma(H1.c, 20), bb1sd = new Float64Array(H1.c.length).fill(NaN);
    for (let a = 19; a < H1.c.length; a++) { let q = 0; for (let z = a - 19; z <= a; z++) q += (H1.c[z] - bb1m[a]) ** 2; bb1sd[a] = Math.sqrt(q / 20); }
    const pB1 = (a, s) => { const up = bb1m[a] + 2 * bb1sd[a], lo = bb1m[a] - 2 * bb1sd[a]; return s === 1 ? (H1.c[a] - lo) / (up - lo) : (up - H1.c[a]) / (up - lo); };
    const sm20 = P.bbKind === 'ema' ? ema(B.c, 20) : P.bbKind === 'wma' ? wma(B.c, 20) : sma(B.c, 20), sd20 = new Float64Array(n).fill(NaN);
    if (P.mrBB) for (let k = 19; k < n; k++) { let q = 0; for (let z = k - 19; z <= k; z++) q += (B.c[z] - sm20[k]) ** 2; sd20[k] = Math.sqrt(q / 20); }
    // v14: rank of the 1H Bollinger(20, 2) band width among the previous 120 closed hours (1 = widest in 5 days)
    // v15: ATR(1H) relative to its median over the previous 720 closed hours
    const atrMed = new Float64Array(H1.c.length).fill(NaN);
    if (P.volRegime) { const buf = []; for (let a = 0; a < H1.c.length; a++) { if (a >= 740) { const z = I1.atr.slice(a - 720, a).sort((u, v) => u - v); atrMed[a] = (z[359] + z[360]) / 2; } } }
    const volRel = a => I1.atr[a] / atrMed[a];
    // v16: 15m Ichimoku cloud thickness under the current bar (spans computed 26 bars earlier), in ATR(15m)
    const cloud15 = new Float64Array(n).fill(NaN);
    if (P.ichiCloudMax != null) { const mid = (k, p) => { let h = -Infinity, l = Infinity; for (let j = k - p + 1; j <= k; j++) { if (B.h[j] > h) h = B.h[j]; if (B.l[j] < l) l = B.l[j]; } return (h + l) / 2; };
      for (let k = 77; k < n; k++) { const q = k - 26, sa = (mid(q, 9) + mid(q, 26)) / 2, sb = mid(q, 52); cloud15[k] = Math.abs(sa - sb) / A15[k]; } }
    // v17: breakout quality score
    const pvH = new Uint8Array(n), pvL = new Uint8Array(n), TRv = new Float64Array(n);
    for (let j = 0; j < n; j++) { TRv[j] = j === 0 ? B.h[j] - B.l[j] : Math.max(B.h[j] - B.l[j], Math.abs(B.h[j] - B.c[j - 1]), Math.abs(B.l[j] - B.c[j - 1]));
      if (j >= 3 && j + 3 < n) { let h = true, l = true; for (let k = 1; k <= 3; k++) { if (!(B.h[j] > B.h[j - k] && B.h[j] > B.h[j + k])) h = false; if (!(B.l[j] < B.l[j - k] && B.l[j] < B.l[j + k])) l = false; } pvH[j] = h ? 1 : 0; pvL[j] = l ? 1 : 0; } }
    function qualScore(i, d, h1atr) {
      const PH = [], PL = []; for (let k = i - 3; k >= i - SB(192) && (PH.length < 3 || PL.length < 3); k--) { if (pvH[k] && PH.length < 3) PH.push(B.h[k]); if (pvL[k] && PL.length < 3) PL.push(B.l[k]); }
      let ss = 0; if (PH.length >= 3 && PL.length >= 3) { const up = d === 1; ss += (up ? PH[0] > PH[1] : PL[0] < PL[1]) ? 1 : 0; ss += (up ? PL[0] > PL[1] : PH[0] < PH[1]) ? 1 : 0; ss += (up ? PH[1] > PH[2] : PL[1] < PL[2]) ? 1 : 0; ss += (up ? PL[1] > PL[2] : PH[1] < PH[2]) ? 1 : 0; }
      const q96 = SB(96), q12 = SB(12); let t12 = 0, t96 = 0; for (let k = i - q96; k < i; k++) { t96 += TRv[k]; if (k >= i - q12) t12 += TRv[k]; }
      let mMax = -Infinity; for (let k = i - P.rangeBars; k < i; k++) mMax = Math.max(mMax, d * mh15[k]);
      let ext = d === 1 ? -Infinity : Infinity; for (let k = i - SB(672); k < i - P.rangeBars; k++) ext = d === 1 ? Math.max(ext, B.h[k]) : Math.min(ext, B.l[k]);
      const wk = (ext - B.c[i]) * d / (P.stopAtr * h1atr);
      const q = { ss, vcr: (t12 / q12) / (t96 / q96), div: mMax - d * mh15[i], wk };
      q.score = (ss >= 3 ? 1 : 0) - (ss <= 1 ? 1 : 0) + (q.vcr < 0.8 ? 1 : 0) - (q.div > 0 ? 1 : 0) - (wk >= 0 && wk <= 1.65 ? 1 : 0);
      return q;
    }
    const roc1h = (a, s) => s * (H1.c[a] - H1.c[a - 4]) / I1.atr[a], rsi1up = a => I1.rsi[a] - I1.rsi[a - 3];
    const bw1Rank = a => { const w = 4 * bb1sd[a] / bb1m[a]; let k = 0; for (let j = a - 120; j < a; j++) if (4 * bb1sd[j] / bb1m[j] < w) k++; return k / 120; };
    // mean-reversion state machines (run on every bar, whether or not a trade is open):
    //   mr   — deviation from the 15m EMA20 in ATR(15m) units (v9)
    //   mrBB — v13: deviation from the 15m SMA20 in standard deviations (Bollinger z-score)
    function makeMr(MR, devOf) {
      let arm = 0, idx = -1;
      const st = { get arm() { return arm; } };
      st.step = (i, x) => {
        if (!MR || !x) return 0;
        const dev = devOf(i);
        if (dev <= -MR.dev) { if (arm !== 1) arm = 1; idx = i; }
        else if (dev >= MR.dev) { if (arm !== -1) arm = -1; idx = i; }
        if (!arm) return 0;
        if (i - idx > MR.win) { arm = 0; return 0; }
        const s = arm, trig = s === 1 ? (dev >= -MR.back && dev > -MR.dev) : (dev <= MR.back && dev < MR.dev);
        if (!trig) return 0;
        arm = 0;
        const dow = new Date((B.t[i] + F) * 1000).getUTCDay();
        if (P.weekdaysOnly && (dow === 0 || dow === 6)) return 0;
        if (!(x.adx1 < MR.adxMax)) return 0;
        if (MR.swLb) { const w = sweepOpp(i, s, MR.swLb); if (!(w > MR.swLo && w <= MR.swHi)) return 0; }
        if (MR.pB1Max != null && !(pB1(x.a, s) <= MR.pB1Max)) return 0;
        return s;
      };
      return st;
    }
    const MR = P.mr, mrA = makeMr(P.mr, i => (B.c[i] - e20[i]) / A15[i]), mrB = makeMr(P.mrBB, i => (B.c[i] - sm20[i]) / sd20[i]);
    const e20 = ema(B.c, 20);
    const trades = []; let open = null, pendC = null, pendLive = null, pendCX = null, extras = []; const swpSeen = [null, null, null];
    const warm = Math.max(P.rangeBars + 2, 60);
    for (let i = warm; i < n; i++) {
      // manage the open trade on this bar (entry happened at the open of a later bar than its signal)
      if (open && i >= open.entryIdx) {
        const side = open.side;
        const adverse = side === 1 ? B.l[i] : B.h[i], fav = side === 1 ? B.h[i] : B.l[i];
        if ((adverse - open.sl) * side <= 0) close(open, i, open.sl, open.beOn ? 'be' : 'stop');
        else if ((fav - open.tp) * side >= 0) close(open, i, open.tp, 'target');
        else if (i - open.sigIdx >= P.maxBars) close(open, i, B.c[i], 'tiempo');
        if (open.exitIdx != null) open = null;
        else {
          // end of bar: arm breakeven for the next bar once the trade has gone beAt R in favour
          if ((fav - open.best) * side > 0) open.best = fav;
          if (P.beAt > 0 && !open.beOn && (open.best - open.entry) * side / open.risk >= P.beAt) { open.beOn = true; open.beIdx = i; open.sl = open.entry + side * P.fee * open.entry; }
        }
      }
      // aprendices: gestionan las operaciones que el Radar no pudo tomar por estar ocupado
      for (const x of extras) if (x.exitIdx == null && i >= x.entryIdx) {
        const side = x.side, adverse = side === 1 ? B.l[i] : B.h[i], fav = side === 1 ? B.h[i] : B.l[i];
        if ((adverse - x.sl) * side <= 0) close(x, i, x.sl, 'stop');
        else if ((fav - x.tp) * side >= 0) close(x, i, x.tp, 'target');
        else if (i - x.sigIdx >= P.maxBars) close(x, i, B.c[i], 'tiempo');
      }
      extras = extras.filter(x => x.exitIdx == null);
      const cx = ctxAt(i), mrSide = mrA.step(i, cx), mrSideB = mrB.step(i, cx);
      const busy = !!open;
      if (busy && !P.multi) continue;
      const swpBak = busy ? swpSeen.slice() : null;
      if (busy) { const q = pendC; pendC = pendCX; pendCX = q; }
      let s = null;
      if (pendC) { const c = pendC; pendC = null; if ((B.c[i] - c.ref) * c.s.side > 0) s = Object.assign({}, c.s, { confirmed: c.i }); }
      else {
      s = signalAt(i);
      if (s && P.quality && i >= SB(700) && qualScore(i, s.side, s.h1atr).score < P.quality.min) s = null;
      const spike = P.volRegime && cx && volRel(cx.a) >= P.volRegime.spike;
      if (!s && mrSide && !spike) s = { side: mrSide, level: B.c[i], rvol: B.v[i] / Math.max(vma[i], 1e-12), trend: cx.d1 * mrSide, h1atr: cx.h1atr, kind: 'mr' };
      if (!s && mrSideB && !spike) s = { side: mrSideB, level: B.c[i], rvol: B.v[i] / Math.max(vma[i], 1e-12), trend: cx.d1 * mrSideB, h1atr: cx.h1atr, kind: 'mr', sub: 'bb' };
      if (!s && P.swp && cx && !spike) for (const side of [1, -1]) { const f = swpAt(i, side, cx); if (f) { swpSeen[side + 1] = f.extI; s = { side, level: B.c[i], rvol: B.v[i] / Math.max(vma[i], 1e-12), trend: cx.d1 * side, h1atr: cx.h1atr, kind: 'swp', swept: f.ext, sweptT: B.t[f.extI] + F, eq: f.eq, drop: f.drop }; break; } }
      // v18: half-hour confirmation — a signal on a bar that does not close a 30m candle waits one bar and is taken only if that bar closes beyond the signal close
      if (s && P.confirm30 && (P.confirm30.all || (B.t[i] + F) % 1800 !== 0) && (!P.confirm30.kinds || P.confirm30.kinds.includes(s.kind || 'bo'))) { if (i + 1 < n) pendC = { s, i, ref: P.confirm30.ref === 'level' ? s.level : B.c[i] }; else pendLive = { s, i }; s = null; }
      }
      if (busy) { const q = pendC; pendC = pendCX; pendCX = q; for (let k = 0; k < 3; k++) swpSeen[k] = swpBak[k];
        if (s && i + 1 < n && extras.length < (P.multi.max || 99)) { const entry = B.o[i + 1], risk = P.stopAtr * s.h1atr;
          const x = { extra: true, radarSide: open.side, ru: (B.c[i] - open.entry) * open.side / open.risk, side: s.side, sigIdx: i, sigT: B.t[i] + F, entryIdx: i + 1, entryT: B.t[i + 1], entry, risk, sl: entry - s.side * risk, sl0: entry - s.side * risk, tp: entry + s.side * P.rr * risk, level: s.level, kind: s.kind || 'bo', rvol: s.rvol, trend: s.trend };
          if (P.grade) Object.assign(x, gradeAt(i, x.side)); extras.push(x); trades.push(x); }
        continue; }
      if (s && i + 1 < n) {
        const entry = B.o[i + 1], risk = P.stopAtr * s.h1atr;
        open = { side: s.side, sigIdx: i, sigT: B.t[i] + F, entryIdx: i + 1, entryT: B.t[i + 1], entry, risk, best: entry, beOn: false,
                 sl: entry - s.side * risk, sl0: entry - s.side * risk, tp: entry + s.side * P.rr * risk, level: s.level, rvol: s.rvol, trend: s.trend, kind: s.kind || 'bo', sub: s.sub || null, rescue: s.rescue || null, swept: s.swept, eq: s.eq };
        if (P.grade) Object.assign(open, gradeAt(i, open.side));
        trades.push(open);
      } else if (s) {
        // signal on the very last closed bar: live entry at market now
        const entry = B.c[i], risk = P.stopAtr * s.h1atr;
        open = { side: s.side, sigIdx: i, sigT: B.t[i] + F, entryIdx: i + 1, entryT: B.t[i] + F, entry, risk, pending: true, best: entry, beOn: false,
                 sl: entry - s.side * risk, sl0: entry - s.side * risk, tp: entry + s.side * P.rr * risk, level: s.level, rvol: s.rvol, trend: s.trend, kind: s.kind || 'bo', sub: s.sub || null, rescue: s.rescue || null, swept: s.swept, eq: s.eq };
        if (P.grade) Object.assign(open, gradeAt(i, open.side));
        trades.push(open);
      }
    }

    function close(tr, i, px, why) {
      tr.exitIdx = i; tr.exitT = B.t[i] + F; tr.exit = px; tr.reason = why;
      const costR = P.fee * tr.entry / tr.risk;
      tr.r = (px - tr.entry) * tr.side / tr.risk - costR;
      tr.bars = i - tr.sigIdx;
    }

    function ctxAt(i) {
      const a = j1[i], b = j4[i];
      if (a < 200 || b < 60 || isNaN(A15[i]) || isNaN(vma[i])) return null;
      return { a, b, h1atr: I1.atr[a], d1: (H1.c[a] - I1.e50[a]) / I1.atr[a], adx1: I1.adx[a], adx4: I4.adx[b], rsi4: I4.rsi[b], h1hist: I1.hist[a], up4: H4.c[b] > I4.e50[b] && I4.e21[b] > I4.e50[b] };
    }
    // v20 signal quality (see the grade option): liquidity, extension and regime points at the signal bar
    function gradeAt(i, d) {
      const x = ctxAt(i); if (!x) return { grade: null };
      const a1 = x.h1atr, R = P.stopAtr * a1, SWo = d === 1 ? swL : swH;
      let sw32 = 0; for (let k = Math.max(0, i - SB(32)); k <= i; k++) sw32 = Math.max(sw32, SWo[k]);
      let run2 = d === 1 ? -Infinity : Infinity, nearT = 99, tgtW = 0;
      for (let j = i; j >= Math.max(PK, i - SB(192)); j--) {
        if (j <= i - PK && (d === 1 ? pivH[j] : pivL[j])) { const p = d === 1 ? B.h[j] : B.l[j];
          if (d === 1 ? p > run2 : p < run2) { const dd = d * (p - B.c[i]) / R; if (dd > 0) { nearT = Math.min(nearT, dd); if (dd <= 1.65) tgtW += Math.min(3, B.v[j] / Math.max(vma[j], 1e-12)); } } }
        run2 = d === 1 ? Math.max(run2, B.h[j]) : Math.min(run2, B.l[j]);
      }
      const f = { sw32, eqT: oppCluster(i, -d, R, 0.1 * a1, 0, 3), eqT165: oppCluster(i, -d, R, 0.1 * a1, 0, 1.65), tgtW, nearT, ext20: d * (B.c[i] - e20[i]) / A15[i], ext50: d * (B.c[i] - e50[i]) / a1,
        adx1: x.adx1, adx4: x.adx4, vrel: volRel(x.a), rv: B.v[i] / Math.max(vma[i], 1e-12) };
      const pts = { barrido: f.sw32 >= 2.5, cluster: f.eqT >= 0.5, cluster165: f.eqT165 >= 1, liqObjetivo: f.tgtW >= 2, liqCerca: f.nearT < 0.25, ext20: f.ext20 < 2.5, ext50: f.ext50 < 1,
        adx1: f.adx1 < 30, adx4: f.adx4 < 20, vol: f.vrel < 0.9, volBar: f.rv < 3 };
      const score = Object.values(pts).filter(Boolean).length, G = P.grade;
      return { score, grade: score >= G.a ? 'A' : score >= G.b ? 'B' : 'C', gradePts: pts, gradeF: f };
    }
    // v19.2 sweep rebound (see the swp option): returns the event when every condition holds at the close of bar i
    function swpAt(i, d, x) {
      const W = P.swp, K = SB(16); if (i < SB(400)) return null;
      let ext = d === 1 ? Infinity : -Infinity, extI = -1; for (let k = i - K; k < i; k++) { const v = d === 1 ? B.l[k] : B.h[k]; if (d === 1 ? v < ext : v > ext) { ext = v; extI = k; } }
      if (d === 1 ? B.l[i] < ext : B.h[i] > ext) return null;
      if (!(d * (B.c[i] - e20[i]) > 0 && d * (B.c[i - 1] - e20[i - 1]) <= 0)) return null;
      if (swpSeen[d + 1] === extI) return null;
      if (!(x.adx1 < W.adxMax) || !(volRel(x.a) < W.vr) || !(d * (B.c[i] - I4.e200[x.b]) > 0)) return null;
      let prev = d === 1 ? Infinity : -Infinity, far = d === 1 ? -Infinity : Infinity;
      for (let k = extI - SB(192); k < extI; k++) { prev = d === 1 ? Math.min(prev, B.l[k]) : Math.max(prev, B.h[k]); far = d === 1 ? Math.max(far, B.h[k]) : Math.min(far, B.l[k]); }
      if (!(d === 1 ? ext < prev : ext > prev)) return null;
      const a1 = x.h1atr, drop = d * (far - ext) / a1; if (!(drop < (W.dropMax || 12))) return null;
      const eq = oppCluster(i, -d, P.stopAtr * a1, 0.1 * a1, 0, 3); if (!(eq >= W.eq)) return null;
      return { ext, extI, drop, eq };
    }
    function signalAt(i) {
      const x = ctxAt(i); if (!x) return null;
      const VR = P.volRegime, vrel = VR ? volRel(x.a) : NaN, calm = !!(VR && vrel <= VR.calm);
      if (VR && vrel >= VR.spike) return null;
      const tTol = calm ? VR.calmTouchTol : P.touchTol, sVol = calm ? VR.calmShortVolMin : (P.shortVolMin || 0);
      const dow = new Date((B.t[i] + F) * 1000).getUTCDay();
      if (P.weekdaysOnly && (dow === 0 || dow === 6)) return null;
      if (P.skipHourUTC != null && new Date((B.t[i] + F) * 1000).getUTCHours() === P.skipHourUTC) return null;
      const rv = B.v[i] / Math.max(vma[i], 1e-12);
      if (rv <= P.rvolMin) return null;
      if (P.ichiCloudMax != null && !(cloud15[i] < P.ichiCloudMax)) return null;
      const M = P.momo, emaL = !P.emaAlign || e21[i] > e50[i] || !!(M && roc1h(x.a, 1) >= M.emaRoc), emaS = !P.emaAlign || e21[i] < e50[i] || !!(M && roc1h(x.a, -1) >= M.emaRoc);
      const adx4L = !(P.longAdx4Max > 0) || x.adx4 < P.longAdx4Max || !!(M && rsi1up(x.a) >= M.adx4Rsi);
      let hi = -Infinity, lo = Infinity;
      for (let j = i - P.rangeBars; j < i; j++) { if (B.h[j] > hi) hi = B.h[j]; if (B.l[j] < lo) lo = B.l[j]; }
      const width = (hi - lo) / A15[i];
      if (width >= P.rangeAtrMax || !(width >= P.rangeAtrMin)) return null;
      if (!(x.adx1 < P.adxMax)) return null;
      const pdx = (pdh[i] - B.c[i]) / x.h1atr;
      const swOk = side => (!P.sweep || sweepOpp(i, side, P.sweep.lb) > 0) && (P.bw1Max == null || !(bw1Rank(x.a) > P.bw1Max));
      const rndOk = side => !P.roundWall || !((side === 1 ? (Math.floor(B.c[i] / P.roundWall.step) + 1) * P.roundWall.step - B.c[i] : B.c[i] - (Math.ceil(B.c[i] / P.roundWall.step) - 1) * P.roundWall.step) / (P.stopAtr * x.h1atr) < P.roundWall.minR);
      const poolOk = side => swOk(side) && rndOk(side) && (!P.poolZone || (() => { const dd = nearestPool(i, side, P.stopAtr * x.h1atr); return !(dd >= P.poolZone[0] && dd < P.poolZone[1]); })())
        && (!P.oppPool || !(oppCluster(i, side, P.stopAtr * x.h1atr, 0.1 * x.h1atr, P.oppPool.lo, P.oppPool.hi) >= P.oppPool.w))
        && (!P.oppPool || P.oppPool.w2 == null || !(oppCluster(i, side, P.stopAtr * x.h1atr, 0.1 * x.h1atr, P.oppPool.lo2, P.oppPool.hi2) >= P.oppPool.w2));
      if (B.c[i] > hi && (!P.longNeeds4H || x.up4) && adx4L && (P.longRsi4Max == null || x.rsi4 < P.longRsi4Max) && !(P.longPdhZone && pdx >= P.longPdhZone[0] && pdx < P.longPdhZone[1]) && emaL && (!P.freshLevel || touches(i, hi, 1, tTol) < 2)) { const tr = x.d1; if (tr > P.trendMin && tr < P.trendMax && poolOk(1)) return { side: 1, level: hi, rvol: rv, trend: tr, h1atr: x.h1atr }; }
      if (B.c[i] < lo && emaS && (!P.freshLevel || touches(i, lo, -1, tTol) < 2) && !(rv <= sVol) && (!P.shortMacd1H || x.h1hist < 0)) { const tr = -x.d1; if (tr > P.trendMin && tr < P.trendMax && poolOk(-1)) return { side: -1, level: lo, rvol: rv, trend: tr, h1atr: x.h1atr }; }
      // v7: extended sell-off — beyond the trend band, far below the previous day's low (no 1H MACD condition)
      if (P.shortExtPdl != null && B.c[i] < lo && emaS && (!P.freshLevel || touches(i, lo, -1, tTol) < 2) && !(rv <= sVol) && -x.d1 >= P.trendMax && (B.c[i] - pdl[i]) / x.h1atr < P.shortExtPdl && poolOk(-1)) return { side: -1, level: lo, rvol: rv, trend: -x.d1, h1atr: x.h1atr, ext: true };
      // v12: short that only fails the 1H MACD condition, rescued by a solid buy-side sweep before it
      if (P.sweep && P.sweep.macdHi && P.shortMacd1H && B.c[i] < lo && !(x.h1hist < 0) && emaS && (!P.freshLevel || touches(i, lo, -1, tTol) < 2) && !(rv <= sVol)) {
        const tr = -x.d1, w = sweepOpp(i, -1, P.sweep.lb);
        if (tr > P.trendMin && tr < P.trendMax && w > P.sweep.macdLo && w <= P.sweep.macdHi && poolOk(-1)) return { side: -1, level: lo, rvol: rv, trend: tr, h1atr: x.h1atr, rescue: 'sweep' };
      }
      return null;
    }
    // bars of the range whose extreme sits within touchTol ATR(15m) of the level (1 = only the bar that made it)
    function touches(i, level, side, tt) {
      let k = 0; const tol = (tt == null ? P.touchTol : tt) * A15[i];
      for (let j = i - P.rangeBars; j < i; j++) { const ext = side === 1 ? B.h[j] : B.l[j]; if (Math.abs(ext - level) <= tol) k++; }
      return k;
    }

    // live status at the last closed bar: what would trigger a signal on the next close
    const L = n - 1, x = ctxAt(L);
    let hi = -Infinity, lo = Infinity;
    for (let j = L + 1 - P.rangeBars; j <= L; j++) { if (B.h[j] > hi) hi = B.h[j]; if (B.l[j] < lo) lo = B.l[j]; }
    const status = x ? {
      t: B.t[L] + F, price: B.c[L], rangeHi: hi, rangeLo: lo, rangeAtr: (hi - lo) / A15[L], rvol: B.v[L] / vma[L], rvolMin: P.rvolMin,
      d1: x.d1, h1atr: x.h1atr, stopDist: P.stopAtr * x.h1atr,
      trendLong: x.d1 > P.trendMin && x.d1 < P.trendMax, trendShort: -x.d1 > P.trendMin && -x.d1 < P.trendMax,
      adx1: x.adx1, adxOk: x.adx1 < P.adxMax, up4: x.up4, widthOk: (hi - lo) / A15[L] >= P.rangeAtrMin && (hi - lo) / A15[L] < P.rangeAtrMax,
      longOk: x.d1 > P.trendMin && x.d1 < P.trendMax && x.adx1 < P.adxMax && (!P.longNeeds4H || x.up4),
      shortOk: -x.d1 > P.trendMin && -x.d1 < P.trendMax && x.adx1 < P.adxMax,
      emaUp: e21[L] > e50[L], emaDn: e21[L] < e50[L], h1hist: x.h1hist, shortVolMin: P.volRegime && volRel(x.a) <= P.volRegime.calm ? P.volRegime.calmShortVolMin : P.shortVolMin, shortMacd1H: P.shortMacd1H, adx4: x.adx4, longAdx4Max: P.longAdx4Max, pdh: pdh[L], pdx: (pdh[L] - B.c[L]) / x.h1atr, longPdhZone: P.longPdhZone, pdl: pdl[L], pdlx: (B.c[L] - pdl[L]) / x.h1atr, shortExtPdl: P.shortExtPdl, rsi4: x.rsi4, longRsi4Max: P.longRsi4Max, poolZone: P.poolZone, poolUp: P.poolZone ? nearestPool(L, 1, P.stopAtr * x.h1atr) : null, poolDn: P.poolZone ? nearestPool(L, -1, P.stopAtr * x.h1atr) : null, oppPool: P.oppPool, oppUp: P.oppPool ? oppCluster(L, 1, P.stopAtr * x.h1atr, 0.1 * x.h1atr, P.oppPool.lo, P.oppPool.hi) : null, oppDn: P.oppPool ? oppCluster(L, -1, P.stopAtr * x.h1atr, 0.1 * x.h1atr, P.oppPool.lo, P.oppPool.hi) : null, oppUp2: P.oppPool && P.oppPool.w2 != null ? oppCluster(L, 1, P.stopAtr * x.h1atr, 0.1 * x.h1atr, P.oppPool.lo2, P.oppPool.hi2) : null, oppDn2: P.oppPool && P.oppPool.w2 != null ? oppCluster(L, -1, P.stopAtr * x.h1atr, 0.1 * x.h1atr, P.oppPool.lo2, P.oppPool.hi2) : null, sweep: P.sweep, swUp: sweepOpp(L, 1, P.sweep ? P.sweep.lb : 96), swDn: sweepOpp(L, -1, P.sweep ? P.sweep.lb : 96), swMrUp: P.mr && P.mr.swLb ? sweepOpp(L, 1, P.mr.swLb) : null, swMrDn: P.mr && P.mr.swLb ? sweepOpp(L, -1, P.mr.swLb) : null, volRegime: P.volRegime, volRel: P.volRegime ? volRel(x.a) : null, quality: P.quality, qUp: P.quality && L >= 700 ? qualScore(L, 1, x.h1atr) : null, qDn: P.quality && L >= 700 ? qualScore(L, -1, x.h1atr) : null, ichiCloudMax: P.ichiCloudMax, cloud15: P.ichiCloudMax != null ? cloud15[L] : null, momo: P.momo, roc1hUp: roc1h(x.a, 1), rsi1Up: rsi1up(x.a), bw1Max: P.bw1Max, bw1Rank: bw1Rank(x.a), mrBB: P.mrBB, mrArmB: mrB.arm, mrDevB: P.mrBB ? (B.c[L] - sm20[L]) / sd20[L] : null, pB1Up: pB1(x.a, 1), pB1Dn: pB1(x.a, -1), mr: P.mr, mrArm: mrA.arm, mrDev: (B.c[L] - e20[L]) / A15[L],  skipHourUTC: P.skipHourUTC, nextHourUTC: new Date((B.t[L] + 2 * F) * 1000).getUTCHours(),
      touchHi: (() => { let k = 0; for (let j = L + 1 - P.rangeBars; j <= L; j++) if (Math.abs(B.h[j] - hi) <= (P.volRegime && volRel(x.a) <= P.volRegime.calm ? P.volRegime.calmTouchTol : P.touchTol) * A15[L]) k++; return k; })(),
      touchLo: (() => { let k = 0; for (let j = L + 1 - P.rangeBars; j <= L; j++) if (Math.abs(B.l[j] - lo) <= (P.volRegime && volRel(x.a) <= P.volRegime.calm ? P.volRegime.calmTouchTol : P.touchTol) * A15[L]) k++; return k; })(),
      weekday: ![0, 6].includes(new Date((B.t[L] + 2 * F) * 1000).getUTCDay()),
      ctx: {
        h4: { close: H4.c[x.b], e21: I4.e21[x.b], e50: I4.e50[x.b], e200: I4.e200[x.b], rsi: I4.rsi[x.b], hist: I4.hist[x.b], histPrev: I4.hist[x.b - 1] },
        h1: { close: H1.c[x.a], e21: I1.e21[x.a], e50: I1.e50[x.a], e200: I1.e200[x.a], rsi: I1.rsi[x.a], hist: I1.hist[x.a], histPrev: I1.hist[x.a - 1] },
        m15: { close: B.c[L], e21: e21[L], e50: e50[L], rsi: r15[L], hist: mh15[L], histPrev: mh15[L - 1] },
      },
    } : null;
    if (status && P.grade) { status.gradeL = gradeAt(L, 1); status.gradeS = gradeAt(L, -1); status.gradeCfg = P.grade; }
    // v19.2 (information only: never creates, blocks or changes a trade). Sweep-rebound readout for the panel:
    // a new 48h extreme made inside the last 4 h after a sharp move, and its first reclaim (close beyond the extreme bar's
    // opposite end, or back over the 15m EMA 20). Same definition as the 2021–2026 study shown in the panel.
    let sweep = null;
    if (P.sweepInfo) {
      const ev = [], seen = {}, K = 16, from = Math.max(400, n - SB(P.sweepInfo.bars || 384));
      const ext48 = (extI, d) => { let prev = d === 1 ? Infinity : -Infinity, far = d === 1 ? -Infinity : Infinity, farI = -1;
        for (let k = Math.max(0, extI - SB(192)); k < extI; k++) { prev = d === 1 ? Math.min(prev, B.l[k]) : Math.max(prev, B.h[k]); const f = d === 1 ? B.h[k] : B.l[k]; if (d === 1 ? f > far : f < far) { far = f; farI = k; } }
        return { ok: d === 1 ? B.l[extI] < prev : B.h[extI] > prev, far, farI }; };
      for (let i = from; i < n; i++) for (const d of [1, -1]) {
        const cx = ctxAt(i); if (!cx) continue;
        let ext = d === 1 ? Infinity : -Infinity, extI = -1; for (let k = i - K; k < i; k++) { const v = d === 1 ? B.l[k] : B.h[k]; if (d === 1 ? v < ext : v > ext) { ext = v; extI = k; } }
        if (d === 1 ? B.l[i] < ext : B.h[i] > ext) continue;
        const ref = d === 1 ? B.h[extI] : B.l[extI];
        const trigBar = d * (B.c[i] - ref) > 0 && d * (B.c[i - 1] - ref) <= 0, trigEma = d * (B.c[i] - e20[i]) > 0 && d * (B.c[i - 1] - e20[i - 1]) <= 0;
        if (!trigBar && !trigEma) continue;
        if (seen[d] === extI) continue;
        const e4 = ext48(extI, d); if (!e4.ok) continue;
        seen[d] = extI;
        const a1 = cx.h1atr, Rk = P.stopAtr * a1;
        ev.push({ i, t: B.t[i] + F, side: d, ext, extT: B.t[extI] + F, far: e4.far, farT: B.t[e4.farI] + F, drop: d * (e4.far - ext) / a1, h1atr: a1, adx1: cx.adx1, volRel: volRel(cx.a),
          eqUp: oppCluster(i, -d, Rk, 0.1 * a1, 0, 3), how: trigEma ? 'ema' : 'bar', ema: trigEma, d4: d * (B.c[i] - I4.e200[cx.b]) / a1 });
      }
      // untaken swing levels (7 days) above and below the last close, weighted by the volume of the bar that made them
      const lv = { up: [], dn: [] }; let rh = -Infinity, rl = Infinity;
      for (let j = n - 1; j >= Math.max(PK, n - SB(672)); j--) {
        if (j <= n - 1 - PK) {
          const w = Math.min(3, B.v[j] / Math.max(vma[j], 1e-12));
          if (pivH[j] && B.h[j] > rh && B.h[j] > B.c[n - 1]) lv.up.push([B.h[j], w, B.t[j] + F]);
          if (pivL[j] && B.l[j] < rl && B.l[j] < B.c[n - 1]) lv.dn.push([B.l[j], w, B.t[j] + F]);
        }
        rh = Math.max(rh, B.h[j]); rl = Math.min(rl, B.l[j]);
      }
      const now = ctxAt(n - 1);
      sweep = { events: ev, levels: lv, eqUpNow: now ? oppCluster(n - 1, -1, P.stopAtr * now.h1atr, 0.1 * now.h1atr, 0, 3) : null, eqDnNow: now ? oppCluster(n - 1, 1, P.stopAtr * now.h1atr, 0.1 * now.h1atr, 0, 3) : null };
    }
    return { trades, open, status, params: P, H1, H4, sweep };
  }

  function stats(trades) {
    const done = trades.filter(t => t.r != null);
    const n = done.length; if (!n) return { n: 0 };
    let w = 0, sum = 0, gp = 0, gl = 0, eq = 0, peak = 0, dd = 0, tgt = 0, be = 0, st = 0;
    for (const t of done) { sum += t.r; if (t.reason === 'be') be++; if (t.reason === 'stop') st++; if (t.r > 1e-9) { w++; gp += t.r; } else gl -= t.r; if (t.reason === 'target') tgt++; eq += t.r; peak = Math.max(peak, eq); dd = Math.max(dd, peak - eq); }
    return { n, wr: w / n, tgtRate: tgt / n, beRate: be / n, stopRate: st / n, exp: sum / n, total: sum, pf: gl ? gp / gl : Infinity, maxDD: dd,
             avgWin: w ? gp / w : 0, avgLoss: n - w ? gl / (n - w) : 0, avgBars: done.reduce((a, t) => a + t.bars, 0) / n };
  }

  root.BTCStrategyMulti = { run, stats, aggregate, DEF };
})(typeof globalThis !== 'undefined' ? globalThis : this);
module.exports = globalThis.BTCStrategyMulti;

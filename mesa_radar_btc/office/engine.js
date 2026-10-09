// Mesa Radar · motor de la oficina (BTC). Idéntico al backtest de research/ (engine.py + strategies.py, modo horario de oficina).
// Vega: tendencia diaria (cierre > SMA20 y momentum 20 d > 0), stop móvil 3,5 ATR diario, sale al perder la tendencia. REAL.
// Ortega: ruptura del máximo (largo) o mínimo (corto) de 5 días en cierre de 4 h, a favor de la SMA50 diaria; stop móvil 2 ATR (ATR horario de 1 semana × √24). REAL.
// v3 (más win rate y más R por operación): Ortega toma un 33% a +1,5R y pone el stop en +0,3R al llegar a +0,75R; Paz y Ríos solo entran si Vega u Ortega
// ya están dentro en el mismo sentido, y suben el stop a +0,3R al llegar a +1,5R (Paz) o +1R (Ríos).
// Paz: retroceso intradía a favor de la SMA50 diaria (RSI14 1H < 45 en las 6 h previas y cierre que recupera la EMA50 1H; espejo en corto), stop bajo el mínimo de 6 h (máx. 2 ATR), móvil 5 ATR, máximo 96 h. REAL (medio riesgo).
// Ríos: compresión de volatilidad (Bollinger 1H en el 20% más estrecho de 30 días) y ruptura con volumen, a favor de SMA50 diaria, en ambos sentidos. REAL (medio riesgo).
(function (root) {
  'use strict';
  const FEE = 0.0014, STOPSLIP = 0.0003;
  const ema = (x, n) => { const a = 2 / (n + 1), o = new Float64Array(x.length); let s = x[0]; for (let i = 0; i < x.length; i++) { s = i ? a * x[i] + (1 - a) * s : x[i]; o[i] = s; } return o; };
  const sma = (x, n) => { const o = new Float64Array(x.length).fill(NaN); let s = 0; for (let i = 0; i < x.length; i++) { s += x[i]; if (i >= n) s -= x[i - n]; if (i >= n - 1) o[i] = s / n; } return o; };
  const atr = (B, n) => { const tr = new Float64Array(B.c.length); for (let i = 0; i < tr.length; i++) { const pc = i ? B.c[i - 1] : B.c[0]; tr[i] = Math.max(B.h[i] - B.l[i], Math.abs(B.h[i] - pc), Math.abs(B.l[i] - pc)); } return ema(tr, n); };
  const rollmax = (x, n) => { const o = new Float64Array(x.length).fill(NaN), dq = []; for (let i = 0; i < x.length; i++) { while (dq.length && x[dq[dq.length - 1]] <= x[i]) dq.pop(); dq.push(i); if (dq[0] <= i - n) dq.shift(); if (i >= n - 1) o[i] = x[dq[0]]; } return o; };
  const rollmin = (x, n) => Float64Array.from(rollmax(Float64Array.from(x, v => -v), n), v => -v);
  const searchR = (a, v) => { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] <= v) lo = m + 1; else hi = m; } return lo; };
  const searchL = (a, v) => { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < v) lo = m + 1; else hi = m; } return lo; };
  const madridHour = (() => { const f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', hourCycle: 'h23' }); return t => +f.format(new Date(t * 1000)); })();

  function prepare(H) {
    const N = H.t.length;
    const D = { t: [], o: [], h: [], l: [], c: [] };
    for (let i = 0; i < N; i++) { const d = Math.floor(H.t[i] / 86400) * 86400, k = D.t.length - 1; if (k < 0 || D.t[k] !== d) { D.t.push(d); D.o.push(H.o[i]); D.h.push(H.h[i]); D.l.push(H.l[i]); D.c.push(H.c[i]); } else { D.h[k] = Math.max(D.h[k], H.h[i]); D.l[k] = Math.min(D.l[k], H.l[i]); D.c[k] = H.c[i]; } }
    const hd = new Int32Array(N); for (let i = 0; i < N; i++) hd[i] = searchR(D.t, H.t[i]) - 2;
    const toH = x => { const o = new Float64Array(N).fill(NaN); for (let i = 0; i < N; i++) if (hd[i] >= 0) o[i] = x[hd[i]]; return o; };
    const mask = new Uint8Array(N); for (let i = 0; i < N; i++) { const hh = madridHour(H.t[i]); mask[i] = hh >= 7 && hh < 20 ? 1 : 0; }
    const A1 = atr(H, 24);
    return { H, D, N, hd, toH, mask, A1, dc: Float64Array.from(D.c) };
  }
  function regime(X, n) { const S = X.toH(sma(X.dc, n)), C = X.toH(X.dc); return Int8Array.from(C, (v, i) => v > S[i] ? 1 : v < S[i] ? -1 : 0); }

  // sim con horario de oficina. Devuelve operaciones cerradas, la abierta (si hay) y la entrada pendiente (si la señal es de la última vela cerrada).
  // G (gestión, v3): tp = parcial de f a +tp R (orden límite 24 h); be = tras tocar +be R, el stop pasa a entrada ± beoff R (solo se mueve en horario).
  // filt(sigT, side): filtro de confluencia de la señal.
  function sim(X, sigs, trail, exitMask, nowMask, G = {}, filt = null) {
    const { H, N, mask } = X, h = H.h, l = H.l, o = H.o, c = H.c, t = H.t;
    const out = []; let busy = -1, open = null, pending = null;
    sigs.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    for (const [i, side, stop, tgt, maxh] of sigs) {
      if (filt && !filt(t[i] + 3600, side)) continue;
      if (i <= busy) continue;
      let j0 = i + 1; while (j0 < N && !mask[j0]) j0++;
      if (j0 - i > 14) continue;
      const dist = Math.abs(c[i] - stop);
      if (j0 >= N) { if (nowMask && (N - i) <= 14) pending = { sigT: t[i] + 3600, side, dist, ref: c[i] }; continue; }
      const e = o[j0]; let sl = e - side * dist; const tg = isNaN(tgt) ? NaN : e + side * Math.abs(tgt - c[i]);
      let j = j0, end = Math.min(N - 1, i + maxh), px = null, why = null, best = e, last = null, part = 0, booked = 0, beOn = false, armBE = false;
      while (j <= end) {
        if (side === 1 ? l[j] <= sl : h[j] >= sl) { px = sl; why = 'stop'; break; }
        if (G.tp && part === 0 && (side === 1 ? h[j] >= e + G.tp * dist : l[j] <= e - G.tp * dist)) { part = G.f; booked = G.f * G.tp; }
        if (!isNaN(tg) && (side === 1 ? h[j] >= tg : l[j] <= tg)) { px = tg; why = 'target'; break; }
        if (exitMask && exitMask[side][j] && j < end) { let k2 = j + 1; while (k2 < N && !mask[k2]) k2++; if (k2 < N) { px = o[k2]; why = 'senal'; j = k2; break; } else { last = { exitDue: true }; } }
        best = side === 1 ? Math.max(best, h[j]) : Math.min(best, l[j]);
        if (G.be && !beOn && (best - e) * side >= G.be * dist) armBE = true;
        if (mask[j]) {
          if (armBE && !beOn) { beOn = true; sl = side === 1 ? Math.max(sl, e + G.beoff * dist) : Math.min(sl, e - G.beoff * dist); }
          if (trail) { const [k, A] = trail; sl = side === 1 ? Math.max(sl, best - k * A[j]) : Math.min(sl, best + k * A[j]); }
        }
        j++;
      }
      if (px == null && j > end && end === i + maxh) { j = end; px = c[j]; why = 'tiempo'; }
      if (px == null) { open = { sigT: t[i] + 3600, entryT: t[j0], side, entry: e, risk: dist, stop: sl, stop0: e - side * dist, best, part, beOn, tp: G.tp ? e + side * G.tp * dist : null, tpFrac: G.f || 0, rNow: booked + (1 - part) * (c[N - 1] - e) * side / dist - FEE * e / dist, exitDue: !!(last && last.exitDue) }; busy = N; break; }
      const cost = (FEE + (why === 'stop' ? STOPSLIP * (1 - part) : 0)) * e;
      out.push({ sigT: t[i] + 3600, entryT: t[j0], side, entry: e, stop0: e - side * dist, risk: dist, exit: px, exitBar: t[j], exitT: t[j] + (why === 'stop' || why === 'target' ? 3600 : 0), why, part, r: booked + (1 - part) * (px - e) * side / dist - cost / dist });
      busy = j;
    }
    return { trades: out, open, pending };
  }
  // confluencia: la señal solo vale si Vega u Ortega están dentro en el mismo sentido
  function confluence(...Rs) {
    const iv = []; for (const R of Rs) { for (const x of R.trades) iv.push([x.sigT, x.exitBar, x.side]); if (R.open) iv.push([R.open.sigT, Infinity, R.open.side]); }
    return (ts, side) => iv.some(([a, b, s]) => a <= ts && ts < b && s === side);
  }
  const GEST = { ortega: { tp: 1.5, f: 0.33, be: 0.75, beoff: 0.3 }, paz: { be: 1.5, beoff: 0.3 }, rios: { be: 1, beoff: 0.3 } };

  function vega(X, nowMask, P = { n: 20, k: 3.5 }) {
    const { D, N, H, hd, toH, dc } = X, n = P.n, k = P.k;
    const Ad = atr({ h: D.h, l: D.l, c: D.c }, 14), S = sma(dc, n), st = new Int8Array(dc.length);
    for (let d = 0; d < dc.length; d++) { const m = d >= n ? dc[d] / dc[d - n] - 1 : NaN; st[d] = dc[d] > S[d] && m > 0 ? 1 : 0; }
    const stH = toH(Float64Array.from(st)), exitL = new Uint8Array(N);
    for (let i = 0; i < N; i++) { const nd = i === 0 || hd[i] !== hd[i - 1]; if (nd && stH[i] !== 1) exitL[i] = 1; }
    const sigs = [];
    for (let d = 1; d < dc.length; d++) {
      if (st[d] !== 0 && st[d] !== st[d - 1] && !isNaN(S[d])) {
        const hi = searchL(H.t, D.t[d] + 86400 - 3600);
        if (hi >= N) continue;
        if (D.t[d] + 86400 > H.t[N - 1] + 3600) continue;   // el día aún no ha cerrado
        const e = hi + 1 < N ? H.o[hi + 1] : H.c[hi];
        sigs.push([hi, 1, e - k * Ad[d], NaN, 24 * 400]);
      }
    }
    const R = sim(X, sigs, [k, toH(Ad)], { 1: exitL, '-1': new Uint8Array(N) }, nowMask);
    R.ctx = { sma: S[dc.length - 1], close: dc[dc.length - 1], mom: dc[dc.length - 1] / dc[dc.length - 1 - n] - 1, atr: Ad[dc.length - 1], on: st[dc.length - 1] === 1, dayOpen: D.t[D.t.length - 1] };
    return R;
  }
  function ortega(X, nowMask, P = { N: 5, k: 2 }) {
    const { H, N } = X, W = P.N * 24, hi = rollmax(H.h, W), lo = rollmin(H.l, W), A4 = atr(H, 168), A4s = Float64Array.from(A4, v => v * Math.sqrt(24)), R50 = regime(X, 50);
    const sigs = [];
    for (let i = 1; i < N; i++) {
      const hr = Math.floor(H.t[i] / 3600) % 24; if (hr % 4 !== 3) continue;
      if (H.c[i] > hi[i - 1] && R50[i] === 1) sigs.push([i, 1, H.c[i] - P.k * A4s[i], NaN, 24 * 120]);
      if (H.c[i] < lo[i - 1] && R50[i] === -1) sigs.push([i, -1, H.c[i] + P.k * A4s[i], NaN, 24 * 120]);
    }
    const R = sim(X, sigs, [P.k, A4s], null, nowMask, GEST.ortega);
    R.ctx = { level: hi[N - 1], low: lo[N - 1], regime: R50[N - 1], close: H.c[N - 1], atr: A4s[N - 1], nextDecision: (() => { let t = H.t[N - 1] + 3600; while ((Math.floor(t / 3600) % 24) % 4 !== 0) t += 3600; return t; })() };
    return R;
  }
  function paz(X, nowMask, filt = null, P = { rsiLo: 45, en: 50, k: 2, tk: 5, maxh: 96, lb: 6 }) {
    const { H, N, A1, mask } = X, c = H.c, h = H.h, l = H.l, E = ema(c, P.en), lb = P.lb;
    const up = new Float64Array(N), dn = new Float64Array(N);
    for (let i = 0; i < N; i++) { const d = i ? c[i] - c[i - 1] : 0; up[i] = Math.max(d, 0); dn[i] = Math.max(-d, 0); }
    const U = ema(up, 14), Dn = ema(dn, 14), rsi = Float64Array.from(U, (u, i) => 100 - 100 / (1 + u / Math.max(Dn[i], 1e-9)));
    const R50 = regime(X, 50), sigs = [];
    for (let i = lb; i < N; i++) {
      if (!mask[i]) continue;
      let mn = Infinity, mx = -Infinity; for (let j = i - lb; j < i; j++) { mn = Math.min(mn, rsi[j]); mx = Math.max(mx, rsi[j]); }
      const pc = c[i - 1], pE = E[i - 1];
      if (c[i] > E[i] && pc <= pE && mn < P.rsiLo && R50[i] === 1) {
        let sw = Infinity; for (let j = Math.max(0, i - lb); j <= i; j++) sw = Math.min(sw, l[j]);
        let stop = Math.min(sw, c[i] - 0.5 * A1[i]) - 0.2 * A1[i]; if (c[i] - stop > P.k * A1[i]) stop = c[i] - P.k * A1[i];
        sigs.push([i, 1, stop, NaN, P.maxh]);
      }
      if (c[i] < E[i] && pc >= pE && mx > 100 - P.rsiLo && R50[i] === -1) {
        let sw = -Infinity; for (let j = Math.max(0, i - lb); j <= i; j++) sw = Math.max(sw, h[j]);
        let stop = Math.max(sw, c[i] + 0.5 * A1[i]) + 0.2 * A1[i]; if (stop - c[i] > P.k * A1[i]) stop = c[i] + P.k * A1[i];
        sigs.push([i, -1, stop, NaN, P.maxh]);
      }
    }
    const R = sim(X, sigs, [P.tk, A1], null, nowMask, GEST.paz, filt);
    const i = N - 1; let mn = Infinity, mx = -Infinity; for (let j = i - lb; j < i; j++) { mn = Math.min(mn, rsi[j]); mx = Math.max(mx, rsi[j]); }
    R.ctx = { rsi: rsi[i], rsiMin: mn, rsiMax: mx, ema: E[i], regime: R50[i], close: c[i] };
    return R;
  }
  function rios(X, nowMask, filt = null, P = { q: 0.2, vm: 1.0, k: 4 }) {
    const { H, N, A1 } = X, c = H.c, m = sma(c, 20), c2 = sma(Float64Array.from(c, v => v * v), 20), W = 720;
    const sd = Float64Array.from(m, (v, i) => Math.sqrt(Math.max(c2[i] - v * v, 0))), bw = Float64Array.from(m, (v, i) => 4 * sd[i] / v);
    const rank = new Float64Array(N).fill(NaN);
    for (let i = W - 1; i < N; i++) { const x = bw[i]; let cnt = 0; for (let j = i - W + 1; j <= i; j++) if (bw[j] < x) cnt++; rank[i] = cnt / W; }
    const vb = sma(H.v, 168), R50 = regime(X, 50), sigs = [];
    for (let i = 1; i < N; i++) {
      if (!(rank[i - 1] <= P.q && H.v[i] > P.vm * vb[i])) continue;
      if (c[i] > m[i] + 2 * sd[i] && R50[i] === 1) sigs.push([i, 1, c[i] - P.k * A1[i], NaN, 240]);
      if (c[i] < m[i] - 2 * sd[i] && R50[i] === -1) sigs.push([i, -1, c[i] + P.k * A1[i], NaN, 240]);
    }
    const R = sim(X, sigs, [P.k, A1], null, nowMask, GEST.rios, filt);
    R.ctx = { rank: rank[N - 1], upper: m[N - 1] + 2 * sd[N - 1], lower: m[N - 1] - 2 * sd[N - 1], vol: H.v[N - 1] / vb[N - 1], regime: R50[N - 1], close: c[N - 1] };
    return R;
  }
  root.MesaEngine = { prepare, vega, ortega, paz, rios, confluence, GEST, madridHour, regime, FEE };
})(typeof globalThis !== 'undefined' ? globalThis : this);
if (typeof module !== 'undefined') module.exports = globalThis.MesaEngine;

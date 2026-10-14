// Ala 2 · variables de cada decisión (cada 10 min). El mismo código sirve para el banco de entrenamiento (research) y para la ronda en vivo,
// así lo que aprende el modelo y lo que ve en directo es idéntico. Solo velas de 5 min CERRADAS antes del instante de decisión t.
//   Montes (liquidez): flujo comprador/vendedor estimado (BVC), volumen relativo, absorción, mechas de rechazo, iliquidez de Amihud, VWAP, funding.
//   Aranda (técnico): retornos, medias, RSI, posición en el rango, distancia a máximos y mínimos, SMA50 diaria.
//   Régimen (lo usan los dos y Lagos): volatilidad relativa, ancho de Bollinger, hora y día.
'use strict';
const NAMES = ['liq_absorb240', 'liq_absorb60', 'liq_amihud240', 'liq_amihud60', 'liq_bvc1d', 'liq_fund', 'liq_fund3d', 'liq_imb10', 'liq_imb240', 'liq_imb60', 'liq_lowick240', 'liq_lowick60', 'liq_upwick240', 'liq_upwick60', 'liq_volz10', 'liq_volz240', 'liq_volz60', 'liq_vwapdist',
  'reg_hour', 'reg_wd', 'tec_bwrank', 'tec_d50', 'tec_dist24hi', 'tec_dist24lo', 'tec_e20', 'tec_e200', 'tec_e50', 'tec_e50slope', 'tec_pos24h', 'tec_pos5d', 'tec_ret10m', 'tec_ret1d', 'tec_ret1h', 'tec_ret4h', 'tec_ret7d', 'tec_rsi1h', 'tec_rsi4h', 'tec_volreg'];
const FAM = NAMES.map(n => n.slice(0, 3));
const B5 = 300, DAY = 288, WEEK = 2016;

// Φ (normal estándar) con la aproximación de Abramowitz-Stegun 7.1.26 (error < 1,5e-7)
function Phi(z) {
  const x = Math.abs(z) / Math.SQRT2, t = 1 / (1 + 0.3275911 * x);
  const e = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return 0.5 * (1 + (z >= 0 ? e : -e));
}
const emaArr = (x, n) => { const a = 2 / (n + 1), o = new Float64Array(x.length); let s = x[0]; for (let i = 0; i < x.length; i++) { s = i ? a * x[i] + (1 - a) * s : x[i]; o[i] = s; } return o; };
function rsiArr(x, n = 14) {
  const up = new Float64Array(x.length), dn = new Float64Array(x.length);
  for (let i = 1; i < x.length; i++) { const d = x[i] - x[i - 1]; up[i] = Math.max(d, 0); dn[i] = Math.max(-d, 0); }
  const u = emaArr(up, n), d = emaArr(dn, n), o = new Float64Array(x.length);
  for (let i = 0; i < x.length; i++) o[i] = 100 - 100 / (1 + u[i] / Math.max(d[i], 1e-12));
  return o;
}
const madridParts = (() => {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', weekday: 'short', hourCycle: 'h23' }), cache = new Map(), WD = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  return t => { const k = Math.floor(t / 3600); let v = cache.get(k); if (!v) { const p = {}; for (const x of f.formatToParts(new Date(k * 3600000))) p[x.type] = x.value; v = [+p.hour, WD[p.weekday]]; cache.set(k, v); } return v; };
})();
const isOffice = t => { const [h, wd] = madridParts(t); return wd < 5 && h >= 7 && h < 21; };

// Prepara todo lo que no depende de t. S = { t0, o, h, l, c, v } velas de 5 min contiguas (t0 = inicio de la primera; huecos ya rellenos).
// FUND = [[t_liquidación, tasa], ...] ordenado (tasa en tanto por uno por 8 h).
function prepare(S, FUND) {
  const n = S.c.length, { o, h, l, c, v } = S, t0 = S.t0;
  const r = new Float64Array(n); for (let i = 1; i < n; i++) r[i] = Math.log(c[i] / c[i - 1]);
  const cs = a => { const o_ = new Float64Array(a.length + 1); for (let i = 0; i < a.length; i++) o_[i + 1] = o_[i] + a[i]; return o_; };
  const r2 = cs(r.map(x => x * x));
  const bv = new Float64Array(n), am = new Float64Array(n), has = new Float64Array(n), cpv = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const lo = Math.max(0, i - DAY + 1), sig = Math.sqrt((r2[i + 1] - r2[lo]) / (i + 1 - lo)) + 1e-9;
    bv[i] = v[i] * (2 * Phi(r[i] / sig) - 1);
    if (v[i] > 0) { am[i] = Math.abs(r[i]) / Math.max(v[i], 1e-6); has[i] = 1; }
    cpv[i] = c[i] * v[i];
  }
  const P = { S, n, t0, r, cv: cs(v), cbv: cs(bv), cam: cs(am), cn: cs(has), ccpv: cs(cpv), FUND: FUND || [] };
  // velas de 1 h (UTC) formadas con las de 5 min; solo las completas
  const h0 = Math.ceil(t0 / 3600) * 3600, i0 = (h0 - t0) / B5, nh = Math.floor((n - i0) / 12);
  const Hh = new Float64Array(nh), Hl = new Float64Array(nh), Hc = new Float64Array(nh);
  for (let j = 0; j < nh; j++) { let hi = -Infinity, lo = Infinity; for (let k = 0; k < 12; k++) { const i = i0 + 12 * j + k; if (h[i] > hi) hi = h[i]; if (l[i] < lo) lo = l[i]; } Hh[j] = hi; Hl[j] = lo; Hc[j] = c[i0 + 12 * j + 11]; }
  const tr = new Float64Array(nh); for (let j = 0; j < nh; j++) { const pc = j ? Hc[j - 1] : Hc[0]; tr[j] = Math.max(Hh[j] - Hl[j], Math.abs(Hh[j] - pc), Math.abs(Hl[j] - pc)); }
  const ATR = emaArr(tr, 14), E20 = emaArr(Hc, 20), E50 = emaArr(Hc, 50), E200 = emaArr(Hc, 200), R1 = rsiArr(Hc);
  // RSI de 4 h: velas que cierran a las 4, 8, 12, 16, 20 y 0 UTC
  const q = [], qj = []; for (let j = 0; j < nh; j++) if (((h0 / 3600 + j + 1) % 4) === 0) { q.push(Hc[j]); qj.push(j); }
  const R4q = rsiArr(Float64Array.from(q)), R4 = new Float64Array(nh).fill(50); { let k = -1; for (let j = 0; j < nh; j++) { while (k + 1 < qj.length && qj[k + 1] <= j) k++; if (k >= 0) R4[j] = R4q[k]; } }
  // ancho de Bollinger (20 h)
  const BW = new Float64Array(nh); { let s = 0, s2 = 0; for (let j = 0; j < nh; j++) { s += Hc[j]; s2 += Hc[j] * Hc[j]; if (j >= 20) { s -= Hc[j - 20]; s2 -= Hc[j - 20] * Hc[j - 20]; } const m = Math.min(j + 1, 20), mu = s / m; BW[j] = 4 * Math.sqrt(Math.max(s2 / m - mu * mu, 0)) / mu; } }
  // cierres diarios (UTC) y SMA50 de días cerrados
  const dayClose = new Map(); for (let j = 0; j < nh; j++) dayClose.set(Math.floor((h0 + 3600 * j) / 86400), Hc[j]);
  const days = [...dayClose.keys()].sort((a, b) => a - b), dS50 = new Map(); { let s = 0; for (let k = 0; k < days.length; k++) { s += dayClose.get(days[k]); if (k >= 50) s -= dayClose.get(days[k - 50]); if (k >= 49) dS50.set(days[k], s / 50); } }
  Object.assign(P, { h0, nh, Hh, Hl, Hc, ATR, E20, E50, E200, R1, R4, BW, days, dS50, medCache: new Map(), rankCache: new Map() });
  return P;
}
const win = (cs, i, W) => cs[i + 1] - cs[Math.max(i + 1 - W, 0)];   // suma de las W velas que acaban en i (incluida)
function medATR(P, j) { let m = P.medCache.get(j); if (m === undefined) { const a = Array.from(P.ATR.subarray(Math.max(0, j - 719), j + 1)).sort((x, y) => x - y), k = a.length >> 1; m = a.length % 2 ? a[k] : (a[k - 1] + a[k]) / 2; P.medCache.set(j, m); } return m; }
function rankBW(P, j) { let m = P.rankCache.get(j); if (m === undefined) { if (j < 720) m = NaN; else { let c = 0; for (let k = j - 720; k < j; k++) if (P.BW[k] < P.BW[j]) c++; m = c / 720; } P.rankCache.set(j, m); } return m; }

// Variables en el instante t (múltiplo de 600 s). Devuelve null si faltan datos.
function features(P, t) {
  const { S, t0 } = P, b = (t - B5 - t0) / B5;   // última vela de 5 min cerrada: empieza en t-300
  if (!Number.isInteger(b) || b < WEEK + 2 || b >= P.n) return null;
  const j = Math.floor((t - 3600 - P.h0) / 3600);   // última hora cerrada
  if (j < 721 || j >= P.nh || P.h0 + 3600 * (j + 1) > t) return null;
  const { o, h, l, c } = S, px = c[b], at = P.ATR[j], F = {};
  const vol7 = win(P.cv, b, WEEK) / WEEK;
  for (const [nm, W] of [['10', 2], ['60', 12], ['240', 48]]) {
    const vw = win(P.cv, b, W); F['liq_imb' + nm] = win(P.cbv, b, W) / Math.max(vw, 1e-9);
    F['liq_volz' + nm] = Math.log((vw / W + 1e-9) / (vol7 + 1e-9));
  }
  for (const [nm, W] of [['60', 12], ['240', 48]]) {
    let hi = -Infinity, lo = Infinity; for (let i = b - W + 1; i <= b; i++) { if (h[i] > hi) hi = h[i]; if (l[i] < lo) lo = l[i]; }
    const oW = o[b - W + 1], rng = Math.max(hi - lo, 1e-9);
    F['liq_absorb' + nm] = F['liq_volz' + nm] - Math.log(rng / at + 1e-6);
    F['liq_upwick' + nm] = (hi - Math.max(oW, px)) / rng; F['liq_lowick' + nm] = (Math.min(oW, px) - lo) / rng;
    const a = win(P.cam, b, W) / Math.max(win(P.cn, b, W), 1), a7 = win(P.cam, b, WEEK) / Math.max(win(P.cn, b, WEEK), 1);
    F['liq_amihud' + nm] = Math.log((a + 1e-12) / (a7 + 1e-12));
  }
  const vwap = win(P.ccpv, b, DAY) / Math.max(win(P.cv, b, DAY), 1e-9);
  F.liq_vwapdist = (px - vwap) / at; F.liq_bvc1d = win(P.cbv, b, DAY) / Math.max(win(P.cv, b, DAY), 1e-9);
  // funding: última liquidación publicada (si es de hace < 9 h) y media de las 9 últimas, en puntos básicos
  const FU = P.FUND; let k = -1; { let lo_ = 0, hi_ = FU.length - 1; while (lo_ <= hi_) { const m = (lo_ + hi_) >> 1; if (FU[m][0] <= t) { k = m; lo_ = m + 1; } else hi_ = m - 1; } }
  F.liq_fund = k >= 0 && t - FU[k][0] < 9 * 3600 ? FU[k][1] * 1e4 : NaN;
  if (k >= 0) { let s = 0, m = 0; for (let i = Math.max(0, k - 8); i <= k; i++) { s += FU[i][1]; m++; } F.liq_fund3d = s / m * 1e4; } else F.liq_fund3d = NaN;
  for (const [nm, W] of [['10m', 2], ['1h', 12], ['4h', 48], ['1d', DAY], ['7d', WEEK]]) F['tec_ret' + nm] = (px - c[b - W]) / at;
  F.tec_e20 = (px - P.E20[j]) / at; F.tec_e50 = (px - P.E50[j]) / at; F.tec_e200 = (px - P.E200[j]) / at;
  F.tec_e50slope = (P.E50[j] - P.E50[Math.max(j - 24, 0)]) / at; F.tec_rsi1h = P.R1[j]; F.tec_rsi4h = P.R4[j];
  let hi24 = -Infinity, lo24 = Infinity; for (let i = b - DAY + 1; i <= b; i++) { if (h[i] > hi24) hi24 = h[i]; if (l[i] < lo24) lo24 = l[i]; }
  let hi5 = -Infinity, lo5 = Infinity; for (let i = Math.max(0, j - 119); i <= j; i++) { if (P.Hh[i] > hi5) hi5 = P.Hh[i]; if (P.Hl[i] < lo5) lo5 = P.Hl[i]; }
  F.tec_pos24h = (px - lo24) / Math.max(hi24 - lo24, 1e-9); F.tec_pos5d = (px - lo5) / Math.max(hi5 - lo5, 1e-9);
  F.tec_dist24hi = (hi24 - px) / at; F.tec_dist24lo = (px - lo24) / at;
  F.tec_volreg = at / medATR(P, j); F.tec_bwrank = rankBW(P, j);
  const today = Math.floor(t / 86400); let s50 = NaN; for (let d = today - 1; d >= today - 5; d--) if (P.dS50.has(d)) { s50 = P.dS50.get(d); break; }
  F.tec_d50 = (px - s50) / (at * Math.sqrt(24));
  const [hr, wd] = madridParts(t); F.reg_hour = hr; F.reg_wd = wd;
  return { x: NAMES.map(k => F[k]), F, px, atr: at, j, b };
}

// Velas de 5 min a partir de minutos [t,o,h,l,c,v] ordenados: huecos rellenos con el último cierre y volumen 0. Solo velas completas (<= nowS).
function minutesTo5(rows, nowS) {
  if (!rows.length) return null;
  const t0 = Math.floor(rows[0][0] / B5) * B5, tEnd = Math.floor(Math.min(nowS, rows[rows.length - 1][0] + 60) / B5) * B5, n = (tEnd - t0) / B5;
  const S = { t0, o: new Float64Array(n), h: new Float64Array(n), l: new Float64Array(n), c: new Float64Array(n), v: new Float64Array(n) }, seen = new Uint8Array(n);
  for (const [t, o, h, l, c, v] of rows) { const i = Math.floor((t - t0) / B5); if (i < 0 || i >= n) continue; if (!seen[i]) { S.o[i] = o; S.h[i] = h; S.l[i] = l; seen[i] = 1; } else { S.h[i] = Math.max(S.h[i], h); S.l[i] = Math.min(S.l[i], l); } S.c[i] = c; S.v[i] += v; }
  for (let i = 0; i < n; i++) if (!seen[i]) { const pc = i ? S.c[i - 1] : rows[0][1]; S.o[i] = S.h[i] = S.l[i] = S.c[i] = pc; }
  return S;
}
module.exports = { NAMES, FAM, prepare, features, minutesTo5, isOffice, madridParts, Phi, B5 };

// Banco de entrenamiento: node ala2_feat.js bank <min.bin float64 [t,o,h,l,c,v]> <funding.json [[t,tasa],..]> <salida.bin float64 [variables..., atr, precio]> <decisiones.bin (int64 t)>
if (require.main === module && process.argv[2] === 'bank') {
  const fs = require('fs'), [, , , binP, fundP, outP, tdP] = process.argv;
  const buf = fs.readFileSync(binP), A = new Float64Array(buf.buffer, buf.byteOffset, buf.length / 8), nr = A.length / 6, rows = new Array(nr);
  for (let i = 0; i < nr; i++) rows[i] = [A[6 * i], A[6 * i + 1], A[6 * i + 2], A[6 * i + 3], A[6 * i + 4], A[6 * i + 5]];
  const S = minutesTo5(rows, Infinity), P = prepare(S, JSON.parse(fs.readFileSync(fundP, 'utf8')));
  const tb = fs.readFileSync(tdP), TD = new BigInt64Array(tb.buffer, tb.byteOffset, tb.length / 8), NC = NAMES.length + 2, out = new Float64Array(TD.length * NC).fill(NaN);
  for (let i = 0; i < TD.length; i++) { const f = features(P, Number(TD[i])); if (f) out.set(f.x.concat([f.atr, f.px]), i * NC); if (i % 20000 === 0) process.stdout.write(i + ' '); }
  fs.writeFileSync(outP, Buffer.from(out.buffer)); console.log('\nok', TD.length, NC);
}

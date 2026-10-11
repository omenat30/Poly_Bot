// Mesa de Radar de la oficina (v11): el modelo del Radar BTC 15m (motor y parámetros V20 idénticos a los del panel, extraídos sin tocarlo)
// en la cabeza de los agentes. Velas de 15 min: 75 días de Bitstamp para calentar + Binance futuros en vivo (mismo empalme que el escáner del Radar).
// Uso como módulo: run(minPath, livePath, nowS) -> { R, B, problems, lastT }.  CLI: node radar_desk.js need <minutos.csv>  -> LOOKBACK=<h>h
const fs = require('fs'), path = require('path');
const S = require(path.join(__dirname, 'radar_engine.js'));
const V20 = { rr: 1.65, beAt: 0, fee: 0.0008, longPdhZone: [-0.5, 1], shortExtPdl: -4, longRsi4Max: 62, skipHourUTC: 21, trendMin: -1, poolZone: [0.7, 1.2], oppPool: { lo: 0.5, hi: 1, w: 2, lo2: 1, hi2: 1.5, w2: 3.5 }, sweep: { lb: 96, macdLo: 1.5, macdHi: 3 }, mr: { dev: 3, back: 1, win: 16, adxMax: 22, swLb: 32, swLo: 0.8, swHi: 3.5, pB1Max: 0.3 }, mrBB: { dev: 3.5, back: 1, win: 16, adxMax: 26, swLb: 32, swLo: 1, swHi: 3, pB1Max: 0.3 }, bw1Max: 0.97, volRegime: { spike: 1.75, calm: 0.8, calmTouchTol: 0.08, calmShortVolMin: 1.2 }, ichiCloudMax: 2.75, momo: { emaRoc: 1.4, adx4Rsi: 14 }, longAdx4Max: 32, skipHourUTC: null, quality: { min: -1 }, shortVolMin: 1.65, rangeAtrMax: 999, swp: { adxMax: 22, eq: 3, vr: 1.2, dropMax: 12 }, grade: { a: 6, b: 3 } };   // idénticos al escáner del Radar (V8 en radar_alert.js)
const HIST_DAYS = 75;
function loadMinutes(p, nowS) {
  const txt = fs.readFileSync(p, 'utf8'), from = nowS - HIST_DAYS * 86400; let end = txt.length; const rows = [];
  while (end > 0) {
    const st = txt.lastIndexOf('\n', end - 1), line = txt.slice(st + 1, end).trim(); end = st < 0 ? 0 : st;
    if (!line || line[0] === 't') { if (st < 0) break; continue; }
    const a = line.split(',').map(Number); if (a.length < 6 || !a.every(Number.isFinite)) { if (st < 0) break; continue; }
    if (a[0] + 60 > nowS) { if (st < 0) break; continue; }
    if (a[0] < from) break; rows.push(a); if (st < 0) break;
  }
  rows.reverse(); return rows;
}
function to15(rows) {
  const B = new Map(); let lastMin = 0;
  for (const [t, o, h, l, c, v] of rows) { const k = Math.floor(t / 900) * 900; lastMin = Math.max(lastMin, t); const b = B.get(k); if (!b) B.set(k, [o, h, l, c, v]); else { b[1] = Math.max(b[1], h); b[2] = Math.min(b[2], l); b[3] = c; b[4] += v; } }
  const lastK = Math.floor(lastMin / 900) * 900; if (lastMin < lastK + 840) B.delete(lastK);
  return { bars: B, lastMin };
}
function parseLive(p) {
  const j = JSON.parse(fs.readFileSync(p, 'utf8')), ser = (j.data && j.data.series && j.data.series[0]) || (j.series && j.series[0]) || j;
  const cols = ser.columns || ['t', 'open', 'high', 'low', 'close', 'volume'], ix = k => cols.indexOf(k), out = new Map();
  for (const r of ser.rows || []) { let t = r[ix('t')]; t = typeof t === 'number' ? (t > 1e12 ? t / 1000 : t) : Date.parse(t) / 1000; const v = [+r[ix('open')], +r[ix('high')], +r[ix('low')], +r[ix('close')], +r[ix('volume')]]; if (Number.isFinite(t) && v.every(Number.isFinite)) out.set(t, v); }
  return out;
}
const med = a => { const b = a.slice().sort((x, y) => x - y), m = b.length >> 1; return b.length ? (b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2) : NaN; };
function run(minPath, livePath, nowS) {
  const M = to15(loadMinutes(minPath, nowS)), problems = [];
  let L = new Map(); try { L = parseLive(livePath); } catch (e) { problems.push('sin velas de 15 min de Binance'); }
  const pairs = []; for (const [t, v] of L) { const g = M.bars.get(t); if (g && t + 900 <= nowS) pairs.push([g, v]); }
  let OFF = -19.4, K = 112.7; if (pairs.length >= 20) { OFF = med(pairs.map(([g, v]) => v[3] - g[3])); K = med(pairs.filter(([g]) => g[4] > 0).map(([g, v]) => v[4] / g[4])); } else problems.push('poco solape de 15 min Bitstamp/Binance (' + pairs.length + ')');
  for (const [t, g] of M.bars) M.bars.set(t, [g[0] + OFF, g[1] + OFF, g[2] + OFF, g[3] + OFF, g[4]]);
  for (const [t, v0] of L) if (t + 900 <= nowS) M.bars.set(t, [v0[0], v0[1], v0[2], v0[3], v0[4] / K]);
  const keys = [...M.bars.keys()].sort((a, b) => a - b), B = { t: [], o: [], h: [], l: [], c: [], v: [] };
  for (const t of keys) { const v = M.bars.get(t); B.t.push(t); B.o.push(v[0]); B.h.push(v[1]); B.l.push(v[2]); B.c.push(v[3]); B.v.push(v[4]); }
  let gaps = 0; for (let i = 1; i < B.t.length; i++) if (B.t[i] - B.t[i - 1] > 900) gaps += (B.t[i] - B.t[i - 1]) / 900 - 1;
  const lastT = B.t[B.t.length - 1]; if (lastT + 900 < Math.floor(nowS / 900) * 900) problems.push('la última vela de 15 min es antigua'); if (gaps > 4) problems.push(gaps + ' velas de 15 min sin datos');
  const R = S.run(B, V20);
  return { R, B, problems, lastT };
}
module.exports = { run, V20 };
if (require.main === module && process.argv[2] === 'need') {
  const nowS = Math.floor((+process.env.MESA_NOW || Date.now()) / 1000), M = to15(loadMinutes(process.argv[3], nowS));
  console.log('LOOKBACK=' + Math.min(167, Math.max(72, Math.ceil((nowS - M.lastMin) / 3600) + 6)) + 'h');
}

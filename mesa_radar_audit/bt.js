const fs = require('fs'); const S = require('./strat.js');
const buf = fs.readFileSync('min.bin'); const A = new Float64Array(buf.buffer, buf.byteOffset, buf.length / 8); const N = A.length / 6;
const mt = new Float64Array(N), mh = new Float64Array(N), ml = new Float64Array(N), mc = new Float64Array(N), mo = new Float64Array(N);
for (let i = 0; i < N; i++) { mt[i] = A[i*6]; mo[i] = A[i*6+1]; mh[i] = A[i*6+2]; ml[i] = A[i*6+3]; mc[i] = A[i*6+4]; }
// 15m bars
const B = { t: [], o: [], h: [], l: [], c: [], v: [] }; let k = -1;
for (let i = 0; i < N; i++) { const t = Math.floor(mt[i] / 900) * 900; if (t !== k) { B.t.push(t); B.o.push(mo[i]); B.h.push(mh[i]); B.l.push(ml[i]); B.c.push(mc[i]); B.v.push(A[i*6+5]); k = t; } else { const j = B.t.length - 1; B.h[j] = Math.max(B.h[j], mh[i]); B.l[j] = Math.min(B.l[j], ml[i]); B.c[j] = mc[i]; B.v[j] += A[i*6+5]; } }
const V20 = { rr: 1.65, beAt: 0, fee: 0.0008, longPdhZone: [-0.5, 1], shortExtPdl: -4, longRsi4Max: 62, skipHourUTC: 21, trendMin: -1, poolZone: [0.7, 1.2], oppPool: { lo: 0.5, hi: 1, w: 2, lo2: 1, hi2: 1.5, w2: 3.5 }, sweep: { lb: 96, macdLo: 1.5, macdHi: 3 }, mr: { dev: 3, back: 1, win: 16, adxMax: 22, swLb: 32, swLo: 0.8, swHi: 3.5, pB1Max: 0.3 }, mrBB: { dev: 3.5, back: 1, win: 16, adxMax: 26, swLb: 32, swLo: 1, swHi: 3, pB1Max: 0.3 }, bw1Max: 0.97, volRegime: { spike: 1.75, calm: 0.8, calmTouchTol: 0.08, calmShortVolMin: 1.2 }, ichiCloudMax: 2.75, momo: { emaRoc: 1.4, adx4Rsi: 14 }, longAdx4Max: 32, skipHourUTC: null, quality: { min: -1 }, shortVolMin: 1.65, rangeAtrMax: 999, swp: { adxMax: 22, eq: 3, vr: 1.2, dropMax: 12 }, grade: { a: 6, b: 3 } };
console.error('bars', B.t.length); let t0 = Date.now();
const R = S.run(B, V20); console.error('run s', (Date.now() - t0) / 1000);
const T = R.trades.filter(x => x.r != null).map(x => ({ sigT: x.sigT, side: x.side, entry: x.entry, sl0: x.sl0, tp: x.tp, risk: x.risk, level: x.level, r: x.r, reason: x.reason, exitT: x.exitT, grade: x.grade, kind: x.kind }));
fs.writeFileSync('panel_trades.json', JSON.stringify(T));
console.error('trades', T.length);

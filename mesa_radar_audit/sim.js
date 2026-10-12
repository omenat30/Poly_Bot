// minute-level simulation of the mesa (retest limit) and of the panel with delayed entry
const fs = require('fs');
const buf = fs.readFileSync('min.bin'); const A = new Float64Array(buf.buffer, buf.byteOffset, buf.length / 8); const N = A.length / 6;
const mt = new Float64Array(N), mo = new Float64Array(N), mh = new Float64Array(N), ml = new Float64Array(N), mc = new Float64Array(N);
for (let i = 0; i < N; i++) { mt[i] = A[i*6]; mo[i] = A[i*6+1]; mh[i] = A[i*6+2]; ml[i] = A[i*6+3]; mc[i] = A[i*6+4]; }
const idx = t => { let lo = 0, hi = N; while (lo < hi) { const m = (lo + hi) >> 1; if (mt[m] < t) lo = m + 1; else hi = m; } return lo; };
// walk from minute index i: returns exit price & reason. stop first if both in one minute.
function walk(i, side, sl, tp, endT) { for (; i < N && mt[i] < endT; i++) { if ((side === 1 ? ml[i] <= sl : mh[i] >= sl)) return { px: sl, why: 'stop', t: mt[i] }; if ((side === 1 ? mh[i] >= tp : ml[i] <= tp)) return { px: tp, why: 'target', t: mt[i] }; } const j = Math.min(i, N) - 1; return { px: mc[j], why: 'tiempo', t: mt[j] }; }
// mesa: limit at level, same stop, 1.65R, valid hrs. pen = extra penetration required (fraction of price). costs: entryFee, exitFee (fractions), stopSlip extra on stops
function mesa(tr, o) {
  if (!(tr.grade === 'A' || tr.grade === 'B') && !o.allGrades) return null;
  const a = tr.risk / 2; let px = tr.level;
  if ((tr.side === 1 && px >= tr.entry) || (tr.side === -1 && px <= tr.entry)) px = tr.entry - tr.side * 0.1 * a;
  const rk = (px - tr.sl0) * tr.side; if (!(rk > 0 && rk / px <= 0.035)) return null;
  const tp = px + tr.side * 1.65 * rk, t0 = tr.sigT + (o.delay || 0) * 60, end = tr.sigT + o.hrs * 3600;
  let i = idx(t0), fill = -1;
  for (; i < N && mt[i] < end; i++) {
    // stop hit before fill cancels the order (price ran through)
    if (tr.side === 1 ? ml[i] <= px * (1 - o.pen) : mh[i] >= px * (1 + o.pen)) { fill = i; break; }
  }
  if (fill < 0) return { filled: false };
  // within fill minute: if it also reaches stop -> stop
  let ex; if (tr.side === 1 ? ml[fill] <= tr.sl0 : mh[fill] >= tr.sl0) ex = { px: tr.sl0, why: 'stop', t: mt[fill] }; else ex = walk(fill + 1, tr.side, tr.sl0, tp, tr.sigT + 72 * 3600);
  const slip = ex.why === 'stop' ? o.stopSlip : 0;
  const r = (ex.px - px) * tr.side / rk - (o.entryFee + o.exitFee(ex.why) + slip) * px / rk;
  return { filled: true, r, why: ex.why, t: tr.sigT, px, rk };
}
// panel with delayed market entry at minute close after delay; same emailed sl/tp; R in emailed risk units
function panel(tr, o) {
  const t = tr.sigT + o.delay * 60; const i = idx(t); if (i >= N) return null;
  const e = o.delay === 0 ? tr.entry : mo[i] + tr.side * o.mktSlip * mo[i];
  if ((e - tr.sl0) * tr.side <= 0 || (tr.tp - e) * tr.side <= 0) return { r: (e - tr.entry) * 0, skip: true, t: tr.sigT };
  const ex = walk(i, tr.side, tr.sl0, tr.tp, tr.sigT + 72 * 3600);
  const slip = ex.why === 'stop' ? o.stopSlip : 0;
  return { r: (ex.px - e) * tr.side / tr.risk - (o.fee + slip) * e / tr.risk, why: ex.why, t: tr.sigT };
}
module.exports = { mesa, panel };

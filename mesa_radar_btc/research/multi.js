const fs = require('fs'); const S = require('./strat_multi.js');
const buf = fs.readFileSync('min.bin'); const A = new Float64Array(buf.buffer, buf.byteOffset, buf.length / 8); const N = A.length / 6;
const V20 = eval('(' + fs.readFileSync('bt.js', 'utf8').match(/const V20 = (\{.*\});/)[1] + ')');
const B = { t: [], o: [], h: [], l: [], c: [], v: [] }; let k = -1;
for (let i = 0; i < N; i++) { const t = Math.floor(A[i*6] / 900) * 900; if (t !== k) { B.t.push(t); B.o.push(A[i*6+1]); B.h.push(A[i*6+2]); B.l.push(A[i*6+3]); B.c.push(A[i*6+4]); B.v.push(A[i*6+5]); k = t; } else { const j = B.t.length - 1; B.h[j] = Math.max(B.h[j], A[i*6+2]); B.l[j] = Math.min(B.l[j], A[i*6+3]); B.c[j] = A[i*6+4]; B.v[j] += A[i*6+5]; } }
const R = S.run(B, Object.assign({}, V20, { multi: { max: 3 } }));
const T = R.trades.filter(x => x.r != null).map(x => ({ sigT: x.sigT, exitT: x.exitT, side: x.side, entry: x.entry, risk: x.risk, r: x.r, reason: x.reason, kind: x.kind, grade: x.grade, extra: !!x.extra, radarSide: x.radarSide || 0 }));
fs.writeFileSync('multi_trades.json', JSON.stringify(T));
const own = T.filter(x => !x.extra), P = JSON.parse(fs.readFileSync('panel_trades.json'));
console.error('radar propias', own.length, 'panel', P.length, 'iguales', own.length === P.length && own.every((x, i) => x.sigT === P[i].sigT && Math.abs(x.r - P[i].r) < 1e-9), 'extras', T.length - own.length);

// El modelo del Radar (mismo código y parámetros V20) en otras escalas de tiempo: cada agente lo aplica a su vela
const fs = require('fs'); const S = require('./strat.js');
const buf = fs.readFileSync('min.bin'); const A = new Float64Array(buf.buffer, buf.byteOffset, buf.length / 8); const N = A.length / 6;
const V20 = eval('(' + fs.readFileSync('bt.js', 'utf8').match(/const V20 = (\{.*\});/)[1] + ')');
for (const sec of process.argv.slice(2).map(Number)) {
  const B = { t: [], o: [], h: [], l: [], c: [], v: [] }; let k = -1;
  for (let i = 0; i < N; i++) { const t = Math.floor(A[i*6] / sec) * sec; if (t !== k) { B.t.push(t); B.o.push(A[i*6+1]); B.h.push(A[i*6+2]); B.l.push(A[i*6+3]); B.c.push(A[i*6+4]); B.v.push(A[i*6+5]); k = t; } else { const j = B.t.length - 1; B.h[j] = Math.max(B.h[j], A[i*6+2]); B.l[j] = Math.min(B.l[j], A[i*6+3]); B.c[j] = A[i*6+4]; B.v[j] += A[i*6+5]; } }
  const P = Object.assign({}, V20, { barSec: sec, rangeBars: Math.max(4, Math.round(V20.rangeBars ? V20.rangeBars * 900 / sec : 24 * 900 / sec)) });
  const t0 = Date.now(); const R = S.run(B, P);
  const T = R.trades.filter(x => x.r != null).map(x => ({ sigT: x.sigT, exitT: x.exitT, side: x.side, entry: x.entry, risk: x.risk, r: x.r, reason: x.reason, kind: x.kind, grade: x.grade }));
  fs.writeFileSync('mtf_' + sec + '.json', JSON.stringify(T)); console.error(sec, 'trades', T.length, 's', (Date.now() - t0) / 1000);
}

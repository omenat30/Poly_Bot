// Radar 15m con todas las variables internas de cada señal y variantes de gestión de la salida (mismas entradas)
const fs = require('fs'); const S = require('./strat.js');
const buf = fs.readFileSync('min.bin'); const A = new Float64Array(buf.buffer, buf.byteOffset, buf.length / 8); const N = A.length / 6;
const V20 = eval('(' + fs.readFileSync('bt.js', 'utf8').match(/const V20 = (\{.*\});/)[1] + ')');
const B = { t: [], o: [], h: [], l: [], c: [], v: [] }; let k = -1;
for (let i = 0; i < N; i++) { const t = Math.floor(A[i*6] / 900) * 900; if (t !== k) { B.t.push(t); B.o.push(A[i*6+1]); B.h.push(A[i*6+2]); B.l.push(A[i*6+3]); B.c.push(A[i*6+4]); B.v.push(A[i*6+5]); k = t; } else { const j = B.t.length - 1; B.h[j] = Math.max(B.h[j], A[i*6+2]); B.l[j] = Math.min(B.l[j], A[i*6+3]); B.c[j] = A[i*6+4]; B.v[j] += A[i*6+5]; } }
const VAR = { base: {}, be1: { beAt: 1 }, rr12: { rr: 1.2 }, rr2: { rr: 2.0 } };
for (const [name, ch] of Object.entries(VAR)) {
  const R = S.run(B, Object.assign({}, V20, ch));
  const T = R.trades.filter(x => x.r != null).map(x => { const o = {}; for (const [kk, v] of Object.entries(x)) if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') o[kk] = v; return o; });
  fs.writeFileSync('rx_' + name + '.json', JSON.stringify(T)); console.error(name, T.length, Object.keys(T[0]).join(','));
}

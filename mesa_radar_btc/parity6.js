const E = require('./office/engine.js'), fs = require('fs');
const H = JSON.parse(fs.readFileSync(__dirname + '/H_full.json'));
const X = E.prepare(H), py = JSON.parse(fs.readFileSync(__dirname + '/py_desk4.json')), N = E.nubarrones(X);
const sv = E.vega(X, false, E.SHADOW.vega), so = E.ortega(X, false, E.SHADOW.ortega), CONF = E.confluence(sv, so);
const nubF = (ts, s) => !N.veto(ts, s), F = k => E.combine(E.PICK[k].conf ? CONF : null, E.PICK[k].nub ? nubF : null);
const R = { vega: E.vega(X, false), ortega: E.ortega(X, false), paz: E.paz(X, false, F('paz')), rios: E.rios(X, false, F('rios')) };
for (const k of ['vega', 'ortega', 'paz', 'rios']) {
  const js = R[k].trades.map(x => [x.sigT, x.side, x.r]), P = py[k]; let diff = 0;
  for (let i = 0; i < Math.min(js.length, P.length); i++) if (js[i][0] !== P[i][0] || js[i][1] !== P[i][1] || Math.abs(js[i][2] - P[i][2]) > 1e-3) { if (diff < 3) console.log(k, i, js[i], P[i]); diff++; }
  console.log(k, 'js', js.length, 'py', P.length, 'diffs', diff);
}
console.log('fase', N.phase, N.ctx);

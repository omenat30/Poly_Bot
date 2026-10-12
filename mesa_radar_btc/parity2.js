const E = require('./office/engine.js'), fs = require('fs');
const H = JSON.parse(fs.readFileSync(__dirname + '/H_full.json'));
const X = E.prepare(H), py = JSON.parse(fs.readFileSync(__dirname + '/py_desk2.json'));
for (const k of ['vega', 'ortega', 'paz', 'rios']) {
  const R = E[k](X, false), js = R.trades.map(x => [x.sigT, x.side, x.r]);
  const P = py[k]; let diff = 0;
  // python closes the last open trade by time at the end; js keeps it open
  const n = Math.min(js.length, P.length);
  for (let i = 0; i < n; i++) if (js[i][0] !== P[i][0] || js[i][1] !== P[i][1] || Math.abs(js[i][2] - P[i][2]) > 1e-3) { if (diff < 3) console.log(k, i, js[i], P[i]); diff++; }
  console.log(k, 'js', js.length, 'py', P.length, 'open', !!R.open, 'diffs', diff);
}

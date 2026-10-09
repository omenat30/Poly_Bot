const E = require('./office/engine.js'), fs = require('fs');
const H = JSON.parse(fs.readFileSync(__dirname + '/H_full.json')), X = E.prepare(H);
const fund = JSON.parse(fs.readFileSync(__dirname + '/fund_hist.json')), py = JSON.parse(fs.readFileSync(__dirname + '/py_fund.json'));
const R = E.ferrer(X, false, fund), js = R.trades.map(x => [x.sigT, x.side, x.r]); let diff = 0;
for (let i = 0; i < Math.min(js.length, py.length); i++) if (js[i][0] !== py[i][0] || js[i][1] !== py[i][1] || Math.abs(js[i][2] - py[i][2]) > 1e-3) { if (diff < 3) console.log(i, js[i], py[i]); diff++; }
console.log('ferrer js', js.length, 'py', py.length, 'diffs', diff);

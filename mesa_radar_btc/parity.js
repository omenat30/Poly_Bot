const E = require('./office/engine.js'), fs = require('fs');
const H = JSON.parse(fs.readFileSync(__dirname + '/H_full.json'));
const X = E.prepare(H);
const out = {}; for (const k of ['vega', 'ortega', 'rios']) { const R = E[k](X, false); out[k] = R.trades.map(x => [x.sigT, x.side, +x.r.toFixed(4)]); console.error(k, R.trades.length, 'open', !!R.open); }
fs.writeFileSync(__dirname + '/js_trades.json', JSON.stringify(out));

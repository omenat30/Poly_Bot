const T = require('./panel_trades.json');
const st = Z => { const n = Z.length; if (!n) return 'n=0'; const s = Z.reduce((p, x) => p + x.r, 0); const w = Z.filter(x => x.r > 0).length; let c = 0, pk = 0, dd = 0; for (const x of Z) { c += x.r; pk = Math.max(pk, c); dd = Math.max(dd, pk - c); } const gp = Z.filter(x=>x.r>0).reduce((p,x)=>p+x.r,0), gl = -Z.filter(x=>x.r<0).reduce((p,x)=>p+x.r,0); const m = s/n, sd = Math.sqrt(Z.reduce((p,x)=>p+(x.r-m)**2,0)/(n-1)); return `n=${n} win=${(w/n*100).toFixed(1)}% exp=${m.toFixed(3)} tot=${s.toFixed(1)} PF=${(gp/gl).toFixed(2)} dd=${dd.toFixed(1)} t=${(m/sd*Math.sqrt(n)).toFixed(2)}`; };
const yr = x => new Date(x.sigT * 1000).getUTCFullYear();
const ys = {}; for (const x of T) (ys[yr(x)] ||= []).push(x);
for (const y in ys) console.log(y, st(ys[y]));
const IS = T.filter(x => x.sigT >= 1609459200), OOS = T.filter(x => x.sigT < 1609459200 && x.sigT >= 1483228800);
console.log('2021-2026 (ajuste)', st(IS)); console.log('2017-2020 (nunca visto)', st(OOS));
for (const g of ['A','B','C']) console.log('  OOS grade', g, st(OOS.filter(x=>x.grade===g)), '| IS', st(IS.filter(x=>x.grade===g)));
for (const k of ['bo','mr','swp']) console.log('  OOS kind', k, st(OOS.filter(x=>x.kind===k)), '| IS', st(IS.filter(x=>x.kind===k)));

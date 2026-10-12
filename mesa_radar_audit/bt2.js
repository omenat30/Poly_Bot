const fs = require('fs'); const S = require('./strat.js');
const buf = fs.readFileSync('min.bin'); const A = new Float64Array(buf.buffer, buf.byteOffset, buf.length / 8); const N = A.length / 6;
const B = { t: [], o: [], h: [], l: [], c: [], v: [] }; let k = -1;
for (let i = 0; i < N; i++) { const tt=A[i*6],o=A[i*6+1],h=A[i*6+2],l=A[i*6+3],c=A[i*6+4],v=A[i*6+5]; const t = Math.floor(tt / 900) * 900; if (t !== k) { B.t.push(t); B.o.push(o); B.h.push(h); B.l.push(l); B.c.push(c); B.v.push(v); k = t; } else { const j = B.t.length - 1; if(h>B.h[j])B.h[j]=h; if(l<B.l[j])B.l[j]=l; B.c[j] = c; B.v[j] += v; } }
const V20 = { rr: 1.65, beAt: 0, fee: 0.0008, longPdhZone: [-0.5, 1], shortExtPdl: -4, longRsi4Max: 62, skipHourUTC: 21, trendMin: -1, poolZone: [0.7, 1.2], oppPool: { lo: 0.5, hi: 1, w: 2, lo2: 1, hi2: 1.5, w2: 3.5 }, sweep: { lb: 96, macdLo: 1.5, macdHi: 3 }, mr: { dev: 3, back: 1, win: 16, adxMax: 22, swLb: 32, swLo: 0.8, swHi: 3.5, pB1Max: 0.3 }, mrBB: { dev: 3.5, back: 1, win: 16, adxMax: 26, swLb: 32, swLo: 1, swHi: 3, pB1Max: 0.3 }, bw1Max: 0.97, volRegime: { spike: 1.75, calm: 0.8, calmTouchTol: 0.08, calmShortVolMin: 1.2 }, ichiCloudMax: 2.75, momo: { emaRoc: 1.4, adx4Rsi: 14 }, longAdx4Max: 32, skipHourUTC: null, quality: { min: -1 }, shortVolMin: 1.65, rangeAtrMax: 999, swp: { adxMax: 22, eq: 3, vr: 1.2, dropMax: 12 }, grade: { a: 6, b: 3 } };
const V = {
  'v5 base (pocas reglas), 1,65R': { rr: 1.65, beAt: 0 },
  'v5 base, 3R + breakeven (original)': {},
  'V20 sin reversión ni barridos': { ...V20, mr: null, mrBB: null, swp: null },
  'V20 sin filtros de liquidez (pool/opp/sweep)': { ...V20, poolZone: null, oppPool: null, sweep: null },
};
const st = Z => { const n = Z.length; if (!n) return 'n=0'; const s = Z.reduce((p, x) => p + x.r, 0); const m=s/n, sd=Math.sqrt(Z.reduce((p,x)=>p+(x.r-m)**2,0)/(n-1)); let c=0,pk=0,dd=0; for(const x of Z){c+=x.r;pk=Math.max(pk,c);dd=Math.max(dd,pk-c);} return `n=${n} exp=${m.toFixed(3)} tot=${s.toFixed(0)} dd=${dd.toFixed(0)} t=${(m/sd*Math.sqrt(n)).toFixed(1)}`; };
for (const [name, p] of Object.entries(V)) { const T = S.run(B, p).trades.filter(x => x.r != null); console.log(name.padEnd(44), '| 21-26', st(T.filter(x=>x.sigT>=1609459200)), '| 17-20', st(T.filter(x=>x.sigT<1609459200&&x.sigT>=1483228800))); }
// export curves for the page
const { mesa } = require('./sim.js');
const from = 1483228800;
const v20 = S.run(B, V20).trades.filter(x => x.r != null && x.sigT >= from);
const v5 = S.run(B, { rr: 1.65, beAt: 0 }).trades.filter(x => x.r != null && x.sigT >= from);
const ms = v20.map(t => mesa(t, { hrs: 8, pen: 0.0002, entryFee: 0.0002, exitFee: w => w === 'target' ? 0.0002 : 0.0005, stopSlip: 0.0005 })).filter(x => x && x.filled);
const W = { A: 1.5, B: 1, C: 0.5 };
const sum = (Z, f) => Z.reduce((p, x) => p + f(x), 0);
for (const [nm, Z] of [['IS', v20.filter(x => x.sigT >= 1609459200)], ['OOS', v20.filter(x => x.sigT < 1609459200)]]) console.log(nm, 'flat', (sum(Z, x => x.r) / Z.length).toFixed(3), 'grade-weighted per unit risk', (sum(Z, x => x.r * W[x.grade]) / sum(Z, x => W[x.grade])).toFixed(3));
const yr = {}; for (const x of v5) { const y = new Date(x.sigT*1000).getUTCFullYear(); (yr[y] ||= []).push(x.r); } console.log('v5 per year', Object.entries(yr).map(([y, a]) => y + ':' + (a.reduce((p,q)=>p+q,0)/a.length).toFixed(2)).join(' '));
const r2 = x => Math.round(x * 100) / 100;
fs.writeFileSync('curves.json', JSON.stringify({ split: 1609459200, start: from, end: B.t[B.t.length - 1], v20: v20.map(x => [x.sigT, r2(x.r)]), v5: v5.map(x => [x.sigT, r2(x.r)]), mesa: ms.map(x => [x.t, r2(x.r)]) }));

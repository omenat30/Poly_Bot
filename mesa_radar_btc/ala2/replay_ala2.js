// Ensayo del ala 2: repite rondas cada 10 min sobre días pasados con datos de Bitstamp (como hará la rutina) y comprueba:
// ninguna ronda falla, ningún cierre sin su entrada registrada, ninguna decisión duplicada o saltada en horario de oficina, y que no hay correos.
// Uso: node ala2/replay_ala2.js <bitstamp.csv> <dir_trabajo> <día1> [día2 ...]   (días AAAA-MM-DD, laborables)
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const [, , CSV, W, ...DAYS] = process.argv, OFF = process.env.ALA2_OFFICE || path.join(__dirname, '..', 'office');
fs.rmSync(W, { recursive: true, force: true }); fs.mkdirSync(W, { recursive: true });
const txt = fs.readFileSync(CSV, 'utf8').trim().split('\n').slice(1).map(l => l.split(',').map(Number));
const bars = (now, sec, hours, k) => { const M = new Map(); for (const a of txt) { if (a[0] + 60 > now || a[0] < now - hours * 3600) continue; const t = Math.floor(a[0] / sec) * sec, b = M.get(t); if (!b) M.set(t, [a[1], a[2], a[3], a[4], a[5]]); else { b[1] = Math.max(b[1], a[2]); b[2] = Math.min(b[2], a[3]); b[3] = a[4]; b[4] += a[5]; } } return [...M].sort((a, b) => a[0] - b[0]).map(([t, v]) => [new Date(t * 1000).toISOString().replace('.000', ''), v[0], v[1], v[2], v[3], +(v[4] * k).toFixed(3)]); };
const wr = (f, cols, rows) => fs.writeFileSync(path.join(W, f), JSON.stringify({ data: { series: [{ columns: cols, rows }] } }));
const DB = new Map(); let est = {}, runs = 0, fails = [], emails = 0;
for (const D of DAYS) for (let h = 5; h <= 19; h++) for (const m of [7, 17, 27, 37, 47, 57]) {
  const now = Date.parse(`${D}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`) / 1000;
  const o5 = bars(now, 300, 22, 110); wr('om5.json', ['t', 'open', 'high', 'low', 'close', 'volume'], o5);
  wr('flow.json', ['t', 'open', 'high', 'low', 'close', 'volume'], o5.slice(-48).map(r => [r[0], r[1], r[2], r[3], r[4], +(r[5] * 0.5).toFixed(3)]));
  const fr = []; for (let t = Math.floor(now / 3600) * 3600 - 80 * 3600; t < now - 3600; t += 3600) fr.push([new Date(t * 1000).toISOString().replace('.000', ''), 0.0100, 0.0100, 0.0100, 0.0100]);
  wr('fund.json', ['t', 'rateOpen', 'rateHigh', 'rateLow', 'rateClose'], fr); wr('oi.json', ['t', 'open', 'high', 'low', 'close'], []); wr('liq.json', ['t', 'liquidations'], []);
  fs.writeFileSync(path.join(W, 'estado.json'), JSON.stringify(est));
  const bsEnd = Math.floor(now / 86400) * 86400;   // el archivo diario de Bitstamp llega hasta las 00:00 UTC
  let out; try { out = execFileSync('node', [path.join(OFF, 'ala2_tick.js'), CSV, ...['om5', 'flow', 'fund', 'oi', 'liq', 'estado'].map(f => path.join(W, f + '.json')), path.join(W, 'out')], { env: Object.assign({}, process.env, { MESA_NOW: now * 1000, ALA2_BS_END: bsEnd }) }).toString(); }
  catch (e) { fails.push(D + ' ' + h + ':' + m + ' ' + e.message.slice(0, 300)); continue; }
  runs++; if (/EMAIL_JSON/.test(out)) emails++;
  const ws = JSON.parse(out.split('\n').find(l => l.startsWith('WRITES ')).slice(7));
  for (const w of ws) { if (w.collection !== 'ala2') fails.push('colección ajena ' + w.collection);
    if (w.op === 'set') { if (DB.has(w.doc_id) && w.doc_id !== 'estado') fails.push('decisión repetida ' + w.doc_id); DB.set(w.doc_id, w.data); }
    else if (w.op === 'update') { const d = DB.get(w.doc_id); if (!d || d.estado !== 'abierta') fails.push('cierre sin entrada abierta: ' + w.doc_id); else Object.assign(d, w.data); } }
  est = DB.get('estado'); const dl = out.split('\n').find(l => l.startsWith('DATOS:')); if (dl) fails.push(D + ' ' + h + ':' + m + ' ' + dl);
  if (m === 57 && h % 3 === 2) console.log(D, h + ':' + m, out.split('\n').find(l => l.startsWith('RESUMEN')).slice(0, 260));
}
const docs = [...DB].filter(([k]) => k !== 'estado').map(([, d]) => d).sort((a, b) => a.t - b.t);
for (let i = 1; i < docs.length; i++) { const g = docs[i].t - docs[i - 1].t; if (g !== 600 && new Date(docs[i].t * 1000).toISOString().slice(0, 10) === new Date(docs[i - 1].t * 1000).toISOString().slice(0, 10)) fails.push('hueco de decisiones antes de ' + docs[i].at); }
const op = docs.filter(d => d.dir !== 'ninguna'), cl = docs.filter(d => d.cierre);
console.log(`rondas ${runs} · decisiones ${docs.length} · entradas ${op.length} · cierres ${cl.length} · correos ${emails}`);
for (const d of op) console.log(' ', d.at, d.dir, d.entry, 'sl', d.sl, 'tp', d.tp, 'EV', d.ev, 'p', d.pw, '→', d.estado, d.cierre ? d.cierre.r + 'R ' + d.cierre.motivo : '');
const rt = est.books.retador; console.log('retador', rt.n, 'ops', rt.sumR.toFixed(2) + 'R', JSON.stringify(rt.hist.slice(-5)), 'abierta', !!rt.open);
console.log(fails.length ? '‼️ ' + fails.length + ' fallos:\n' + [...new Set(fails)].slice(0, 15).join('\n') : '✅ sin fallos');
fs.writeFileSync(path.join(W, 'db.json'), JSON.stringify(Object.fromEntries(DB)));

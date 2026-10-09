// Mesa Radar · ronda de la oficina (cada 15 min, 7:00-20:00 Madrid). Todos los agentes leen los datos a la vez.
// Uso: node mesa_tick.js <bitstamp_1min.csv> <live.json> <dir_db> <dir_salida> [ids,de,signals,ya,registradas]
//   dir_db/cal.json: calendario de hoy (opcional)
//   live.json: respuesta de OpenMarket `points` (BINANCE_FUTURES BTCUSDT, HOUR, 167h)
//   dir_db: carpeta donde ArtifactData guardó `signals` (últimas 72 h) y `calendar` (hoy) con out_dir
// Escribe en dir_salida los documentos y pinta: WRITES <json para ArtifactData batch>, EMAIL_JSON <...>, RESUMEN <...>
const fs = require('fs'), path = require('path');
const E = require(path.join(__dirname, 'engine.js'));
const [, , minPath, livePath, dbDir, outDir, knownArg] = process.argv;
const now = Math.floor((+process.env.MESA_NOW || Date.now()) / 1000);
const GO_LIVE = +process.env.MESA_GO_LIVE || Date.UTC(2026, 9, 9, 16, 0) / 1000;   // 9 oct 2026, 18:00 Madrid
const URL_ = 'https://claude.ai/artifact/MxNVeAAFhmbBYRg4qi6LJy';
const fmt = x => Math.round(x).toLocaleString('es-ES'), pct = x => (x >= 0 ? '+' : '−') + Math.abs(x * 100).toFixed(1).replace('.', ',') + '%', sR = x => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(2).replace('.', ',') + 'R';
const madrid = s => new Date(s * 1000).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const hm = s => new Date(s * 1000).toLocaleTimeString('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' });
const problems = [];

// 1) histórico de Bitstamp (último año) en velas de 1 h
function loadHours(p) {
  const txt = fs.readFileSync(p, 'utf8'), from = now - 420 * 86400, M = new Map(); let end = txt.length, lastMin = 0;
  while (end > 0) {
    const st = txt.lastIndexOf('\n', end - 1), line = txt.slice(st + 1, end).trim(); end = st < 0 ? 0 : st;
    if (line && line[0] !== 't') { const a = line.split(',').map(Number); if (a.length >= 6 && a.every(Number.isFinite) && a[0] + 60 <= now) { if (a[0] < from) break; lastMin = Math.max(lastMin, a[0]); const k = Math.floor(a[0] / 3600) * 3600, b = M.get(k); if (!b) M.set(k, [a[1], a[2], a[3], a[4], a[5], a[0], a[0]]); else { if (a[0] < b[5]) { b[0] = a[1]; b[5] = a[0]; } if (a[0] > b[6]) { b[3] = a[4]; b[6] = a[0]; } b[1] = Math.max(b[1], a[2]); b[2] = Math.min(b[2], a[3]); b[4] += a[5]; } } }
    if (st < 0) break;
  }
  const lk = Math.floor(lastMin / 3600) * 3600; if (lastMin < lk + 3540) M.delete(lk);
  return { M, lastMin };
}
const BS = loadHours(minPath);
// 2) Binance futuros (OpenMarket), velas de 1 h
const J = JSON.parse(fs.readFileSync(livePath, 'utf8'));
const ser = (J.data && J.data.series && J.data.series[0]) || (J.series && J.series[0]) || J, cols = ser.columns || ['t', 'open', 'high', 'low', 'close', 'volume'], ix = k => cols.indexOf(k);
const LV = new Map();
for (const r of ser.rows || []) { let t = r[ix('t')]; t = typeof t === 'number' ? (t > 1e12 ? t / 1000 : t) : Date.parse(t) / 1000; const v = [+r[ix('open')], +r[ix('high')], +r[ix('low')], +r[ix('close')], +r[ix('volume')]]; if (Number.isFinite(t) && v.every(Number.isFinite)) LV.set(t, v); }
if (LV.size < 48) problems.push('solo ' + LV.size + ' velas de Binance');
const med = a => { const b = a.slice().sort((x, y) => x - y), m = b.length >> 1; return b.length ? (b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2) : NaN; };
const pairs = []; for (const [t, v] of LV) { const g = BS.M.get(t); if (g && t + 3600 <= now) pairs.push([g, v]); }
let OFF = -19, K = 110; if (pairs.length >= 12) { OFF = med(pairs.map(([g, v]) => v[3] - g[3])); K = med(pairs.filter(([g]) => g[4] > 0).map(([g, v]) => v[4] / g[4])); } else problems.push('poco solape Bitstamp/Binance (' + pairs.length + ' h)');
const all = new Map(); for (const [t, g] of BS.M) all.set(t, [g[0] + OFF, g[1] + OFF, g[2] + OFF, g[3] + OFF, g[4]]);
for (const [t, v] of LV) if (t + 3600 <= now) all.set(t, [v[0], v[1], v[2], v[3], v[4] / K]);
const keys = [...all.keys()].sort((a, b) => a - b), H = { t: [], o: [], h: [], l: [], c: [], v: [] };
for (const t of keys) { const v = all.get(t); H.t.push(t); H.o.push(v[0]); H.h.push(v[1]); H.l.push(v[2]); H.c.push(v[3]); H.v.push(v[4]); }
let gaps = 0; for (let i = 1; i < H.t.length; i++) if (H.t[i] - H.t[i - 1] > 3600) gaps += (H.t[i] - H.t[i - 1]) / 3600 - 1;
if (gaps > 3) problems.push(gaps + ' h sin datos');
const lastT = H.t[H.t.length - 1];
if (lastT + 3600 < Math.floor(now / 3600) * 3600) problems.push('la última vela cerrada es de ' + hm(lastT + 3600));
const lastPx = (() => { const ks = [...LV.keys()].sort((a, b) => a - b); return ks.length ? LV.get(ks[ks.length - 1])[3] : H.c[H.c.length - 1]; })();

// 3) los agentes leen y deciden
const X = E.prepare(H), hNow = E.madridHour(now), office = hNow >= 7 && hNow < 20;
const R = { vega: E.vega(X, office), ortega: E.ortega(X, office), rios: E.rios(X, office) };
const NAMES = { vega: 'Vega · tendencia diaria', ortega: 'Ortega · ruptura de 5 días', rios: 'Ríos · compresión y volumen (papel)' };
const REAL = { vega: true, ortega: true, rios: false };
// eventos ya registrados
const known = new Set(String(knownArg || '').split(/[\s,]+/).filter(Boolean)); const sd = path.join(dbDir, 'signals'); if (fs.existsSync(sd)) for (const f of fs.readdirSync(sd)) known.add(f.replace(/\.json$/, ''));
let cal = null; const cd = path.join(dbDir, 'calendar'), readCal = f => { try { const d = JSON.parse(fs.readFileSync(f, 'utf8')); cal = d.data || d; } catch (e) {} };
if (fs.existsSync(cd)) for (const f of fs.readdirSync(cd)) readCal(path.join(cd, f));
if (fs.existsSync(path.join(dbDir, 'cal.json'))) readCal(path.join(dbDir, 'cal.json'));
const events = [], emails = [];
const tag = s => new Date(s * 1000).toISOString().slice(0, 13).replace(/[-T]/g, '');
const sizeLine = risk => 'Tamaño con un 0,5% de riesgo: (capital × 0,005) / ' + fmt(risk) + ' BTC.';
const calWarn = () => { if (!cal || !cal.events) return ''; const soon = cal.events.filter(e => { const [H_, M_] = String(e.hora || '').split(':').map(Number); if (!Number.isFinite(H_)) return false; const d = new Date(now * 1000); const loc = new Date(d.toLocaleString('en-US', { timeZone: 'Europe/Madrid' })); const diff = (H_ * 60 + (M_ || 0)) - (loc.getHours() * 60 + loc.getMinutes()); return diff >= -15 && diff <= 90; }); return soon.length ? '\n⚠ Paz: ' + soon.map(e => e.hora + ' ' + e.evento).join(' · ') + ' (dato macro cerca: la entrada puede saltar).' : ''; };
for (const k of ['vega', 'ortega', 'rios']) {
  const r = R[k];
  if (r.pending && r.pending.sigT >= GO_LIVE) {
    const id = k + '-in-' + tag(r.pending.sigT), e = lastPx, stop = e - r.pending.dist;
    if (!known.has(id)) {
      events.push({ id, agent: k, type: 'entrada', at: new Date(now * 1000).toISOString(), side: 'long', entry: +e.toFixed(1), stop: +stop.toFixed(1), real: REAL[k], text: 'Entrada LARGO a mercado ≈ ' + fmt(e) + ', stop ' + fmt(stop) + ' (' + pct((stop - e) / e) + ')' });
      if (REAL[k]) emails.push({ subject: '🟢 Mesa Radar · ' + NAMES[k] + ' · LARGO BTC ≈ ' + fmt(e) + ' · stop ' + fmt(stop), body: 'Nueva entrada de la Mesa (' + NAMES[k] + ').\n\nCompra BTC a mercado ahora (≈ ' + fmt(e) + ').\nStop inicial: ' + fmt(stop) + ' (' + pct((stop - e) / e) + '), colócalo en el exchange al entrar.\nSin objetivo fijo: el stop sube solo a favor; la Mesa te avisa cuando lo tengas que mover y cuando haya que cerrar.\n' + sizeLine(r.pending.dist) + calWarn() + '\n\nBacktest 2017-2026 en horario de oficina: Vega y Ortega juntos +0,26R por operación en 2022-2026 (años no usados para elegir parámetros), unas 33 operaciones al año. Apunta la ejecución en Mesa Radar: ' + URL_ });
    }
  }
  if (r.open && r.open.sigT >= GO_LIVE) {
    const o = r.open, step = Math.floor((o.stop - o.stop0) * o.side / (1 * o.risk));
    if (step >= 1 && office) { const id = k + '-stop-' + tag(o.sigT) + '-' + step; if (!known.has(id)) { events.push({ id, agent: k, type: 'stop', at: new Date(now * 1000).toISOString(), stop: +o.stop.toFixed(1), real: REAL[k], text: 'Sube el stop a ' + fmt(o.stop) + ' (asegura ' + sR((o.stop - o.entry) * o.side / o.risk) + ')' }); if (REAL[k]) emails.push({ subject: '⬆ Mesa Radar · ' + NAMES[k] + ' · sube el stop a ' + fmt(o.stop), body: 'Posición LARGO BTC desde ' + fmt(o.entry) + '.\nMueve el stop a ' + fmt(o.stop) + ' (asegura ' + sR((o.stop - o.entry) * o.side / o.risk) + '). Precio ahora ≈ ' + fmt(lastPx) + '.\n\n' + URL_ }); } }
    if (o.exitDue && office) { const id = k + '-out-' + tag(o.sigT); if (!known.has(id)) { const rr = ((lastPx - o.entry) * o.side - E.FEE * o.entry) / o.risk; events.push({ id, agent: k, type: 'salida', at: new Date(now * 1000).toISOString(), exit: +lastPx.toFixed(1), r: +rr.toFixed(2), real: REAL[k], text: 'Cierra a mercado ≈ ' + fmt(lastPx) + ': la tendencia diaria se ha perdido (' + sR(rr) + ')' }); if (REAL[k]) emails.push({ subject: '⚪ Mesa Radar · ' + NAMES[k] + ' · CIERRA BTC ≈ ' + fmt(lastPx) + ' (' + sR(rr) + ')', body: 'La tendencia diaria se ha perdido: cierra la posición LARGO a mercado (≈ ' + fmt(lastPx) + ') y quita el stop.\nResultado aproximado: ' + sR(rr) + '.\n\n' + URL_ }); } }
  }
  for (const tr of r.trades) if (tr.sigT >= GO_LIVE && tr.exitT >= now - 72 * 3600) {
    const id = k + '-out-' + tag(tr.sigT);
    if (!known.has(id)) { events.push({ id, agent: k, type: 'salida', at: new Date(now * 1000).toISOString(), exit: +tr.exit.toFixed(1), r: +tr.r.toFixed(2), real: REAL[k], text: (tr.why === 'stop' ? 'Saltó el stop en ' : 'Cerrada en ') + fmt(tr.exit) + ' (' + sR(tr.r) + ')' }); if (REAL[k]) emails.push(tr.why === 'senal' ? { subject: '⚪ Mesa Radar · ' + NAMES[k] + ' · CIERRA BTC (tendencia perdida)', body: 'La tendencia diaria se perdió: si sigues dentro, cierra la posición LARGO desde ' + fmt(tr.entry) + ' a mercado y quita el stop. Resultado del sistema: ' + sR(tr.r) + '.\n\n' + URL_ } : { subject: '⚪ Mesa Radar · ' + NAMES[k] + ' · cerrada por stop ' + fmt(tr.exit) + ' (' + sR(tr.r) + ')', body: 'La posición LARGO desde ' + fmt(tr.entry) + ' ha tocado el stop en ' + fmt(tr.exit) + '. Resultado ' + sR(tr.r) + ' con costes.\n\n' + URL_ }); }
  }
}

// 4) notas de cada agente
const pos = k => { const o = R[k] && R[k].open; if (!o) return null; return { side: 'long', entry: +o.entry.toFixed(1), stop: +o.stop.toFixed(1), since: new Date(o.entryT * 1000).toISOString(), rNow: +o.rNow.toFixed(2), live: o.sigT >= GO_LIVE }; };
const st = (k, txt, level) => ({ text: txt, level, pos: pos(k) });
const V = R.vega.ctx, O = R.ortega.ctx, Ri = R.rios.ctx;
const posTxt = k => { const p = pos(k); return p ? ' LARGO desde ' + fmt(p.entry) + ', stop ' + fmt(p.stop) + ', va ' + sR(p.rNow) + (p.live ? '.' : ' (abierta antes de empezar en vivo: no la copies a mitad).') : ''; };
const evOf = k => events.filter(e => e.agent === k).map(e => e.text).join(' · ');
const notes = {
  vega: st('vega', (evOf('vega') ? evOf('vega') + '. ' : '') + 'Cierre diario ' + fmt(V.close) + ' frente a SMA20 ' + fmt(V.sma) + ' (' + pct(V.close / V.sma - 1) + '), momentum 20 d ' + pct(V.mom) + ': ' + (V.on ? 'TENDENCIA ALCISTA.' : 'sin tendencia, fuera.') + (R.vega.open ? posTxt('vega') : V.on ? ' Esperando un nuevo giro para entrar.' : ' Entro con un cierre diario sobre ' + fmt(V.sma) + ' y momentum positivo.'), evOf('vega') ? 'trade' : V.on ? 'idea' : 'ok'),
  ortega: st('ortega', (evOf('ortega') ? evOf('ortega') + '. ' : '') + 'Máximo de 5 días ' + fmt(O.level) + ' (precio ' + fmt(lastPx) + ', ' + pct(O.level / lastPx - 1) + ' por encima). ' + (R.ortega.open ? posTxt('ortega') : 'Compro si una vela de 4 h cierra sobre él; próxima a las ' + hm(O.nextDecision) + '.'), evOf('ortega') ? 'trade' : O.level / lastPx - 1 < 0.01 ? 'idea' : 'ok'),
  rios: st('rios', (evOf('rios') ? evOf('rios') + ' (papel). ' : '') + 'Bollinger 1H en el percentil ' + Math.round(Ri.rank * 100) + ' de 30 días (busco ≤ 20), volumen ' + Ri.vol.toFixed(1).replace('.', ',') + '× su media, tendencia SMA50 diaria ' + (Ri.regime === 1 ? 'alcista' : 'bajista') + '. ' + (R.rios.open ? posTxt('rios') : Ri.regime !== 1 ? 'Con SMA50 bajista no compro rupturas.' : Ri.rank <= 0.2 ? 'Mercado comprimido: vigilo la ruptura de ' + fmt(Ri.upper) + '.' : 'Sin compresión todavía.') + ' En papel hasta que demuestre en vivo.', evOf('rios') ? 'trade' : Ri.rank <= 0.2 && Ri.regime === 1 ? 'idea' : 'ok'),
  paz: st('paz', (cal && cal.events && cal.events.length ? 'Hoy: ' + cal.events.map(e => e.hora + ' ' + e.evento + (e.impacto ? ' (' + e.impacto + ')' : '')).join(' · ') + '.' : cal ? 'Sin datos macro de impacto alto hoy.' : 'Calendario de hoy aún sin leer.') + (calWarn() ? ' Dato macro en menos de 90 min.' : '') + (cal && cal.titular ? ' ' + cal.titular : ''), calWarn() ? 'alerta' : 'ok'),
};
// Calvo: marcador en vivo
const live = [], liveR = { vega: 0, ortega: 0, rios: 0 }, liveN = { vega: 0, ortega: 0, rios: 0 };
for (const k of ['vega', 'ortega', 'rios']) for (const tr of R[k].trades) if (tr.sigT >= GO_LIVE) { liveR[k] += tr.r; liveN[k]++; live.push(tr); }
const realN = liveN.vega + liveN.ortega, realR = liveR.vega + liveR.ortega;
notes.calvo = st('calvo', 'En vivo desde el 9 oct: ' + (realN ? realN + ' cerradas reales, ' + sR(realR) + ' (' + sR(realR / realN) + ' por operación; referencia 2022-26: +0,26R).' : 'aún ninguna operación cerrada.') + ' Ríos en papel: ' + liveN.rios + ' cerradas, ' + sR(liveR.rios) + '.' + (problems.length ? ' Datos: ' + problems.join('; ') + '.' : ' Datos verificados (' + pairs.length + ' h de solape).') + (realN >= 20 && realR / realN < -0.1 ? ' AVISO: la mesa se desvía del backtest.' : ''), problems.length ? 'alerta' : 'ok');

// 5) salida
fs.mkdirSync(outDir, { recursive: true });
const id = 'tick-' + new Date(now * 1000).toISOString().slice(0, 16).replace(/[-:T]/g, '');
const tick = { at: new Date(now * 1000).toISOString(), price: +lastPx.toFixed(1), office, notes, events: events.map(e => e.id), dataOk: !problems.length, lastBar: new Date((lastT + 3600) * 1000).toISOString() };
fs.writeFileSync(path.join(outDir, id + '.json'), JSON.stringify(tick));
const writes = [{ op: 'set', collection: 'ticks', doc_id: id, data: tick }];
for (const e of events) { const f = path.join(outDir, e.id + '.json'); fs.writeFileSync(f, JSON.stringify(e)); writes.push({ op: 'set', collection: 'signals', doc_id: e.id, data: e }); }
console.log('WRITES ' + JSON.stringify(writes));
for (const m of emails) console.log('EMAIL_JSON ' + JSON.stringify(m));
console.log('RESUMEN ' + (events.length ? events.map(e => NAMES[e.agent] + ': ' + e.text).join(' | ') : 'Ronda sin novedades') + ' · BTC ' + fmt(lastPx) + (problems.length ? ' · DATOS: ' + problems.join('; ') : ''));

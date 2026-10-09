// Mesa Radar · ronda de la oficina (cada 15 min, 7:00-20:00 Madrid). Todos los agentes leen los datos a la vez.
// Vega, Ortega, Paz y Ríos operan BTC (largos y cortos según la SMA50 diaria); Calvo vigila riesgo, datos y calendario y preside la sala de emergencias.
// Uso: node mesa_tick.js <bitstamp_1min.csv> <live.json> <dir_db> <dir_salida> [ids,de,signals,ya,registradas]
//   dir_db/cal.json: calendario de hoy (opcional)
//   live.json: respuesta de OpenMarket `points` (BINANCE_FUTURES BTCUSDT, HOUR, 167h)
//   dir_db: carpeta donde ArtifactData guardó `signals` (últimas 72 h) y `calendar` (hoy) con out_dir
// Escribe en dir_salida los documentos y pinta: WRITES <json para ArtifactData batch>, EMAIL_JSON <...>, RESUMEN <...>
const fs = require('fs'), path = require('path');
const E = require(path.join(__dirname, 'engine.js'));
const [, , minPath, livePath, dbDir, outDir, knownArg] = process.argv;
const now = Math.floor((+process.env.MESA_NOW || Date.now()) / 1000);
const GO_LIVE = +process.env.MESA_GO_LIVE || Date.UTC(2026, 9, 9, 16, 0) / 1000;   // 9 oct 2026, 18:00 Madrid (mesa de 4 agentes, largos y cortos)
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
const X = E.prepare(H), hNow = E.madridHour(now), office = E.madridWork(now), N = H.t.length;
const AGS = ['vega', 'ortega', 'paz', 'rios'];
const R = {}; R.vega = E.vega(X, office); R.ortega = E.ortega(X, office);
const SH = { vega: E.vega(X, false, E.SHADOW.vega), ortega: E.ortega(X, false, E.SHADOW.ortega) };   // sombras de la confluencia
const CONF = E.confluence(SH.vega, SH.ortega); R.paz = E.paz(X, office, E.PICK.paz.conf ? CONF : null); R.rios = E.rios(X, office, E.PICK.rios.conf ? CONF : null);
const confWho = s => SH.vega.open && SH.vega.open.side === s ? 'la tendencia diaria' : SH.ortega.open && SH.ortega.open.side === s ? 'la ruptura de 5 días' : null;
const confNow = s => !!confWho(s);
const NAMES = { vega: 'Vega · tendencia diaria', ortega: 'Ortega · ruptura de 5 días', paz: 'Paz · retroceso a favor', rios: 'Ríos · compresión y volumen' };
const RISK = { vega: 0.5, ortega: 0.5, paz: 0.375, rios: 0.375 };   // % del capital por operación
const W = { vega: 1, ortega: 1, paz: 0.75, rios: 0.75 };
const MAXH = { paz: 96, rios: 240, ortega: 2880 };
const SIDE = s => s === 1 ? 'LARGO' : 'CORTO', VERB = s => s === 1 ? 'Compra' : 'Vende';
const known = new Set(String(knownArg || '').split(/[\s,]+/).filter(Boolean)); const sd = path.join(dbDir, 'signals'); if (fs.existsSync(sd)) for (const f of fs.readdirSync(sd)) known.add(f.replace(/\.json$/, ''));
let cal = null; const cd = path.join(dbDir, 'calendar'), readCal = f => { try { const d = JSON.parse(fs.readFileSync(f, 'utf8')); cal = d.data || d; } catch (e) {} };
if (fs.existsSync(cd)) for (const f of fs.readdirSync(cd)) readCal(path.join(cd, f));
if (fs.existsSync(path.join(dbDir, 'cal.json'))) readCal(path.join(dbDir, 'cal.json'));
const events = [], emails = [];
const tag = s => new Date(s * 1000).toISOString().slice(0, 13).replace(/[-T]/g, '');
const sizeLine = (k, risk) => 'Tamaño con un ' + String(RISK[k]).replace('.', ',') + '% de riesgo: (capital × ' + (RISK[k] / 100) + ') / ' + fmt(risk) + ' BTC.';
const calSoon = () => { if (!cal || !cal.events) return []; const loc = new Date(new Date(now * 1000).toLocaleString('en-US', { timeZone: 'Europe/Madrid' })); return cal.events.filter(e => { const [H_, M_] = String(e.hora || '').split(':').map(Number); if (!Number.isFinite(H_)) return false; const diff = (H_ * 60 + (M_ || 0)) - (loc.getHours() * 60 + loc.getMinutes()); return diff >= -15 && diff <= 90; }); };
const calWarn = () => { const s = calSoon(); return s.length ? '\n⚠ Calvo: ' + s.map(e => e.hora + ' ' + e.evento).join(' · ') + ' (dato macro cerca: la entrada puede saltar).' : ''; };
const REF = 'Mesa v5 (L-V 7:00-21:00, reglas elegidas por R medio × acierto, pesando más los años recientes). En walk-forward 2020-26, sin ver nunca el año operado: 2,3 operaciones por semana, 41% de acierto, +0,35R por operación y +34R al año.';
const G = E.GEST;
const plan = (k, s, e, dist) => { const g = G[k] || {}, L = []; if (g.tp) L.push('Pon también una orden límite para cerrar el ' + Math.round(g.f * 100) + '% en ' + fmt(e + s * g.tp * dist) + ' (+' + String(g.tp).replace('.', ',') + 'R).'); if (g.be) L.push('Cuando el precio llegue a ' + fmt(e + s * g.be * dist) + ' (+' + String(g.be).replace('.', ',') + 'R) te avisaré de mover el stop a ' + fmt(e + s * g.beoff * dist) + ' (+' + String(g.beoff).replace('.', ',') + 'R): a partir de ahí la operación ya no puede perder.'); return L.length ? L.join('\n') + '\n' : ''; };
for (const k of AGS) {
  const r = R[k];
  if (r.pending && r.pending.sigT >= GO_LIVE) {
    const p = r.pending, s = p.side, id = k + '-in-' + tag(p.sigT), e = lastPx, stop = e - s * p.dist;
    if (!known.has(id)) {
      events.push({ id, agent: k, type: 'entrada', at: new Date(now * 1000).toISOString(), side: s === 1 ? 'long' : 'short', entry: +e.toFixed(1), stop: +stop.toFixed(1), real: true, text: 'Entrada ' + SIDE(s) + ' a mercado ≈ ' + fmt(e) + ', stop ' + fmt(stop) + ' (' + pct((stop - e) / e) + ')' });
      emails.push({ subject: (s === 1 ? '🟢' : '🔴') + ' Mesa Radar · ' + NAMES[k] + ' · ' + SIDE(s) + ' BTC ≈ ' + fmt(e) + ' · stop ' + fmt(stop), body: 'Nueva entrada de la Mesa (' + NAMES[k] + ').\n\n' + VERB(s) + ' BTC a mercado ahora (≈ ' + fmt(e) + ').\nStop inicial: ' + fmt(stop) + ' (' + pct((stop - e) / e) + '), colócalo en el exchange al entrar.\n' + (MAXH[k] && MAXH[k] < 1000 ? 'Sin objetivo fijo: stop móvil a favor y cierre como mucho a las ' + MAXH[k] + ' h.' : 'Sin objetivo fijo: el stop se mueve solo a favor.') + ' La Mesa te avisa cuando lo tengas que mover y cuando haya que cerrar.\n' + plan(k, s, e, p.dist) + (k === 'paz' && confWho(s) ? 'Confluencia: ' + confWho(s) + ' está a favor.\n' : '') + sizeLine(k, p.dist) + calWarn() + '\n\n' + REF + ' Apunta la ejecución en Mesa Radar: ' + URL_ });
    }
  }
  if (r.open && r.open.sigT >= GO_LIVE) {
    const o = r.open, s = o.side, step = Math.floor((o.stop - o.stop0) * s / o.risk);
    if (o.part > 0) { const id = k + '-tp-' + tag(o.sigT); if (!known.has(id)) { events.push({ id, agent: k, type: 'parcial', at: new Date(now * 1000).toISOString(), real: true, text: 'Parcial: cerrado el ' + Math.round(o.part * 100) + '% en ' + fmt(o.tp) + ' (+' + String(G[k].tp).replace('.', ',') + 'R)' }); emails.push({ subject: '💰 Mesa Radar · ' + NAMES[k] + ' · parcial cobrado en ' + fmt(o.tp), body: 'La orden límite del ' + Math.round(o.part * 100) + '% se ha ejecutado en ' + fmt(o.tp) + ' (+' + String(G[k].tp).replace('.', ',') + 'R). El resto sigue con su stop en ' + fmt(o.stop) + '.\n\n' + URL_ }); } }
    if (step >= 1 && office) { const id = k + '-stop-' + tag(o.sigT) + '-' + step; if (!known.has(id)) { events.push({ id, agent: k, type: 'stop', at: new Date(now * 1000).toISOString(), stop: +o.stop.toFixed(1), real: true, text: (s === 1 ? 'Sube' : 'Baja') + ' el stop a ' + fmt(o.stop) + ' (asegura ' + sR((o.stop - o.entry) * s / o.risk) + ' antes de costes)' }); emails.push({ subject: (s === 1 ? '⬆' : '⬇') + ' Mesa Radar · ' + NAMES[k] + ' · ' + (s === 1 ? 'sube' : 'baja') + ' el stop a ' + fmt(o.stop), body: 'Posición ' + SIDE(s) + ' BTC desde ' + fmt(o.entry) + '.\nMueve el stop a ' + fmt(o.stop) + ' (asegura ' + sR((o.stop - o.entry) * s / o.risk) + ' antes de costes). Precio ahora ≈ ' + fmt(lastPx) + '.\n\n' + URL_ }); } }
    if (o.exitDue && office) { const id = k + '-out-' + tag(o.sigT); if (!known.has(id)) { const rr = ((lastPx - o.entry) * s - E.FEE * o.entry) / o.risk; events.push({ id, agent: k, type: 'salida', at: new Date(now * 1000).toISOString(), exit: +lastPx.toFixed(1), r: +rr.toFixed(2), real: true, text: 'Cierra a mercado ≈ ' + fmt(lastPx) + ': la tendencia diaria se ha perdido (' + sR(rr) + ')' }); emails.push({ subject: '⚪ Mesa Radar · ' + NAMES[k] + ' · CIERRA BTC ≈ ' + fmt(lastPx) + ' (' + sR(rr) + ')', body: 'La tendencia diaria se ha perdido: cierra la posición ' + SIDE(s) + ' a mercado (≈ ' + fmt(lastPx) + ') y quita el stop.\nResultado aproximado: ' + sR(rr) + '.\n\n' + URL_ }); } }
  }
  for (const tr of r.trades) if (tr.sigT >= GO_LIVE && tr.exitT >= now - 72 * 3600) {
    const id = k + '-out-' + tag(tr.sigT), s = tr.side;
    if (known.has(id)) continue;
    const txt = tr.why === 'stop' ? 'Saltó el stop en ' + fmt(tr.exit) : tr.why === 'tiempo' ? 'Cierre por plazo (' + MAXH[k] + ' h) ≈ ' + fmt(tr.exit) : 'Cerrada en ' + fmt(tr.exit);
    events.push({ id, agent: k, type: 'salida', at: new Date(now * 1000).toISOString(), exit: +tr.exit.toFixed(1), r: +tr.r.toFixed(2), real: true, text: txt + ' (' + sR(tr.r) + ')' });
    emails.push(tr.why === 'senal' ? { subject: '⚪ Mesa Radar · ' + NAMES[k] + ' · CIERRA BTC (tendencia perdida)', body: 'La tendencia diaria se perdió: si sigues dentro, cierra la posición ' + SIDE(s) + ' desde ' + fmt(tr.entry) + ' a mercado y quita el stop. Resultado del sistema: ' + sR(tr.r) + '.\n\n' + URL_ }
      : tr.why === 'tiempo' ? { subject: '⚪ Mesa Radar · ' + NAMES[k] + ' · CIERRA BTC a mercado (plazo cumplido)', body: 'La posición ' + SIDE(s) + ' desde ' + fmt(tr.entry) + ' ha cumplido su plazo máximo de ' + MAXH[k] + ' h: ciérrala a mercado (≈ ' + fmt(lastPx) + ') y quita el stop. Resultado del sistema: ' + sR(tr.r) + '.\n\n' + URL_ }
      : { subject: '⚪ Mesa Radar · ' + NAMES[k] + ' · cerrada por stop ' + fmt(tr.exit) + ' (' + sR(tr.r) + ')', body: 'La posición ' + SIDE(s) + ' desde ' + fmt(tr.entry) + ' ha tocado el stop en ' + fmt(tr.exit) + '. Resultado ' + sR(tr.r) + ' con costes.\n\n' + URL_ });
  }
}

// 3b) MODO PRUEBA (MESA_TEST=long|short): simula una entrada de Ortega para ver el circuito completo. Nada de esto es una señal real.
const TEST = process.env.MESA_TEST === 'long' ? 1 : process.env.MESA_TEST === 'short' ? -1 : 0;
let testPos = null;
if (TEST) {
  const s = TEST, e = lastPx, dist = 2 * (R.ortega.ctx.atr || e * 0.02), stop = e - s * dist, id = 'test-ortega-in-' + tag(now) + new Date(now * 1000).toISOString().slice(14, 16);
  testPos = { side: s === 1 ? 'long' : 'short', entry: +e.toFixed(1), stop: +stop.toFixed(1), since: new Date(now * 1000).toISOString(), rNow: 0, live: true, test: true };
  events.push({ id, agent: 'ortega', type: 'entrada', test: true, at: new Date(now * 1000).toISOString(), side: testPos.side, entry: testPos.entry, stop: testPos.stop, real: false, text: 'PRUEBA · Entrada ' + SIDE(s) + ' a mercado ≈ ' + fmt(e) + ', stop ' + fmt(stop) + ' (' + pct((stop - e) / e) + ')' });
  emails.push({ subject: '🧪 PRUEBA · ' + (s === 1 ? '🟢' : '🔴') + ' Mesa Radar · ' + NAMES.ortega + ' · ' + SIDE(s) + ' BTC ≈ ' + fmt(e) + ' · stop ' + fmt(stop), body: '⚠ ESTO ES UNA PRUEBA DEL SISTEMA. NO ES UNA SEÑAL: NO OPERES.\n\nAsí te llegará una entrada real de la Mesa (' + NAMES.ortega + ').\n\n' + VERB(s) + ' BTC a mercado ahora (≈ ' + fmt(e) + ').\nStop inicial: ' + fmt(stop) + ' (' + pct((stop - e) / e) + '), colócalo en el exchange al entrar.\nSin objetivo fijo: el stop se mueve solo a favor. ' + plan('ortega', s, e, dist) + sizeLine('ortega', dist) + calWarn() + '\n\n' + REF + '\n\nMira en Mesa Radar cómo se reúnen los agentes: ' + URL_ });
}

// 4) sala de emergencias: movimiento brusco en 1-3 h (≥ 3,5 desviaciones de las últimas 720 h; ~1,5 por semana en horario)
let ss = 0, sn = 0; for (let i = Math.max(1, N - 720); i < N; i++) { const q = Math.log(H.c[i] / H.c[i - 1]); ss += q * q; sn++; }
const sd1 = Math.sqrt(ss / Math.max(1, sn));
const win = [1, 2, 3].map(back => { const span = Math.max(1, (now - H.t[N - back]) / 3600), m = Math.log(lastPx / H.o[N - back]); return { h: Math.round(span), move: Math.exp(m) - 1, z: m / (sd1 * Math.sqrt(span)) }; });
const big = win.reduce((a, b) => Math.abs(b.z) > Math.abs(a.z) ? b : a);
let emergency = null;
if (Math.abs(big.z) >= 3.5 && !problems.length) {
  const dir = big.move > 0 ? 1 : -1, votes = {};
  for (const k of AGS) {
    const r = R[k], c = r.ctx;
    if (r.pending && r.pending.sigT >= GO_LIVE) votes[k] = { vote: r.pending.side === 1 ? 'largo' : 'corto', why: 'Mi sistema da entrada ' + SIDE(r.pending.side) + ' ahora.' };
    else if (r.open) votes[k] = { vote: 'mantener', why: 'Tengo ' + SIDE(r.open.side) + ' con stop en ' + fmt(r.open.stop) + '; el stop decide, no el susto.' };
    else if (k === 'vega') votes[k] = { vote: 'nada', why: c.on ? 'Tendencia diaria alcista, pero la entrada fue en el giro: no persigo.' : 'Sin tendencia diaria: no hay nada que comprar.' };
    else if (k === 'ortega') votes[k] = { vote: 'nada', why: 'Solo opero el cierre de 4 h fuera del rango de 5 días (' + fmt(c.low) + '–' + fmt(c.level) + ') a favor de la SMA50; próxima vela a las ' + hm(c.nextDecision) + '.' };
    else if (k === 'paz') votes[k] = { vote: 'nada', why: (c.regime === dir ? 'El movimiento va a favor de la SMA50: no es un retroceso, no entro.' : 'Es un retroceso contra la SMA50: espero a que el precio recupere la EMA50 de 1 h (' + fmt(c.ema) + ').') };
    else votes[k] = { vote: 'nada', why: 'La ruptura sin compresión previa (percentil ' + Math.round(c.rank * 100) + ') no es mi patrón.' };
  }
  const entries = AGS.filter(k => votes[k].vote === 'largo' || votes[k].vote === 'corto');
  const sides = [...new Set(entries.map(k => votes[k].vote))];
  const verdict = sides.length === 1 ? (sides[0] === 'largo' ? 'ENTRAR LARGO' : 'ENTRAR CORTO') : 'NO HACER NADA';
  const verdictText = sides.length === 1 ? 'Entrar ' + sides[0].toUpperCase() + ' solo con la señal de ' + entries.map(k => NAMES[k].split(' ·')[0]).join(' y ') + ' y su stop, con el riesgo de siempre.'
    : (sides.length > 1 ? 'Señales en sentidos opuestos: no se abre nada nuevo. ' : '') + 'Ningún sistema da entrada. Perseguir el movimiento o darle la vuelta perdió en 66 de 72 variantes en 2022–26. Los stops siguen en el exchange; no se toca nada a mano.';
  const id = 'emerg-' + tag(now);
  const recent = [...known].some(x => x.startsWith('emerg-') && (now - Date.UTC(+x.slice(6, 10), +x.slice(10, 12) - 1, +x.slice(12, 14), +x.slice(14, 16)) / 1000) < 3 * 3600);
  emergency = { id, at: new Date(now * 1000).toISOString(), move: +big.move.toFixed(4), hours: big.h, z: +big.z.toFixed(1), dir: dir === 1 ? 'sube' : 'cae', votes, verdict, verdictText };
  if (!known.has(id) && !recent && office) {
    events.push({ id, agent: 'calvo', type: 'emergencia', at: emergency.at, real: true, text: 'Sala de emergencias: BTC ' + pct(big.move) + ' en ' + big.h + ' h. ' + verdict + '.' });
    emails.push({ subject: '🚨 Mesa Radar · Sala de emergencias · BTC ' + pct(big.move) + ' en ' + big.h + ' h · ' + verdict, body: 'Movimiento brusco: BTC ' + (dir === 1 ? 'sube' : 'cae') + ' un ' + pct(Math.abs(big.move)).slice(1) + ' en ' + big.h + ' h (' + Math.abs(big.z).toFixed(1).replace('.', ',') + ' desviaciones). Precio ≈ ' + fmt(lastPx) + '.\n\nLa mesa se ha reunido:\n' + AGS.map(k => '· ' + NAMES[k] + ': ' + votes[k].vote.toUpperCase() + ' — ' + votes[k].why).join('\n') + '\n\nVeredicto de Calvo: ' + verdict + '. ' + verdictText + calWarn() + '\n\n' + URL_ });
  }
}

// 5) notas de cada agente
const pos = k => { if (TEST && k === 'ortega' && !(R[k] && R[k].open)) return testPos; const o = R[k] && R[k].open; if (!o) return null; return { side: o.side === 1 ? 'long' : 'short', entry: +o.entry.toFixed(1), stop: +o.stop.toFixed(1), since: new Date(o.entryT * 1000).toISOString(), rNow: +o.rNow.toFixed(2), live: o.sigT >= GO_LIVE }; };
const st = (k, txt, level) => ({ text: txt, level, pos: pos(k) });
const V = R.vega.ctx, O = R.ortega.ctx, Pz = R.paz.ctx, Ri = R.rios.ctx;
const posTxt = k => { const p = pos(k); return p ? ' ' + (p.side === 'long' ? 'LARGO' : 'CORTO') + ' desde ' + fmt(p.entry) + ', stop ' + fmt(p.stop) + ', va ' + sR(p.rNow) + (p.live ? '.' : ' (abierta antes de empezar en vivo: no la copies a mitad).') : ''; };
const evOf = k => events.filter(e => e.agent === k).map(e => e.text).join(' · ');
const confTxt = s => confNow(s) ? 'Confluencia a favor (' + confWho(s) + '): puedo entrar.' : 'Solo entro con confluencia (tendencia diaria o ruptura de 5 días a favor); ahora no.';
const RL = E.PICK.paz.rsiLo;
const regTxt = g => g === 1 ? 'alcista' : g === -1 ? 'bajista' : 'plana';
const notes = {
  vega: st('vega', (evOf('vega') ? evOf('vega') + '. ' : '') + 'Cierre diario ' + fmt(V.close) + ' frente a SMA' + V.n + ' ' + fmt(V.sma) + ' (' + pct(V.close / V.sma - 1) + '), momentum ' + V.n + ' d ' + pct(V.mom) + ': ' + (V.state === 1 ? 'TENDENCIA ALCISTA.' : V.state === -1 ? 'TENDENCIA BAJISTA.' : 'sin tendencia clara, fuera.') + (R.vega.open ? posTxt('vega') : V.state ? ' Entro en el próximo giro de tendencia.' : ' Compro con cierre sobre ' + fmt(V.sma) + ' y momentum positivo; vendo con cierre bajo ella y momentum negativo.'), evOf('vega') ? 'trade' : V.state ? 'idea' : 'ok'),
  ortega: st('ortega', (evOf('ortega') ? evOf('ortega') + '. ' : '') + 'Rango de ' + O.N + ' días ' + fmt(O.low) + '–' + fmt(O.level) + ', SMA50 ' + regTxt(O.regime) + '. ' + (R.ortega.open ? posTxt('ortega') : O.regime === 1 ? 'Compro si una vela de 4 h cierra sobre ' + fmt(O.level) + ' (' + pct(O.level / lastPx - 1) + '); próxima a las ' + hm(O.nextDecision) + '.' : O.regime === -1 ? 'Vendo si una vela de 4 h cierra bajo ' + fmt(O.low) + ' (' + pct(O.low / lastPx - 1) + '); próxima a las ' + hm(O.nextDecision) + '.' : 'Sin tendencia de fondo, quieto.'), evOf('ortega') ? 'trade' : Math.min(Math.abs(O.level / lastPx - 1), Math.abs(O.low / lastPx - 1)) < 0.01 ? 'idea' : 'ok'),
  paz: st('paz', (evOf('paz') ? evOf('paz') + '. ' : '') + 'SMA50 diaria ' + regTxt(Pz.regime) + ', RSI 1 h ' + Pz.rsi.toFixed(0) + ' (mín. 6 h ' + Pz.rsiMin.toFixed(0) + ', máx. ' + Pz.rsiMax.toFixed(0) + '), EMA50 1 h ' + fmt(Pz.ema) + '. ' + (R.paz.open ? posTxt('paz') : Pz.regime === 1 ? (Pz.rsiMin < RL ? 'Hay retroceso: compro si una vela cierra sobre ' + fmt(Pz.ema) + '.' : 'Espero un retroceso (RSI < ' + RL + ') para comprar.') + ' ' + confTxt(1) : Pz.regime === -1 ? (Pz.rsiMax > 100 - RL ? 'Hay rebote: vendo si una vela cierra bajo ' + fmt(Pz.ema) + '.' : 'Espero un rebote (RSI > ' + (100 - RL) + ') para vender.') + ' ' + confTxt(-1) : 'Sin tendencia de fondo.'), evOf('paz') ? 'trade' : (Pz.regime === 1 && Pz.rsiMin < RL) || (Pz.regime === -1 && Pz.rsiMax > 100 - RL) ? 'idea' : 'ok'),
  rios: st('rios', (evOf('rios') ? evOf('rios') + '. ' : '') + 'Bollinger 1 h en el percentil ' + Math.round(Ri.rank * 100) + ' de 30 días (busco ≤ 20), volumen ' + Ri.vol.toFixed(1).replace('.', ',') + '× su media, SMA50 ' + regTxt(Ri.regime) + '. ' + (R.rios.open ? posTxt('rios') : Ri.rank <= 0.2 ? 'Mercado comprimido: vigilo ' + (Ri.regime === 1 ? 'la ruptura de ' + fmt(Ri.upper) : 'la caída bajo ' + fmt(Ri.lower)) + ' con volumen.' : 'Sin compresión todavía.'), evOf('rios') ? 'trade' : Ri.rank <= 0.2 ? 'idea' : 'ok'),
};
// Calvo: riesgo, datos, calendario y marcador en vivo
const score = {}; let nAll = 0, wAll = 0, sumW = 0, sumR = 0;
for (const k of AGS) { const T = R[k].trades.filter(t => t.sigT >= GO_LIVE); const w = T.filter(t => t.r > 0).length, s = T.reduce((p, t) => p + t.r, 0); score[k] = { n: T.length, win: w, sumR: +s.toFixed(2) }; nAll += T.length; wAll += w; sumR += s; sumW += s * W[k]; }
const weeks = Math.max(1, (now - GO_LIVE) / 604800);
score.mesa = { n: nAll, win: wAll, sumR: +sumR.toFixed(2), sumW: +sumW.toFixed(2), perWeek: +(nAll / weeks).toFixed(2), since: new Date(GO_LIVE * 1000).toISOString() };
const openRisk = AGS.filter(k => R[k].open && R[k].open.sigT >= GO_LIVE).reduce((p, k) => p + RISK[k], 0);
const soon = calSoon();
notes.calvo = st('calvo', (emergency ? 'SALA DE EMERGENCIAS: BTC ' + pct(emergency.move) + ' en ' + emergency.hours + ' h. Veredicto: ' + emergency.verdict + '. ' : '') + (cal && cal.events && cal.events.length ? 'Hoy: ' + cal.events.map(e => e.hora + ' ' + e.evento).join(' · ') + '.' + (soon.length ? ' Dato macro en menos de 90 min.' : '') : cal ? 'Sin datos macro de impacto alto hoy.' : 'Calendario de hoy sin leer.') + ' Riesgo abierto ' + String(openRisk).replace('.', ',') + '%. En vivo: ' + (nAll ? nAll + ' cerradas, ' + Math.round(wAll / nAll * 100) + '% ganadoras, ' + sR(sumR / nAll) + ' por operación (ref. +0,35R, 41% ganadoras).' : 'aún ninguna cerrada.') + (problems.length ? ' Datos: ' + problems.join('; ') + '.' : ' Datos verificados (' + pairs.length + ' h de solape).') + (nAll >= 30 && sumR / nAll < -0.1 ? ' AVISO: la mesa se desvía del backtest.' : ''), emergency || problems.length || soon.length ? 'alerta' : 'ok');

// 6) salida
fs.mkdirSync(outDir, { recursive: true });
const id = 'tick-' + new Date(now * 1000).toISOString().slice(0, 16).replace(/[-:T]/g, '');
if (TEST) { notes.ortega.level = 'trade'; notes.ortega.text = 'PRUEBA (no es una señal real). ' + notes.ortega.text; }
const tick = { test: !!TEST, at: new Date(now * 1000).toISOString(), price: +lastPx.toFixed(1), office, notes, events: events.map(e => e.id), dataOk: !problems.length, lastBar: new Date((lastT + 3600) * 1000).toISOString(), emergency, score, move: win.map(w => ({ h: w.h, move: +w.move.toFixed(4), z: +w.z.toFixed(2) })) };
fs.writeFileSync(path.join(outDir, id + '.json'), JSON.stringify(tick));
const writes = [{ op: 'set', collection: 'ticks', doc_id: id, data: tick }];
for (const e of events) { fs.writeFileSync(path.join(outDir, e.id + '.json'), JSON.stringify(e)); writes.push({ op: 'set', collection: 'signals', doc_id: e.id, data: e }); }
console.log('WRITES ' + JSON.stringify(writes));
for (const m of emails) console.log('EMAIL_JSON ' + JSON.stringify(m));
const NM = Object.assign({ calvo: 'Calvo · sala de emergencias' }, NAMES);
console.log('RESUMEN ' + (events.length ? events.map(e => NM[e.agent] + ': ' + e.text).join(' | ') : 'Ronda sin novedades') + ' · BTC ' + fmt(lastPx) + (problems.length ? ' · DATOS: ' + problems.join('; ') : ''));

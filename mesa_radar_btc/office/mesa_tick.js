// Mesa Radar · ronda de la oficina (cada 15 min, 7:00-20:00 Madrid). Todos los agentes leen los datos a la vez.
// Vega, Ortega, Paz y Ríos operan BTC (largos y cortos según la SMA50 diaria); Calvo vigila riesgo, datos y calendario y preside la sala de emergencias.
// Uso: node mesa_tick.js <bitstamp_1min.csv> <live.json> <dir_db> <dir_salida> [ids,de,signals,ya,registradas]
//   dir_db/cal.json: calendario de hoy (opcional)
//   live.json: respuesta de OpenMarket `points` (BINANCE_FUTURES BTCUSDT, HOUR, 167h)
//   dir_db: carpeta donde ArtifactData guardó `signals` (últimas 72 h) y `calendar` (hoy) con out_dir
// Escribe en dir_salida los documentos y pinta: WRITES <json para ArtifactData batch>, EMAIL_JSON <...>, RESUMEN <...>
const fs = require('fs'), path = require('path');
const E = require(path.join(__dirname, 'engine.js'));
const [, , minPath, livePath, dbDir, outDir, knownArg, fundPath] = process.argv;
const now = Math.floor((+process.env.MESA_NOW || Date.now()) / 1000);
const GO_LIVE = +process.env.MESA_GO_LIVE || Date.UTC(2026, 9, 9, 16, 0) / 1000;   // 9 oct 2026, 18:00 Madrid (mesa de 4 agentes, largos y cortos)
const URL_ = 'https://claude.ai/artifact/MxNVeAAFhmbBYRg4qi6LJy';
const fmt = x => Math.round(x).toLocaleString('es-ES'), pct = x => (x >= 0 ? '+' : '−') + Math.abs(x * 100).toFixed(1).replace('.', ',') + '%', sR = x => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(2).replace('.', ',') + 'R';
const madrid = s => new Date(s * 1000).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const hm = s => new Date(s * 1000).toLocaleTimeString('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' });
const problems = [], warns = [];

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
const AGS = ['vega', 'ortega', 'paz', 'rios', 'ferrer'];
const R = {}; R.vega = E.vega(X, office); R.ortega = E.ortega(X, office);
const SH = { vega: E.vega(X, false, E.SHADOW.vega), ortega: E.ortega(X, false, E.SHADOW.ortega) };   // sombras de la confluencia
const CONF = E.confluence(SH.vega, SH.ortega), NUB = E.nubarrones(X), nubF = (ts, sd) => !NUB.veto(ts, sd);
const filtFor = k => E.combine(E.PICK[k].conf ? CONF : null, E.PICK[k].nub ? nubF : null);
R.paz = E.paz(X, office, filtFor('paz')); R.rios = E.rios(X, office, filtFor('rios'));
// funding (OpenMarket FUNDING_RATE_AGG, HOUR, en % por 8 h): la liquidación es la lectura que cierra a las 00, 08 y 16 UTC
let FUND = [];
try { const FJ = JSON.parse(fs.readFileSync(fundPath, 'utf8')), fs_ = (FJ.data && FJ.data.series && FJ.data.series[0]) || (FJ.series && FJ.series[0]) || FJ, fc = fs_.columns || [], ti = fc.indexOf('t'), ri = fc.indexOf('rateClose');
  for (const r of fs_.rows || []) { const t0 = typeof r[ti] === 'number' ? (r[ti] > 1e12 ? r[ti] / 1000 : r[ti]) : Date.parse(r[ti]) / 1000, ts = t0 + 3600; if (ts % 28800 === 0 && ts <= now && Number.isFinite(+r[ri])) FUND.push([ts, +r[ri] / 100]); }
  FUND.sort((a, b) => a[0] - b[0]);
} catch (e) { }
// v10: Ferrer está en sombra, así que la falta de funding avisa pero no bloquea entradas (solo afecta a su lectura y al marcador)
if (FUND.length < 9) warns.push('funding insuficiente (' + FUND.length + ' liquidaciones)');
R.ferrer = E.ferrer(X, office, FUND);
const confWho = s => SH.vega.open && SH.vega.open.side === s ? 'la tendencia diaria' : SH.ortega.open && SH.ortega.open.side === s ? 'la ruptura de 5 días' : null;
const confNow = s => !!confWho(s);
const NAMES = { vega: 'Vega · tendencia diaria', ortega: 'Ortega · ruptura de 5 días', paz: 'Paz · retroceso a favor', rios: 'Ríos · compresión y volumen', ferrer: 'Ferrer · squeeze de funding' };
const PM = E.PM, W = PM.base, R1 = 0.5;   // 1R = 0,5% del capital
const MAXH = { paz: 96, rios: 240, ferrer: 240, ortega: 2880 };
// Salinas: estado de la cartera en vivo (R ponderado de las operaciones cerradas desde el arranque) y riesgo abierto
// v10 (auditoría 11 oct 2026): agentes en sombra (peso 0): su señal se registra en el tick, no se envía ni se opera
const V10 = +process.env.MESA_V10 || Date.UTC(2026, 9, 11, 18, 0) / 1000;   // desde aquí rigen la sombra, las paradas y el funding en el marcador
const REANUDAR = +process.env.MESA_REANUDAR || 0;  // tras una parada por −10R, solo una revisión humana la levanta: se fija aquí la fecha de reanudación
const W9 = { vega: 1, ortega: 1, paz: 0.75, rios: 0.75, ferrer: 0.5 };   // pesos de la v9, para lo abierto antes de la v10
const W10 = { vega: 0.75, ortega: 1, paz: 0.5, rios: 0, ferrer: 0 };     // pesos de la v10, para lo abierto antes de la v11
const V11 = +process.env.MESA_V12 || Date.UTC(2026, 9, 12, 4, 0) / 1000;   // v12: desde aquí operan los aprendices del Radar
const wAt = (k, sigT) => sigT < V10 ? W9[k] : sigT < V11 ? W10[k] : W[k];
const LIVE_AG = AGS.filter(k => W[k] > 0), SOMBRA = AGS.filter(k => !(W[k] > 0));
// una operación propia solo cuenta (y solo se avisa de su gestión y salida) si su entrada se avisó de verdad: una señal que cae fuera de las rondas
// (p. ej. en fin de semana) no se ejecutó. v12.1 (13 oct): `known` trae TODAS las señales desde el arranque (la rutina ya no usa una ventana de 72 h), así que no hay
// excepción por antigüedad: lo que no consta, no cuenta. El marcador anota lo que pasó; no lo deduce.
const inLive = (k, sigT, t) => sigT >= GO_LIVE && wAt(k, sigT) > 0 && !(t && !known.has(k + '-in-' + new Date(sigT * 1000).toISOString().slice(0, 13).replace(/[-T]/g, '')));
// funding de los perpetuos pagado o cobrado durante la operación, en R (largo paga funding positivo)
const fundR = tr => { if (!FUND.length || !(tr.risk > 0)) return 0; let s = 0; for (const [ts, r] of FUND) if (ts > (tr.entryT || tr.sigT) && ts <= (tr.exitT || now)) s += r; return -tr.side * s * tr.entry / tr.risk; };
const netR = tr => tr.r + (tr.sigT >= V10 ? fundR(tr) : 0);
// ---- aprendices del Radar (v12): la experiencia del Radar BTC 15m, aplicada a oportunidades que el Radar NO toma ----
// El Radar solo lleva una operación a la vez: mientras está dentro, su propio modelo sigue viendo señales que él ignora. La oficina corre el
// motor del Radar por dentro (sin reenviar sus señales) y toma esas otras oportunidades si van a favor de la posición del Radar y el Radar
// aún no ha recorrido +0,8R (2018-21: +0,12R; 2022-26: +0,27R por operación). Rupturas → Vega, reversiones → Paz, barridos → Ríos; 1R, L-V 7-21.
const RADAR_PATH = process.argv[8], RW = 1.0, radarProblems = [];
const RAD_AG = { bo: 'vega', mr: 'paz', swp: 'rios' }, RAD_TXT = { bo: 'ruptura de 15 min', mr: 'reversión de 15 min', swp: 'barrido de liquidez de 15 min' };
let RD = null;
if (RADAR_PATH) { try { RD = require(path.join(__dirname, 'radar_desk.js')).run(minPath, RADAR_PATH, now); radarProblems.push(...RD.problems); } catch (e) { radarProblems.push('aprendices del Radar sin datos (' + e.message + ')'); } }
else radarProblems.push('la ronda no trae velas de 15 min');
const radarHours = T => E.madridWork(T - 1);   // la vela de señal cierra dentro del horario de oficina (L-V 7-21)
const radarNet = tr => tr.r - (E.FEE - RD_FEE) * tr.entry / tr.risk - (tr.reason === 'stop' ? 0.0003 * tr.entry / tr.risk : 0) + fundR(tr);
const RD_FEE = 0.0008;   // comisión con la que el motor del Radar calcula su R
const isApprentice = tr => tr.extra && tr.side === tr.radarSide && tr.ru < 0.8;
const radarAll = RD ? RD.R.trades.filter(tr => tr.sigT >= Math.max(V11, GO_LIVE) && isApprentice(tr) && radarHours(tr.sigT)) : [];
const known = new Set(String(knownArg || '').split(/[\s,]+/).filter(Boolean)); const sd = path.join(dbDir, 'signals'); if (fs.existsSync(sd)) for (const f of fs.readdirSync(sd)) known.add(f.replace(/\.json$/, ''));
if (known.size >= 900) warns.push('la lista de señales conocidas se acerca al límite de la consulta (' + known.size + ')');
const tag15 = s => new Date(s * 1000).toISOString().slice(0, 16).replace(/[-:T]/g, '');
// qué oportunidades de los aprendices entraron de verdad: lo que dice la base de datos manda; si no consta (más de 72 h), se repite la regla
// de Salinas (tope de 2R con las posiciones propias abiertas). Las que se deciden en esta ronda las resuelve el bucle de entradas.
const ownPos = AGS.flatMap(k => [...R[k].trades, ...(R[k].open ? [R[k].open] : [])].filter(t => inLive(k, t.sigT, t)).map(t => [t.entryT, t.exitT || Infinity, wAt(k, t.sigT)]));
const radarSeen = tr => { const k = RAD_AG[tr.kind || 'bo'], tg = tag15(tr.sigT); return [...known].some(id => id.startsWith('radar-' + k + '-') && id.endsWith('-' + tg) && !id.includes('-out-')); };
// v12.2 (13 oct): ventana de aviso de 35 min (antes 20). Las rondas llegan 2-5,6 min tarde cada 15 min, así que con 20 min cada señal tenía en la práctica un solo intento
// (la 2.ª ronda cae hacia el minuto 18-21). Con 35 min hay dos intentos seguros. Entrar 35 min tarde sigue siendo rentable en el backtest (research/v13_delay.py).
const RADAR_WINDOW = 35 * 60;
const radarDecideNow = tr => tr.sigT >= now - RADAR_WINDOW && !radarSeen(tr);
const radarLive = [], radarMissed = [];
for (const tr of radarAll) {
  if (radarDecideNow(tr)) continue;
  const k = RAD_AG[tr.kind || 'bo'], tg = tag15(tr.sigT);
  if (known.has('radar-' + k + '-in-' + tg)) { tr.w = RW; radarLive.push(tr); continue; }
  if ([...known].some(id => id.startsWith('radar-' + k + '-') && id.endsWith('-' + tg))) continue;   // bloqueada o perdida en su día
  // v12.1 (13 oct): antes se repetía aquí la regla del tope de 2R y la oportunidad contaba como operada aunque nadie la hubiera avisado (ronda perdida o
  // retrasada más de 20 min: el corto de Vega del 12 oct). Ahora una oportunidad que ninguna ronda avisó no entró: se anota como perdida y no se cuenta.
  radarMissed.push(tr);
}
const radarClosed = radarLive.filter(tr => tr.r != null), radarOpen = radarLive.filter(tr => tr.r == null && !tr.pending);
const liveClosed = AGS.flatMap(k => R[k].trades.filter(t => inLive(k, t.sigT, t)).map(t => [t.exitT, netR(t) * wAt(k, t.sigT)])).concat(radarClosed.map(t => [t.exitT, radarNet(t) * t.w])).sort((a, b) => a[0] - b[0]);
let eqR = 0, pkR = 0; for (const [, r] of liveClosed) { eqR += r; pkR = Math.max(pkR, eqR); }
// valor de las posiciones abiertas (R ponderado): Salinas y las paradas miran la cartera con lo abierto, no solo lo cerrado
const openMTM = AGS.filter(k => R[k].open && inLive(k, R[k].open.sigT, R[k].open)).reduce((p, k) => p + wAt(k, R[k].open.sigT) * R[k].open.rNow, 0) + radarOpen.reduce((p, t) => p + t.w * (lastPx - t.entry) * t.side / t.risk, 0);
const ddR = Math.max(pkR, eqR + openMTM) - (eqR + openMTM);
let openR = AGS.filter(k => R[k].open && inLive(k, R[k].open.sigT, R[k].open)).reduce((p, k) => p + wAt(k, R[k].open.sigT), 0) + radarOpen.reduce((p, t) => p + t.w, 0);
// paradas por rendimiento (validadas en el walk-forward: neutras en R, protegen ante un cambio de régimen en vivo)
let pauseUntil = 0, haltAt = 0; { let e = 0, pk = 0; const done = [];
  for (const [t1, r] of liveClosed) { e += r; pk = Math.max(pk, e); done.push([t1, r]); if (t1 < V10) continue;
    const w7 = done.filter(([t]) => t > t1 - 7 * 86400).reduce((p, [, v]) => p + v, 0);
    if (w7 <= -3 && pauseUntil < t1) pauseUntil = t1 + 7 * 86400;
    if (pk - e >= 10 && !haltAt) haltAt = t1; } }
const w7now = liveClosed.filter(([t]) => t > now - 7 * 86400).reduce((p, [, v]) => p + v, 0) + openMTM;
if (w7now <= -3 && pauseUntil < now) pauseUntil = now + 900;
if (ddR >= 10 && !haltAt) haltAt = now;
const halted = haltAt && !(REANUDAR > haltAt), paused = pauseUntil > now;
const decisions = [];
const sizeFor = k => { let w = W[k] * (ddR > PM.ddR ? PM.ddCut : 1); const room = PM.cap - openR; if (w > room) w = room; return w >= PM.minW ? +w.toFixed(2) : 0; };
const RISK = {}; for (const k of AGS) RISK[k] = R1 * W[k];
// Duarte: modelo de calidad (aprende de cada operación cerrada; veta solo si el filtro se ha ganado la activación)
let DU = null;
try { const ML = require(path.join(__dirname, 'ml.js')), MH = JSON.parse(fs.readFileSync(path.join(__dirname, 'ml_hist.json'), 'utf8'));
  const pend = AGS.filter(k => R[k].pending && R[k].pending.sigT >= GO_LIVE).map(k => ({ agent: k, sigT: R[k].pending.sigT, side: R[k].pending.side }));
  DU = ML.run(MH, H, FUND, R, pend); delete DU.M; delete DU.features; delete DU.fit; } catch (e) { DU = null; }
const duTxt = k => { const q = DU && DU.scores[k]; return q ? '\nCalidad (Duarte): percentil ' + Math.round(q.q * 100) + ' de su histórico, probabilidad de acierto ' + Math.round(q.p * 100) + '%' + ' (informativo: Duarte no veta)' + '.' : ''; };
const SIDE = s => s === 1 ? 'LARGO' : 'CORTO', VERB = s => s === 1 ? 'Compra' : 'Vende';
let cal = null; const cd = path.join(dbDir, 'calendar'), readCal = f => { try { const d = JSON.parse(fs.readFileSync(f, 'utf8')); cal = d.data || d; } catch (e) {} };
if (fs.existsSync(cd)) for (const f of fs.readdirSync(cd)) readCal(path.join(cd, f));
if (fs.existsSync(path.join(dbDir, 'cal.json'))) readCal(path.join(dbDir, 'cal.json'));
const events = [], emails = [];
for (const tr of radarMissed) {   // quedan anotadas para que el silencio no sea ambiguo: ni correo ni marcador
  const k = RAD_AG[tr.kind || 'bo'], bid = 'radar-' + k + '-lost-' + tag15(tr.sigT);
  if (!known.has(bid)) events.push({ id: bid, agent: 'calvo', type: 'bloqueo', at: new Date(now * 1000).toISOString(), real: true, text: 'Señal perdida: la oportunidad del aprendiz ' + k[0].toUpperCase() + k.slice(1) + ' (' + RAD_TXT[tr.kind || 'bo'] + ', ' + (tr.side === 1 ? 'largo' : 'corto') + ', vela de las ' + hm(tr.sigT) + ') no se avisó: ninguna ronda la vio dentro de los 20 min de su vela. No se cuenta ni se avisa.' });
}
const crowdNow = s => { const f = R.ferrer && R.ferrer.ctx && R.ferrer.ctx.f3; return f == null || isNaN(f) ? 'sin datos' : f * s > 0.0001 ? 'la multitud ya está cargada en este lado' : f * s < -0.0001 ? 'la multitud está atrapada en contra' : 'funding neutro'; };
const tag = s => new Date(s * 1000).toISOString().slice(0, 13).replace(/[-T]/g, '');
const sizeLine = (k, risk, w = W[k]) => { const pc = +(R1 * w).toFixed(3); return 'Tamaño (Salinas): ' + String(pc).replace('.', ',') + '% de riesgo' + (w < W[k] ? ' (rebajado: ' + (ddR > PM.ddR ? 'la cartera cae ' + ddR.toFixed(1).replace('.', ',') + 'R desde su máximo' : 'tope de riesgo abierto de ' + String(PM.cap).replace('.', ',') + 'R') + ')' : '') + ' → (capital × ' + (pc / 100) + ') / ' + fmt(risk) + ' BTC.'; };
const calSoon = () => { if (!cal || !cal.events) return []; const loc = new Date(new Date(now * 1000).toLocaleString('en-US', { timeZone: 'Europe/Madrid' })); return cal.events.filter(e => { const [H_, M_] = String(e.hora || '').split(':').map(Number); if (!Number.isFinite(H_)) return false; const diff = (H_ * 60 + (M_ || 0)) - (loc.getHours() * 60 + loc.getMinutes()); return diff >= -15 && diff <= 90; }); };
const calWarn = () => { const s = calSoon(); return s.length ? '\n⚠ Calvo: ' + s.map(e => e.hora + ' ' + e.evento).join(' · ') + ' (dato macro cerca: la entrada puede saltar).' : ''; };
const REF = 'Mesa v12: los agentes aprenden del Radar BTC 15m y buscan oportunidades que el Radar no toma (su modelo las ve mientras él ya está dentro). Operan Ortega (1R) y Paz (0,5R) con sus estrategias y los aprendices del Radar (1R); la tendencia propia de Vega queda en sombra. En 2022-26, fuera de muestra, con costes y funding: 45% de acierto, +0,16R de cartera por operación, +19R al año y Sharpe 0,77, frente a 43%, +0,14R, +14R y 0,59 de la v10. Es un backtest: el resultado real se mide en el registro.';
const G = E.GEST;
const plan = (k, s, e, dist) => { const g = G[k] || {}, L = []; if (g.tp) L.push('Pon también una orden límite para cerrar el ' + Math.round(g.f * 100) + '% en ' + fmt(e + s * g.tp * dist) + ' (+' + String(g.tp).replace('.', ',') + 'R).'); if (g.be) L.push('Cuando el precio llegue a ' + fmt(e + s * g.be * dist) + ' (+' + String(g.be).replace('.', ',') + 'R) te avisaré de mover el stop a ' + fmt(e + s * g.beoff * dist) + ' (+' + String(g.beoff).replace('.', ',') + 'R): a partir de ahí la operación ya no puede perder.'); return L.length ? L.join('\n') + '\n' : ''; };
for (const k of AGS) {
  const r = R[k];
  if (r.pending && r.pending.sigT >= GO_LIVE && !(W[k] > 0)) { const q = DU && DU.scores[k]; decisions.push({ agent: k, sigT: r.pending.sigT, side: r.pending.side, price: +lastPx.toFixed(1), status: 'sombra', q: q ? q.q : null, p: q ? q.p : null }); }
  else if (r.pending && r.pending.sigT >= GO_LIVE) {
    const p = r.pending, s = p.side, id = k + '-in-' + tag(p.sigT), e = lastPx, stop = e - s * p.dist, w = sizeFor(k), q0 = DU && DU.scores[k];
    const stopWhy = problems.length ? 'operativa' : halted ? 'maximo' : paused ? 'semana' : null;
    decisions.push({ agent: k, sigT: p.sigT, side: s, price: +e.toFixed(1), status: known.has(id) ? 'enviada' : stopWhy ? 'parada_' + stopWhy : !w ? 'bloqueada_salinas' : 'enviada', w, q: q0 ? q0.q : null, p: q0 ? q0.p : null });
    if (!known.has(id) && stopWhy) { const bid = k + '-stop' + stopWhy + '-' + tag(p.sigT); if (!known.has(bid)) events.push({ id: bid, agent: stopWhy === 'operativa' ? 'calvo' : 'salinas', type: 'bloqueo', at: new Date(now * 1000).toISOString(), real: true,
      text: stopWhy === 'operativa' ? 'Parada operativa: no entra ' + NAMES[k].split(' ·')[0] + ' porque los datos no están bien (' + problems.join('; ') + ').' : stopWhy === 'maximo' ? 'Parada por −10R desde el máximo: no entra ' + NAMES[k].split(' ·')[0] + '. Nada nuevo hasta una revisión independiente.' : 'Parada semanal (−3R en 7 días, con lo abierto): no entra ' + NAMES[k].split(' ·')[0] + ' hasta ' + madrid(pauseUntil) + '.' }); }
    else if (!known.has(id) && !w) { const bid = k + '-pm-' + tag(p.sigT); if (!known.has(bid)) events.push({ id: bid, agent: 'salinas', type: 'bloqueo', at: new Date(now * 1000).toISOString(), real: true, text: 'Salinas no deja entrar a ' + NAMES[k].split(' ·')[0] + ': riesgo abierto al tope (' + String(openR).replace('.', ',') + 'R de ' + PM.cap + ')' }); }
    else if (!known.has(id)) {
      openR += w;
      events.push({ id, agent: k, type: 'entrada', at: new Date(now * 1000).toISOString(), side: s === 1 ? 'long' : 'short', entry: +e.toFixed(1), stop: +stop.toFixed(1), real: true, text: 'Entrada ' + SIDE(s) + ' a mercado ≈ ' + fmt(e) + ', stop ' + fmt(stop) + ' (' + pct((stop - e) / e) + ')' });
      emails.push({ subject: (s === 1 ? '🟢' : '🔴') + ' Mesa Radar · ' + NAMES[k] + ' · ' + SIDE(s) + ' BTC ≈ ' + fmt(e) + ' · stop ' + fmt(stop), body: 'Nueva entrada de la Mesa (' + NAMES[k] + ').\n\n' + VERB(s) + ' BTC a mercado ahora (≈ ' + fmt(e) + ').\nStop inicial: ' + fmt(stop) + ' (' + pct((stop - e) / e) + '), colócalo en el exchange al entrar.\n' + (MAXH[k] && MAXH[k] < 1000 ? 'Sin objetivo fijo: stop móvil a favor y cierre como mucho a las ' + MAXH[k] + ' h.' : 'Sin objetivo fijo: el stop se mueve solo a favor.') + ' La Mesa te avisa cuando lo tengas que mover y cuando haya que cerrar.\n' + plan(k, s, e, p.dist) + (duTxt(k) ? duTxt(k).slice(1) + '\n' : '') + (k === 'paz' && confWho(s) ? 'Confluencia: ' + confWho(s) + ' está a favor.\n' : '') + (k === 'rios' ? 'Ferrer (funding): ' + crowdNow(s) + '.\n' : '') + sizeLine(k, p.dist, w) + calWarn() + '\n\n' + REF + ' Apunta la ejecución en Mesa Radar: ' + URL_ });
    }
  }
  if (r.open && inLive(k, r.open.sigT, r.open)) {
    const o = r.open, s = o.side, step = Math.floor((o.stop - o.stop0) * s / o.risk);
    if (o.part > 0) { const id = k + '-tp-' + tag(o.sigT); if (!known.has(id)) { events.push({ id, agent: k, type: 'parcial', at: new Date(now * 1000).toISOString(), real: true, text: 'Parcial: cerrado el ' + Math.round(o.part * 100) + '% en ' + fmt(o.tp) + ' (+' + String(G[k].tp).replace('.', ',') + 'R)' }); emails.push({ subject: '💰 Mesa Radar · ' + NAMES[k] + ' · parcial cobrado en ' + fmt(o.tp), body: 'La orden límite del ' + Math.round(o.part * 100) + '% se ha ejecutado en ' + fmt(o.tp) + ' (+' + String(G[k].tp).replace('.', ',') + 'R). El resto sigue con su stop en ' + fmt(o.stop) + '.\n\n' + URL_ }); } }
    if (step >= 1 && office) { const id = k + '-stop-' + tag(o.sigT) + '-' + step; if (!known.has(id)) { events.push({ id, agent: k, type: 'stop', at: new Date(now * 1000).toISOString(), stop: +o.stop.toFixed(1), real: true, text: (s === 1 ? 'Sube' : 'Baja') + ' el stop a ' + fmt(o.stop) + ' (asegura ' + sR((o.stop - o.entry) * s / o.risk) + ' antes de costes)' }); emails.push({ subject: (s === 1 ? '⬆' : '⬇') + ' Mesa Radar · ' + NAMES[k] + ' · ' + (s === 1 ? 'sube' : 'baja') + ' el stop a ' + fmt(o.stop), body: 'Posición ' + SIDE(s) + ' BTC desde ' + fmt(o.entry) + '.\nMueve el stop a ' + fmt(o.stop) + ' (asegura ' + sR((o.stop - o.entry) * s / o.risk) + ' antes de costes). Precio ahora ≈ ' + fmt(lastPx) + '.\n\n' + URL_ }); } }
    if (o.exitDue && office) { const id = k + '-out-' + tag(o.sigT); if (!known.has(id)) { const rr = ((lastPx - o.entry) * s - E.FEE * o.entry) / o.risk; events.push({ id, agent: k, type: 'salida', at: new Date(now * 1000).toISOString(), exit: +lastPx.toFixed(1), r: +rr.toFixed(2), real: true, text: 'Cierra a mercado ≈ ' + fmt(lastPx) + ': la tendencia diaria se ha perdido (' + sR(rr) + ')' }); emails.push({ subject: '⚪ Mesa Radar · ' + NAMES[k] + ' · CIERRA BTC ≈ ' + fmt(lastPx) + ' (' + sR(rr) + ')', body: 'La tendencia diaria se ha perdido: cierra la posición ' + SIDE(s) + ' a mercado (≈ ' + fmt(lastPx) + ') y quita el stop.\nResultado aproximado: ' + sR(rr) + '.\n\n' + URL_ }); } }
  }
  for (const tr of r.trades) if (inLive(k, tr.sigT, tr) && tr.exitT >= now - 72 * 3600) {
    const id = k + '-out-' + tag(tr.sigT), s = tr.side;
    if (known.has(id)) continue;
    const txt = tr.why === 'stop' ? 'Saltó el stop en ' + fmt(tr.exit) : tr.why === 'tiempo' ? 'Cierre por plazo (' + MAXH[k] + ' h) ≈ ' + fmt(tr.exit) : 'Cerrada en ' + fmt(tr.exit);
    events.push({ id, agent: k, type: 'salida', at: new Date(now * 1000).toISOString(), exit: +tr.exit.toFixed(1), r: +tr.r.toFixed(2), real: true, text: txt + ' (' + sR(tr.r) + ')' });
    emails.push(tr.why === 'senal' ? { subject: '⚪ Mesa Radar · ' + NAMES[k] + ' · CIERRA BTC (tendencia perdida)', body: 'La tendencia diaria se perdió: si sigues dentro, cierra la posición ' + SIDE(s) + ' desde ' + fmt(tr.entry) + ' a mercado y quita el stop. Resultado del sistema: ' + sR(tr.r) + '.\n\n' + URL_ }
      : tr.why === 'tiempo' ? { subject: '⚪ Mesa Radar · ' + NAMES[k] + ' · CIERRA BTC a mercado (plazo cumplido)', body: 'La posición ' + SIDE(s) + ' desde ' + fmt(tr.entry) + ' ha cumplido su plazo máximo de ' + MAXH[k] + ' h: ciérrala a mercado (≈ ' + fmt(lastPx) + ') y quita el stop. Resultado del sistema: ' + sR(tr.r) + '.\n\n' + URL_ }
      : { subject: '⚪ Mesa Radar · ' + NAMES[k] + ' · cerrada por stop ' + fmt(tr.exit) + ' (' + sR(tr.r) + ')', body: 'La posición ' + SIDE(s) + ' desde ' + fmt(tr.entry) + ' ha tocado el stop en ' + fmt(tr.exit) + '. Resultado ' + sR(tr.r) + ' con costes.\n\n' + URL_ });
  }
}

// 3a) mesa del Radar: avisos de entrada (cierre de 15 min más reciente) y de salida
const NAMES_R = { vega: 'Vega · aprendiz del Radar (ruptura 15m)', paz: 'Paz · aprendiz del Radar (reversión 15m)', rios: 'Ríos · aprendiz del Radar (barrido 15m)' };
const sizeRadar = () => { let w = RW * (ddR > PM.ddR ? PM.ddCut : 1); const room = PM.cap - openR; if (w > room) w = room; return w >= PM.minW ? +w.toFixed(2) : 0; };
if (RD) for (const tr of RD.R.trades) {
  if (tr.sigT < Math.max(V11, GO_LIVE) || !isApprentice(tr)) continue;
  const kind = tr.kind || 'bo', k = RAD_AG[kind], id = 'radar-' + k + '-in-' + tag15(tr.sigT), s = tr.side;
  if (radarDecideNow(tr)) {
    if (!radarHours(tr.sigT)) { decisions.push({ agent: k, desk: 'radar', sigT: tr.sigT, side: s, status: 'fuera_horario' }); continue; }
    const veto = false, stopWhy = (problems.length || radarProblems.length) ? 'operativa' : halted ? 'maximo' : paused ? 'semana' : null, w = veto || stopWhy ? 0 : sizeRadar();
    decisions.push({ agent: k, desk: 'radar', kind, sigT: tr.sigT, side: s, price: +lastPx.toFixed(1), status: stopWhy ? 'parada_' + stopWhy : !w ? 'bloqueada_salinas' : 'enviada', w, lateMin: Math.round((now - tr.sigT) / 60) });
    if (stopWhy) { const bid = 'radar-' + k + '-stop' + stopWhy + '-' + tag15(tr.sigT); if (!known.has(bid)) events.push({ id: bid, agent: stopWhy === 'operativa' ? 'calvo' : 'salinas', type: 'bloqueo', at: new Date(now * 1000).toISOString(), real: true, text: (stopWhy === 'operativa' ? 'Parada operativa: no entra la oportunidad del aprendiz ' + k[0].toUpperCase() + k.slice(1) + ' (' + problems.concat(radarProblems).join('; ') + ').' : stopWhy === 'maximo' ? 'Parada por −10R: no entra la oportunidad del aprendiz.' : 'Parada semanal: no entra la oportunidad del aprendiz hasta ' + madrid(pauseUntil) + '.') }); continue; }
    if (!w) { const bid = 'radar-' + k + '-pm-' + tag15(tr.sigT); if (!known.has(bid)) events.push({ id: bid, agent: 'salinas', type: 'bloqueo', at: new Date(now * 1000).toISOString(), real: true, text: 'Salinas no deja entrar la oportunidad del aprendiz ' + k[0].toUpperCase() + k.slice(1) + ': ya hay ' + String(+openR.toFixed(2)).replace('.', ',') + 'R de riesgo abierto (tope 2R).' }); continue; }
    openR += w;
    const e = tr.pending ? lastPx : tr.entry, risk = Math.abs(e - tr.sl0), pc = +(R1 * w).toFixed(3);
    const lateMin = Math.round((now - tr.sigT) / 60), lateR = tr.pending ? 0 : (lastPx - e) * s / risk;
    const lateTxt = lateMin >= 10 ? 'AVISO TARDÍO: la señal cerró hace ' + lateMin + ' min (la ronda anterior no la vio). El precio ahora es ≈ ' + fmt(lastPx) + ', ' + 'a ' + sR(lateR) + ' de la entrada de la señal (' + (lateR >= 0 ? 'a favor' : 'en contra') + '). El stop y el objetivo son los de la señal; entra solo si te sigue pareciendo bien.' : '';
    events.push({ id, agent: k, desk: 'radar', type: 'entrada', at: new Date(now * 1000).toISOString(), side: s === 1 ? 'long' : 'short', entry: +e.toFixed(1), stop: +tr.sl0.toFixed(1), target: +tr.tp.toFixed(1), real: true, text: 'Aprendiz del Radar · ' + RAD_TXT[kind] + ': entrada ' + SIDE(s) + ' ≈ ' + fmt(e) + ', stop ' + fmt(tr.sl0) + ', objetivo ' + fmt(tr.tp) + ' (1,65R), ' + String(pc).replace('.', ',') + '% de riesgo' + (lateTxt ? ' · ' + lateTxt : '') });
    emails.push({ subject: (s === 1 ? '🟢' : '🔴') + ' Mesa Radar · ' + NAMES_R[k] + ' · ' + SIDE(s) + ' BTC ≈ ' + fmt(e) + ' · stop ' + fmt(tr.sl0) + ' · objetivo ' + fmt(tr.tp),
      body: 'Nueva entrada de un aprendiz del Radar (' + NAMES_R[k] + '). Es una oportunidad que el Radar NO toma: su modelo la ve mientras él ya tiene una operación abierta en este mismo sentido. No es un aviso del Radar.\n\n' + VERB(s) + ' BTC a mercado ahora (≈ ' + fmt(e) + ').\nStop: ' + fmt(tr.sl0) + ' (' + pct((tr.sl0 - e) / e) + ').\nObjetivo: ' + fmt(tr.tp) + ' (' + pct((tr.tp - e) / e) + ', 1,65R).\nPon las dos órdenes en el exchange al entrar: no se mueven. Cierre por tiempo a las 72 h si no toca ninguna.\nTamaño (Salinas): ' + String(pc).replace('.', ',') + '% de riesgo.' + (lateTxt ? '\n\n' + lateTxt : '') + calWarn() + '\n\n' + REF + '\n' + URL_ });
  }
  if (tr.r != null && tr.exitT >= now - 72 * 3600 && known.has(id)) {
    const oid = 'radar-' + k + '-out-' + tag15(tr.sigT);
    if (!known.has(oid)) { const rn = radarNet(tr), why = { target: 'objetivo', stop: 'stop', tiempo: 'plazo de 72 h' }[tr.reason] || tr.reason;
      events.push({ id: oid, agent: k, desk: 'radar', type: 'salida', at: new Date(now * 1000).toISOString(), exit: +tr.exit.toFixed(1), r: +rn.toFixed(2), real: true, text: 'Aprendiz del Radar · cerrada por ' + why + ' en ' + fmt(tr.exit) + ' (' + sR(rn) + ')' });
      emails.push({ subject: '⚪ Mesa Radar · ' + NAMES_R[k] + ' · cerrada por ' + why + ' ' + fmt(tr.exit) + ' (' + sR(rn) + ')', body: 'La posición ' + SIDE(s) + ' del aprendiz del Radar desde ' + fmt(tr.entry) + ' se ha cerrado por ' + why + ' en ' + fmt(tr.exit) + '. Resultado ' + sR(rn) + ' con costes y funding.' + (tr.reason === 'tiempo' ? '\nCierra a mercado si sigue abierta.' : '\nSi pusiste el stop y el objetivo en el exchange, ya está cerrada.') + '\n' + URL_ }); }
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
    else if (k === 'rios') votes[k] = { vote: 'nada', why: 'La ruptura sin compresión previa (percentil ' + Math.round(c.rank * 100) + ') no es mi patrón.' };
    else votes[k] = { vote: 'nada', why: 'Funding medio de 3 días ' + (isNaN(c.f3) ? 'sin datos' : (c.f3 * 100).toFixed(4).replace('.', ',') + '%') + ': sin multitud atrapada no hay squeeze que operar.' };
  }
  votes.nubarrones = { vote: 'nada', why: NUB.phase === 'mature' ? (dir === -1 ? 'Bajista maduro: vender este desplome es vender abajo. Los rebotes barren cortos.' : 'Rebote de bajista maduro: no es un cambio de tendencia hasta recuperar la SMA200.') : NUB.phase === 'early' ? 'Giro bajista temprano: si algún sistema vende, es la mejor fase para cortos.' : NUB.phase === 'top' ? 'Posible techo: no compraría este movimiento.' : 'Fondo alcista: los sustos se compran solo con señal.' };
  const entries = LIVE_AG.filter(k => votes[k].vote === 'largo' || votes[k].vote === 'corto');
  const sides = [...new Set(entries.map(k => votes[k].vote))];
  const verdict = sides.length === 1 ? (sides[0] === 'largo' ? 'ENTRAR LARGO' : 'ENTRAR CORTO') : 'NO HACER NADA';
  const verdictText = sides.length === 1 ? 'Entrar ' + sides[0].toUpperCase() + ' solo con la señal de ' + entries.map(k => NAMES[k].split(' ·')[0]).join(' y ') + ' y su stop, con el riesgo de siempre.'
    : (sides.length > 1 ? 'Señales en sentidos opuestos: no se abre nada nuevo. ' : '') + 'Ningún sistema da entrada. Perseguir el movimiento o darle la vuelta perdió en 66 de 72 variantes en 2022–26. Los stops siguen en el exchange; no se toca nada a mano.';
  const id = 'emerg-' + tag(now);
  const recent = [...known].some(x => x.startsWith('emerg-') && (now - Date.UTC(+x.slice(6, 10), +x.slice(10, 12) - 1, +x.slice(12, 14), +x.slice(14, 16)) / 1000) < 3 * 3600);
  emergency = { id, at: new Date(now * 1000).toISOString(), move: +big.move.toFixed(4), hours: big.h, z: +big.z.toFixed(1), dir: dir === 1 ? 'sube' : 'cae', votes, verdict, verdictText };
  if (!known.has(id) && !recent && office) {
    events.push({ id, agent: 'calvo', type: 'emergencia', at: emergency.at, real: true, text: 'Sala de emergencias: BTC ' + pct(big.move) + ' en ' + big.h + ' h. ' + verdict + '.' });
    emails.push({ subject: '🚨 Mesa Radar · Sala de emergencias · BTC ' + pct(big.move) + ' en ' + big.h + ' h · ' + verdict, body: 'Movimiento brusco: BTC ' + (dir === 1 ? 'sube' : 'cae') + ' un ' + pct(Math.abs(big.move)).slice(1) + ' en ' + big.h + ' h (' + Math.abs(big.z).toFixed(1).replace('.', ',') + ' desviaciones). Precio ≈ ' + fmt(lastPx) + '.\n\nLa mesa se ha reunido:\n' + AGS.map(k => '· ' + NAMES[k] + ': ' + votes[k].vote.toUpperCase() + ' — ' + votes[k].why).join('\n') + '\n· Nubarrones · bajistas y macro: ' + votes.nubarrones.why + '\n\nVeredicto de Calvo: ' + verdict + '. ' + verdictText + calWarn() + '\n\n' + URL_ });
  }
}

// 5) notas de cada agente
const pos = k => { if (TEST && k === 'ortega' && !(R[k] && R[k].open)) return testPos; const o = R[k] && R[k].open; if (!o) return null; return { side: o.side === 1 ? 'long' : 'short', entry: +o.entry.toFixed(1), stop: +o.stop.toFixed(1), since: new Date(o.entryT * 1000).toISOString(), rNow: +o.rNow.toFixed(2), live: o.sigT >= GO_LIVE }; };
const st = (k, txt, level) => ({ text: txt, level, pos: pos(k) });
const V = R.vega.ctx, O = R.ortega.ctx, Pz = R.paz.ctx, Fe = R.ferrer.ctx, Ri = R.rios.ctx;
// Ríos y Ferrer trabajan juntos: cada uno añade la lectura del otro (informativa; en el backtest el filtro cruzado no mejoró)
const crowd = s => isNaN(Fe.f3) ? 'sin datos de funding' : Fe.f3 * s > 0.0001 ? 'multitud cargada en ese lado (' + (Fe.f3 * 100).toFixed(4).replace('.', ',') + '%)' : Fe.f3 * s < -0.0001 ? 'multitud atrapada en contra: combustible para la rotura' : 'funding neutro';
const posTxt = k => { const p = pos(k); return p ? ' ' + (p.side === 'long' ? 'LARGO' : 'CORTO') + ' desde ' + fmt(p.entry) + ', stop ' + fmt(p.stop) + ', va ' + sR(p.rNow) + (p.live ? '.' : ' (abierta antes de empezar en vivo: no la copies a mitad).') : ''; };
const evOf = k => events.filter(e => e.agent === k).map(e => e.text).join(' · ');
const confTxt = s => !E.PICK.paz.conf ? (NUB.phase === 'mature' && s === -1 ? 'Nubarrones veta mis cortos (bajista maduro).' : '') : confNow(s) ? 'Confluencia a favor (' + confWho(s) + '): puedo entrar.' : 'Solo entro con confluencia (tendencia diaria o ruptura de 5 días a favor); ahora no.';
const RL = E.PICK.paz.rsiLo;
const regTxt = g => g === 1 ? 'alcista' : g === -1 ? 'bajista' : 'plana';
const RST = RD && RD.R.status;
const radarNote = k => { if (!RD) return 'Aprendiz del Radar sin datos de 15 min en esta ronda. ';
  const o = radarOpen.find(t => RAD_AG[t.kind || 'bo'] === k), rp = RD.R.open && !RD.R.open.pending && RD.R.open.r == null ? RD.R.open : null;
  if (o) return 'Aprendiz del Radar: ' + SIDE(o.side) + ' desde ' + fmt(o.entry) + ', stop ' + fmt(o.sl0) + ', objetivo ' + fmt(o.tp) + ', va ' + sR((lastPx - o.entry) * o.side / o.risk) + '. ';
  return 'Aprendiz del Radar (' + (k === 'vega' ? 'rupturas' : k === 'paz' ? 'reversiones' : 'barridos') + '): ' + (rp ? 'el Radar lleva un ' + SIDE(rp.side) + ' desde ' + fmt(rp.entry) + ' (' + sR((lastPx - rp.entry) * rp.side / rp.risk) + '); si su modelo ve otra señal ' + SIDE(rp.side) + ' antes de +0,8R, la tomo yo. ' : 'el Radar está fuera: no hay oportunidades que él se salte. '); };
const notes = {
  vega: st('vega', radarNote('vega') + 'Mi tendencia propia queda en sombra (la de menor R por operación). ' + (evOf('vega') ? evOf('vega') + '. ' : '') + 'Cierre diario ' + fmt(V.close) + ' frente a SMA' + V.n + ' ' + fmt(V.sma) + ' (' + pct(V.close / V.sma - 1) + '), momentum ' + V.n + ' d ' + pct(V.mom) + ': ' + (V.state === 1 ? 'TENDENCIA ALCISTA.' : V.state === -1 ? 'TENDENCIA BAJISTA.' : 'sin tendencia clara, fuera.') + (R.vega.open ? posTxt('vega') : V.state ? ' Entro en el próximo giro de tendencia.' : ' Compro con cierre sobre ' + fmt(V.sma) + ' y momentum positivo; vendo con cierre bajo ella y momentum negativo.'), evOf('vega') ? 'trade' : V.state ? 'idea' : 'ok'),
  ortega: st('ortega', (evOf('ortega') ? evOf('ortega') + '. ' : '') + 'Rango de ' + O.N + ' días ' + fmt(O.low) + '–' + fmt(O.level) + ', SMA50 ' + regTxt(O.regime) + '. ' + (R.ortega.open ? posTxt('ortega') : O.regime === 1 ? 'Compro si una vela de 4 h cierra sobre ' + fmt(O.level) + ' (' + pct(O.level / lastPx - 1) + '); próxima a las ' + hm(O.nextDecision) + '.' : O.regime === -1 ? 'Vendo si una vela de 4 h cierra bajo ' + fmt(O.low) + ' (' + pct(O.low / lastPx - 1) + '); próxima a las ' + hm(O.nextDecision) + '.' : 'Sin tendencia de fondo, quieto.'), evOf('ortega') ? 'trade' : Math.min(Math.abs(O.level / lastPx - 1), Math.abs(O.low / lastPx - 1)) < 0.01 ? 'idea' : 'ok'),
  paz: st('paz', radarNote('paz') + 'Auditoría (12 oct): mi estrategia propia está a prueba frente a un aspirante en sombra sin ella. Mi estrategia propia (0,5R): ' + (evOf('paz') ? evOf('paz') + '. ' : '') + 'SMA50 diaria ' + regTxt(Pz.regime) + ', RSI 1 h ' + Pz.rsi.toFixed(0) + ' (mín. 6 h ' + Pz.rsiMin.toFixed(0) + ', máx. ' + Pz.rsiMax.toFixed(0) + '), EMA50 1 h ' + fmt(Pz.ema) + '. ' + (R.paz.open ? posTxt('paz') : Pz.regime === 1 ? (Pz.rsiMin < RL ? 'Hay retroceso: compro si una vela cierra sobre ' + fmt(Pz.ema) + '.' : 'Espero un retroceso (RSI < ' + RL + ') para comprar.') + ' ' + confTxt(1) : Pz.regime === -1 ? (Pz.rsiMax > 100 - RL ? 'Hay rebote: vendo si una vela cierra bajo ' + fmt(Pz.ema) + '.' : 'Espero un rebote (RSI > ' + (100 - RL) + ') para vender.') + ' ' + confTxt(-1) : 'Sin tendencia de fondo.'), evOf('paz') ? 'trade' : (Pz.regime === 1 && Pz.rsiMin < RL) || (Pz.regime === -1 && Pz.rsiMax > 100 - RL) ? 'idea' : 'ok'),
  rios: st('rios', radarNote('rios') + 'Mi estrategia propia sigue en sombra. ' + (evOf('rios') ? evOf('rios') + '. ' : '') + 'Bollinger 1 h en el percentil ' + Math.round(Ri.rank * 100) + ' de 30 días (busco ≤ 20), volumen ' + Ri.vol.toFixed(1).replace('.', ',') + '× su media, SMA50 ' + regTxt(Ri.regime) + '. ' + (R.rios.open ? posTxt('rios') : Ri.rank <= 0.2 ? 'Mercado comprimido: vigilo ' + (Ri.regime === 1 ? 'la ruptura de ' + fmt(Ri.upper) : 'la caída bajo ' + fmt(Ri.lower)) + ' con volumen.' : 'Sin compresión todavía.') + ' Ferrer me dice: ' + crowd(Ri.regime || 1) + '.' + (NUB.phase === 'mature' ? ' Nubarrones veta mis cortos.' : ''), evOf('rios') ? 'trade' : Ri.rank <= 0.2 ? 'idea' : 'ok'),
  ferrer: st('ferrer', 'EN SOMBRA (auditoría): mi señal se registra y no se opera. ' + (evOf('ferrer') ? evOf('ferrer') + '. ' : '') + (isNaN(Fe.f3) ? 'Sin datos de funding suficientes.' : 'Funding de Binance: última liquidación ' + (Fe.last * 100).toFixed(4).replace('.', ',') + '% (8 h), media de 3 días ' + (Fe.f3 * 100).toFixed(4).replace('.', ',') + '%. ') + (R.ferrer.open ? posTxt('ferrer') : Fe.f3 > E.PICK.ferrer.hi ? 'Largos pagando caro: si el precio pierde ' + fmt(Fe.lo) + ' vendo el squeeze.' : Fe.f3 < E.PICK.ferrer.lo ? 'Cortos pagando: si el precio rompe ' + fmt(Fe.hi) + ' compro el squeeze.' : 'Sin multitud atrapada (busco media > 0,05% o < −0,005%).') + ' Ríos me dice: Bollinger en el percentil ' + Math.round(Ri.rank * 100) + (Ri.rank <= 0.2 ? ', mercado comprimido: si rompe con la multitud en contra, es nuestro squeeze.' : ', sin compresión.'), evOf('ferrer') ? 'trade' : (Fe.f3 > E.PICK.ferrer.hi || Fe.f3 < E.PICK.ferrer.lo) ? 'idea' : 'ok'),
};
// Nubarrones: fase del mercado (bajistas) y lectura macro
const NC = NUB.ctx, PHT = { bull: 'ALCISTA', pull: 'ALCISTA EN CORRECCIÓN', top: 'POSIBLE TECHO', early: 'GIRO BAJISTA TEMPRANO', mature: 'BAJISTA MADURO', x: 'SIN DATOS' };
const PHW = { bull: 'No hay nada que vetar; las caídas se compran con los sistemas.', pull: 'Corrección dentro de la tendencia: vigilo si pierde la media de 200 días (' + fmt(NC.s200) + ').', top: 'El corto plazo gira cerca de máximos: es donde empiezan los bajistas. Cuidado con comprar caídas.', early: 'Ha perdido la media de 200 días sin cruce de la muerte: históricamente, los mejores cortos están aquí.', mature: 'Cruce de la muerte: VETO los cortos de Paz y Ríos. En bajistas maduros los rebotes barren a los cortos; mejor esperar.', x: '' };
notes.nubarrones = st('nubarrones', 'Fase: ' + PHT[NUB.phase] + '. BTC ' + pct(NC.dd) + ' desde el máximo de 12 meses, ' + pct(NC.m90) + ' en 90 días; SMA50 ' + fmt(NC.s50) + ' / SMA200 ' + fmt(NC.s200) + '. ' + PHW[NUB.phase] + (cal && cal.events && cal.events.length ? ' Macro hoy: ' + cal.events.map(e => e.hora + ' ' + e.evento).join(' · ') + '.' : cal && cal.titular ? ' Macro: ' + cal.titular : ''), NUB.phase === 'mature' || NUB.phase === 'early' || NUB.phase === 'top' ? 'alerta' : 'ok');
notes.nubarrones.phase = NUB.phase; notes.nubarrones.veto = NUB.phase === 'mature';
// Calvo: riesgo, datos, calendario y marcador en vivo
const score = {}; let nAll = 0, wAll = 0, sumW = 0, sumR = 0;
for (const k of AGS) { const T = R[k].trades.filter(t => inLive(k, t.sigT, t)); const w = T.filter(t => netR(t) > 0).length, s = T.reduce((p, t) => p + netR(t), 0), f = T.reduce((p, t) => p + (t.sigT >= V10 ? fundR(t) : 0), 0); score[k] = { n: T.length, win: w, sumR: +s.toFixed(2), fundR: +f.toFixed(3) }; nAll += T.length; wAll += w; sumR += s; sumW += T.reduce((p, t) => p + netR(t) * (t.sigT >= V10 ? W[k] : W9[k]), 0); }
{ const n = radarClosed.length, w = radarClosed.filter(t => radarNet(t) > 0).length, sr = radarClosed.reduce((p, t) => p + radarNet(t), 0); score.radar = { n, win: w, sumR: +sr.toFixed(2), porAgente: Object.fromEntries(['vega', 'paz', 'rios'].map(k => { const T = radarClosed.filter(t => RAD_AG[t.kind || 'bo'] === k); return [k, { n: T.length, win: T.filter(t => radarNet(t) > 0).length, sumR: +T.reduce((p, t) => p + radarNet(t), 0).toFixed(2) }]; })) };
  nAll += n; wAll += w; sumR += sr; sumW += radarClosed.reduce((p, t) => p + radarNet(t) * t.w, 0); }
score.sombra = Object.fromEntries(SOMBRA.map(k => { const T = R[k].trades.filter(t => t.sigT >= V10); return [k, { n: T.length, win: T.filter(t => t.r > 0).length, sumR: +T.reduce((p, t) => p + t.r, 0).toFixed(2) }]; }));
const weeks = Math.max(1, (now - GO_LIVE) / 604800);
score.mesa = { n: nAll, win: wAll, sumR: +sumR.toFixed(2), sumW: +sumW.toFixed(2), perWeek: +(nAll / weeks).toFixed(2), since: new Date(GO_LIVE * 1000).toISOString() };
const openRisk = AGS.filter(k => R[k].open && inLive(k, R[k].open.sigT, R[k].open)).reduce((p, k) => p + RISK[k], 0);
notes.salinas = st('salinas', (events.some(e => e.agent === 'salinas') ? events.filter(e => e.agent === 'salinas').map(e => e.text).join(' · ') + '. ' : '') + 'Cartera en vivo, neta de funding y con lo abierto: ' + sR(eqR + openMTM, 1) + ' (caída desde el máximo ' + ddR.toFixed(1).replace('.', ',') + 'R; 7 días ' + sR(w7now, 1) + '). Riesgo abierto ' + String(+openR.toFixed(2)).replace('.', ',') + 'R de ' + String(PM.cap).replace('.', ',') + 'R. ' + (halted ? 'PARADA TOTAL: −10R desde el máximo. Nada nuevo hasta una revisión independiente. ' : paused ? 'PARADA SEMANAL: −3R en 7 días; nada nuevo hasta ' + madrid(pauseUntil) + '. ' : '') + (ddR > PM.ddR ? 'FRENO ACTIVO: riesgo a la mitad hasta recuperar.' : 'Tamaños v12: Ortega 1R (0,5%) y Paz 0,5R con sus estrategias; cada oportunidad de los aprendices del Radar 1R; Vega, Ríos y Ferrer propios en sombra.') + ' Paradas: −3R en 7 días pausa una semana; −10R desde el máximo para todo hasta revisión.', halted || paused || ddR > PM.ddR || openR >= PM.cap ? 'alerta' : 'ok');
// Duarte: ciencia de datos y modelo de calidad
const DN = { lado: 'lado', sobreSMA200: 'a favor de la SMA200', 'SMA50>200': 'SMA50 sobre SMA200', ret24h: 'impulso de 24 h', ret7d: 'impulso de 7 días', volrel: 'volatilidad relativa', RSI: 'RSI', funding: 'funding a favor', 'funding-media30d': 'funding frente a su media', pos20d: 'posición en el rango de 20 días', R10agente: 'racha del agente', R10oficina: 'racha de la oficina' };
const topC = DU ? Object.entries(DU.coef).filter(([n]) => DN[n]).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 3).map(([n, v]) => DN[n] + ' ' + (v > 0 ? '+' : '−') + Math.abs(v).toFixed(2).replace('.', ',')).join(', ') : '';
const scTxt = DU ? Object.entries(DU.scores).map(([k, q]) => NAMES[k].split(' ·')[0] + ' percentil ' + Math.round(q.q * 100) + (q.veto ? ' (VETADA)' : '')).join(', ') : '';
notes.duarte = st('duarte', !DU ? 'El modelo de calidad no ha podido cargar en esta ronda; la oficina opera sin él.' : 'Modelo de calidad reentrenado con ' + DU.n + ' operaciones cerradas (2020-26' + (DU.live ? ' + ' + DU.live + ' en vivo' : '') + '). Por decisión de la auditoría no veto nada en producción: solo puntúo. ' + (scTxt ? 'Señales de esta ronda: ' + scTxt + '. ' : '') + 'Comparación en sombra (últimas 200 puntuadas): sin modelo ' + sR(DU.armBase) + ' por operación; vetando el cuartil bajo ' + sR(DU.armVeto) + '. El cuartil bajo rinde ' + sR(DU.lowR) + ' y el resto ' + sR(DU.restR) + (DU.cumpliria ? ': el criterio se cumpliría, pero hace falta validación independiente.' : ': el modelo no separa.'), 'ok');
notes.duarte.ml = DU ? { n: DU.n, live: DU.live, active: false, cumpliria: DU.cumpliria, armBase: DU.armBase, armVeto: DU.armVeto, diff: DU.diff, t: DU.t, lowR: DU.lowR, restR: DU.restR, scores: DU.scores } : null;
// Iturbe: validación cuantitativa (contratado tras la auditoría). Compara lo real con lo esperado y vigila las puertas para escalar.
const EXP_R = 0.16, EXP_SD = 1.60;   // v12: R de cartera por operación y su desviación, 2022-26 fuera de muestra, con costes y funding
{ const T = AGS.flatMap(k => R[k].trades.filter(t => t.sigT >= V11 && W[k] > 0).map(t => netR(t) * W[k])).concat(radarClosed.map(t => radarNet(t) * t.w)), n = T.length, m = n ? T.reduce((p, x) => p + x, 0) / n : 0, z = n ? (m - EXP_R) / (EXP_SD / Math.sqrt(n)) : 0;
  notes.iturbe = st('iturbe', 'Validación v12: los aprendices del Radar operan oportunidades que el Radar no toma. Elegido con 2018-21; en 2022-26 la oficina mejora a la v10 en acierto (45% frente a 43%), R de cartera por operación (+0,16 frente a +0,14), R al año (+19 frente a +14) y Sharpe (0,77 frente a 0,59). Prueba en real desde el ' + new Date(V11 * 1000).getUTCDate() + ' ' + ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][new Date(V11 * 1000).getUTCMonth()] + ': ' + n + ' operaciones cerradas' + (n ? ', ' + sR(m) + ' de cartera por operación frente a +0,16R esperado (z = ' + z.toFixed(1).replace('.', ',') + ')' : '') + '. Para escalar: 100 operaciones, 12 meses y deslizamiento real medido.', n >= 20 && z < -2 ? 'alerta' : 'ok');
  notes.iturbe.val = { n, mR: +m.toFixed(3), z: +z.toFixed(2) };
  // aprendizaje diario sin riesgo (auditoría, fase 4): la vigente opera; las aspirantes compiten en sombra con las mismas operaciones reales.
  // Una aspirante solo se promociona con 20 o más operaciones cerradas, más R que la vigente y aprobación del usuario.
  const own = (k, w) => R[k].trades.filter(t => t.sigT >= V11).map(t => netR(t) * w), apr = w => radarClosed.map(t => radarNet(t) * Math.min(w, t.w));
  const RET = [{ id: 'sin_paz', name: 'sin la estrategia propia de Paz', T: own('ortega', W.ortega).concat(apr(1)) },
    { id: 'v12a', name: 'v12a (Vega propia 0,75R, aprendices 0,5R)', T: own('ortega', W.ortega).concat(own('paz', W.paz), own('vega', 0.75), apr(0.5)) }];
  const s1 = T.reduce((p, x) => p + x, 0), sum = L => L.reduce((p, x) => p + x, 0);
  notes.iturbe.val.vigente = { n, sumR: +s1.toFixed(2) };
  notes.iturbe.val.retadores = RET.map(r => ({ id: r.id, name: r.name, n: r.T.length, win: r.T.filter(x => x > 0).length, sumR: +sum(r.T).toFixed(2) }));
  const lider = notes.iturbe.val.retadores.reduce((b, r) => r.sumR > b.sumR ? r : b, { id: 'vigente', name: 'la vigente', sumR: s1, n });
  notes.iturbe.text += ' Aprendizaje en sombra: vigente ' + n + ' ops y ' + sR(s1) + '; ' + notes.iturbe.val.retadores.map(r => r.name + ' ' + r.n + ' ops y ' + sR(r.sumR)).join('; ') + '. ' +
    (n >= 20 ? (lider.id === 'vigente' ? 'Gana la vigente.' : 'Va ganando ' + lider.name + ': propongo su promoción al dueño.') : 'Se decide con 20 operaciones cerradas.');
  notes.iturbe.val.aspirante = notes.iturbe.val.retadores[0]; }
const soon = calSoon();
notes.calvo = st('calvo', (emergency ? 'SALA DE EMERGENCIAS: BTC ' + pct(emergency.move) + ' en ' + emergency.hours + ' h. Veredicto: ' + emergency.verdict + '. ' : '') + (cal && cal.events && cal.events.length ? 'Hoy: ' + cal.events.map(e => e.hora + ' ' + e.evento).join(' · ') + '.' + (soon.length ? ' Dato macro en menos de 90 min.' : '') : cal ? 'Sin datos macro de impacto alto hoy.' : 'Calendario de hoy sin leer.') + ' Riesgo abierto ' + String(openRisk).replace('.', ',') + '%. En vivo: ' + (nAll ? nAll + ' cerradas, ' + Math.round(wAll / nAll * 100) + '% ganadoras, ' + sR(sumR / nAll) + ' por operación (ref. +0,38R, 40% ganadoras).' : 'aún ninguna cerrada.') + (problems.length ? ' Datos: ' + problems.join('; ') + '.' : ' Datos verificados (' + pairs.length + ' h de solape).') + (nAll >= 30 && sumR / nAll < -0.1 ? ' AVISO: la mesa se desvía del backtest.' : '') + ' El calendario macro es informativo: no cambia ninguna decisión.' + (problems.length ? ' PARADA OPERATIVA: ' + problems.join('; ') + '; no entra nada nuevo.' : ''), emergency || problems.length || soon.length ? 'alerta' : 'ok');

// 6) salida
fs.mkdirSync(outDir, { recursive: true });
const id = 'tick-' + new Date(now * 1000).toISOString().slice(0, 16).replace(/[-:T]/g, '');
if (TEST) { notes.ortega.level = 'trade'; notes.ortega.text = 'PRUEBA (no es una señal real). ' + notes.ortega.text; }
const tick = { version: 'v12', radar: RD ? { ok: !radarProblems.length, missed: radarMissed.length, problems: radarProblems, rangeHi: RST && RST.rangeHi, rangeLo: RST && RST.rangeLo, open: radarOpen.map(t => ({ agent: RAD_AG[t.kind || 'bo'], w: t.w, side: t.side, entry: +t.entry.toFixed(1), stop: +t.sl0.toFixed(1), target: +t.tp.toFixed(1) })) } : null, decisions, stops: { paused, pauseUntil: paused ? new Date(pauseUntil * 1000).toISOString() : null, halted: !!halted, w7: +w7now.toFixed(2), dd: +ddR.toFixed(2), openMTM: +openMTM.toFixed(2) }, test: !!TEST, at: new Date(now * 1000).toISOString(), price: +lastPx.toFixed(1), office, notes, events: events.map(e => e.id), dataOk: !problems.length, lastBar: new Date((lastT + 3600) * 1000).toISOString(), emergency, score, move: win.map(w => ({ h: w.h, move: +w.move.toFixed(4), z: +w.z.toFixed(2) })) };
fs.writeFileSync(path.join(outDir, id + '.json'), JSON.stringify(tick));
const writes = [{ op: 'set', collection: 'ticks', doc_id: id, data: tick }];
for (const e of events) { fs.writeFileSync(path.join(outDir, e.id + '.json'), JSON.stringify(e)); writes.push({ op: 'set', collection: 'signals', doc_id: e.id, data: e }); }
console.log('WRITES ' + JSON.stringify(writes));
for (const m of emails) console.log('EMAIL_JSON ' + JSON.stringify(m));
const NM = Object.assign({ calvo: 'Calvo · sala de emergencias', salinas: 'Salinas · cartera', duarte: 'Duarte · calidad', iturbe: 'Iturbe · validación' }, NAMES);
console.log('RESUMEN ' + (events.length ? events.map(e => NM[e.agent] + ': ' + e.text).join(' | ') : 'Ronda sin novedades') + ' · BTC ' + fmt(lastPx) + (problems.length ? ' · DATOS: ' + problems.join('; ') : '') + (warns.length ? ' · AVISO: ' + warns.join('; ') : '') + (radarProblems.length ? ' · RADAR: ' + radarProblems.join('; ') : ''));

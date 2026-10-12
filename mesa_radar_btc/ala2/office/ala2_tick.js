// Ala 2 · ronda de decisión cada 10 min (L-V 7:00-20:50 Madrid). Independiente del ala 1: no lee sus señales, posiciones ni decisiones.
// Montes (liquidez) y Aranda (técnico) predicen; Lagos (director) integra y lleva las versiones; Beltrán (riesgo) calibra el EV y tiene veto.
// FASE 2: trading SIMULADO, "a piñón": cada decisión abre una operación simulada (lado preferido) y cada operación cerrada enseña al aprendiz
// (corrección en línea de los modelos con su error). En paralelo: la misma mesa sin aprender (control) y el campeón con las reglas de Beltrán.
// No hay correos ni dinero real. Todo queda registrado en la colección `ala2`.
// Uso: node ala2_tick.js need <bitstamp_1min.csv>                      -> LOOKBACK=<N>h  (velas de 5 min de Binance que hacen falta)
//      node ala2_tick.js <bitstamp_1min.csv> <om5.json> <flow.json> <fund.json> <oi.json> <liq.json> <estado.json> <dir_salida>
//   om5.json  : points TRADE_SIDE_AGNOSTIC_AGG BINANCE_FUTURES BTCUSDT FIVE_MINUTES <N>h
//   flow.json : points TRADE_AGG side BUY, FIVE_MINUTES 5h (flujo agresor comprador real)
//   fund.json : points FUNDING_RATE_AGG HOUR 80h ; oi.json: OPEN_INTEREST_AGG HOUR 25h ; liq.json: LIQUIDATION_AGG HOUR 25h
//   estado.json: data del documento `ala2/estado` (o {} si no existe)
// Salida: WRITES <json para ArtifactData batch>, RESUMEN <...> y, si algo falla, DATOS: <...>
'use strict';
const fs = require('fs'), path = require('path');
const F = require(path.join(__dirname, 'ala2_feat.js')), MD = require(path.join(__dirname, 'ala2_model.js'));
const now = Math.floor((+process.env.MESA_NOW || Date.now()) / 1000);
const FEE = 0.0014, SLIP = 0.0003, CAPITAL = 10000, R1 = 0.005, DAY_STOP = -2, BRAKE = 8, HALT = 12, MAX_DOCS = 40;
const HIST_DAYS = 120;
const fmt = x => Math.round(x).toLocaleString('es-ES'), n2 = x => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(2).replace('.', ','), sR = x => n2(x) + 'R';
const madridDate = s => new Date(s * 1000).toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' });
const hm = s => new Date(s * 1000).toLocaleTimeString('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' });
const docId = t => 'd-' + new Date(t * 1000).toISOString().slice(0, 16).replace(/[-:T]/g, '');
const r3 = x => Number.isFinite(x) ? +x.toFixed(3) : null, r1 = x => Number.isFinite(x) ? +x.toFixed(1) : null;

function loadMinutes(p, nowS, days) {
  const txt = fs.readFileSync(p, 'utf8'), from = nowS - days * 86400; let end = txt.length; const rows = [];
  while (end > 0) {
    const st = txt.lastIndexOf('\n', end - 1), line = txt.slice(st + 1, end).trim(); end = st < 0 ? 0 : st;
    if (line && line[0] !== 't') { const a = line.split(',').map(Number); if (a.length >= 6 && a.every(Number.isFinite) && a[0] + 60 <= nowS) { if (a[0] < from) break; rows.push(a.slice(0, 6)); } }
    if (st < 0) break;
  }
  return rows.reverse();
}
const series = j => { const d = j && j.data ? j.data : j; return (d && d.series) || [d]; };
const tsec = t => typeof t === 'number' ? (t > 1e12 ? t / 1000 : t) : Date.parse(t) / 1000;
function parseRows(p, keys) {
  const out = new Map(); let j; try { j = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
  for (const s of series(j)) { if (!s || !s.rows) continue; const c = s.columns || [], ix = k => c.indexOf(k);
    for (const r of s.rows) { const t = tsec(r[ix('t')]), v = keys.map(k => +r[ix(k)]); if (Number.isFinite(t) && v.every(Number.isFinite)) out.set(t, v); } }
  return out;
}
const med = a => { const b = a.slice().sort((x, y) => x - y), m = b.length >> 1; return b.length ? (b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2) : NaN; };

if (process.argv[2] === 'need') {
  const rows = loadMinutes(process.argv[3], now, 3), last = rows.length ? rows[rows.length - 1][0] : now - 40 * 3600;
  console.log('LOOKBACK=' + Math.min(48, Math.max(6, Math.ceil((now - last) / 3600) + 3)) + 'h');
  process.exit(0);
}
const [, , minPath, om5Path, flowPath, fundPath, oiPath, liqPath, estPath, outDir] = process.argv;
const problems = [];
const META = JSON.parse(fs.readFileSync(path.join(__dirname, 'ala2_models.json'), 'utf8'));
let EST = {}; try { const e = JSON.parse(fs.readFileSync(estPath, 'utf8')); EST = (e && e.data) || e || {}; } catch (e) { }

// 1) datos: Bitstamp (1 min, hasta el último día publicado) + Binance futuros en velas de 5 min (OpenMarket) para el hueco de hoy
const bsRows = loadMinutes(minPath, Math.min(now, +process.env.ALA2_BS_END || Infinity), HIST_DAYS);   // ALA2_BS_END: solo para ensayos (simula el archivo diario)
const BS = F.minutesTo5(bsRows, now), OM = parseRows(om5Path, ['open', 'high', 'low', 'close', 'volume']) || new Map();
if (!BS) problems.push('sin histórico de Bitstamp');
const lastBs = bsRows.length ? bsRows[bsRows.length - 1][0] + 60 : 0;
const pairs = []; if (BS) for (const [t, v] of OM) { const i = (t - BS.t0) / 300; if (i >= 0 && i < BS.c.length && t + 300 <= lastBs) pairs.push([BS.c[i], BS.v[i], v[3], v[4]]); }
let OFF = -19, K = 110; if (pairs.length >= 12) { OFF = med(pairs.map(p => p[2] - p[0])); K = med(pairs.filter(p => p[1] > 0).map(p => p[3] / p[1])) || K; } else problems.push('poco solape Bitstamp/Binance en 5 min (' + pairs.length + ')');
const tEnd = Math.floor(now / 300) * 300;   // velas completas: empiezan antes de tEnd-300 (la que empieza en tEnd-300 cierra en tEnd)
const S = (() => {
  const t0 = BS ? BS.t0 : Math.min(...OM.keys()), n = (tEnd - t0) / 300, S_ = { t0, o: new Float64Array(n), h: new Float64Array(n), l: new Float64Array(n), c: new Float64Array(n), v: new Float64Array(n) }, seen = new Uint8Array(n);
  if (BS) for (let i = 0; i < Math.min(n, BS.c.length); i++) if (BS.t0 + 300 * i + 300 <= lastBs) { S_.o[i] = BS.o[i] + OFF; S_.h[i] = BS.h[i] + OFF; S_.l[i] = BS.l[i] + OFF; S_.c[i] = BS.c[i] + OFF; S_.v[i] = BS.v[i]; seen[i] = 1; }
  for (const [t, v] of OM) { const i = (t - t0) / 300; if (Number.isInteger(i) && i >= 0 && i < n) { S_.o[i] = v[0]; S_.h[i] = v[1]; S_.l[i] = v[2]; S_.c[i] = v[3]; S_.v[i] = v[4] / K; seen[i] = 1; } }
  let gaps = 0, tail = 0; for (let i = 0; i < n; i++) if (!seen[i]) { const pc = i ? S_.c[i - 1] : S_.o[i]; S_.o[i] = S_.h[i] = S_.l[i] = S_.c[i] = pc; if (t0 + 300 * i > now - 7 * 86400) gaps++; }
  for (let i = n - 1; i >= 0 && !seen[i]; i--) tail++;
  if (gaps > 6) problems.push(gaps + ' velas de 5 min sin datos en la última semana');
  if (tail > 1) problems.push('la última vela de 5 min con datos es de hace ' + (tail * 5) + ' min');
  S_.seen = seen; return S_;
})();
let FUND = []; { const FR = parseRows(fundPath, ['rateClose']); if (FR) for (const [t0, [r]] of FR) { const ts = t0 + 3600; if (ts % 28800 === 0 && ts <= now) FUND.push([ts, r / 100]); } FUND.sort((a, b) => a[0] - b[0]); }
if (FUND.length < 9) problems.push('funding insuficiente (' + FUND.length + ' liquidaciones)');
const P = F.prepare(S, FUND);
const dataBad = problems.filter(p => !p.startsWith('funding'));   // con datos dudosos Beltrán no deja abrir nada
const FLOW = parseRows(flowPath, ['volume']) || new Map(), OI = parseRows(oiPath, ['close']) || new Map();
const LIQ = (() => { const o = { SELL: new Map(), BUY: new Map() }; try { for (const s of series(JSON.parse(fs.readFileSync(liqPath, 'utf8')))) { const sd = s && s.id && s.id.side, c = (s && s.columns) || []; if (!o[sd]) continue; for (const r of s.rows || []) o[sd].set(tsec(r[c.indexOf('t')]), +r[c.indexOf('liquidations')]); } } catch (e) { } return o; })();
// liquidez real (Binance futuros) en el instante t: lo que se graba para entrenar el futuro modelo de Montes con datos de verdad
function realLiq(t) {
  const share = W => { let b = 0, a = 0; for (let x = t - W; x < t; x += 300) { const fv = FLOW.get(x), ov = OM.get(x); if (fv === undefined || ov === undefined) return null; b += fv[0]; a += ov[4]; } return a > 0 ? r3(b / a) : null; };
  const hk = Math.floor(t / 3600) * 3600 - 3600, oiNow = OI.get(hk), oi1 = OI.get(hk - 3600), oi24 = OI.get(hk - 86400);
  const sum = (m, a, b) => { let s = 0, k = 0; for (const [x, v] of m) if (x >= a && x < b) { s += v; k++; } return k ? r1(s) : 0; };
  const o = { compra10m: share(600), compra1h: share(3600), compra4h: share(14400), oi1h: oiNow && oi1 ? r3((oiNow[0] / oi1[0] - 1) * 100) : null, oi24h: oiNow && oi24 ? r3((oiNow[0] / oi24[0] - 1) * 100) : null,
    liqLargos24h: sum(LIQ.SELL, t - 86400, t), liqCortos24h: sum(LIQ.BUY, t - 86400, t) };
  return Object.values(o).every(v => v === null || v === 0) ? null : o;
}

// 2) estado: aprendiz (opera cada decisión y aprende), control (opera cada decisión, no aprende) y campeón (Beltrán: EV > umbral, 1 posición)
const ON = META.online, newBook = () => ({ n: 0, win: 0, sumR: 0, gW: 0, gL: 0, eq: 0, peak: 0, dd: 0, day: '', dayR: 0, dias: {} });
const ST = { lastT: EST.lastT || 0, goLive: EST.goLive || 0, pend: EST.pend || [], w: EST.w || { L: ON.w.L.slice(), S: ON.w.S.slice() }, nLearn: EST.nLearn || 0, halted: !!EST.halted,
  books: { aprendiz: Object.assign(newBook(), EST.books && EST.books.aprendiz), control: Object.assign(newBook(), EST.books && EST.books.control), campeon: Object.assign(newBook(), EST.books && EST.books.campeon) } };
const VER = META.versions[META.champion.ver], writes = [], setDocs = new Map(), closes = [];
const fundBetween = (a, b) => { let s_ = 0; for (const [t, r] of P.FUND) if (t > a && t <= b) s_ += r; return s_; };
const zOf = (p, x) => { const v = [p.liqL, p.liqS, p.tecL, p.tecS, p.dirL, p.dirS].concat(x); return [1].concat(v.map((a, i) => Number.isFinite(a) ? Math.max(-5, Math.min(5, (a - ON.mu[i]) / ON.sd[i])) : 0)); };
const dot = (w, z) => { let s_ = 0; for (let i = 0; i < z.length; i++) s_ += w[i] * z[i]; return s_; };
function model(t) {   // predicciones de la versión vigente y de los dos agregadores en el instante t
  const f = F.features(P, t); if (!f) return null;
  const d = MD.decide(VER, f.x, VER.names), z = zOf(d.p, f.x);
  return { f, d, z, baseL: d.p.avgL, baseS: d.p.avgS, aL: d.p.avgL + dot(ST.w.L, z), aS: d.p.avgS + dot(ST.w.S, z) };
}
// recorre el camino de 5 min desde la entrada: resultado de un lado, o null si sigue abierta
function walk(t, entry, risk, side) {
  const sl = entry - side * risk, tp = entry + side * 1.5 * risk, te = t + 300; let mfe = 0, mae = 0;
  for (let b = te; b + 300 <= tEnd; b += 300) {
    const i = (b - S.t0) / 300; if (i < 0 || i >= S.c.length) return null;
    const hi = S.h[i], lo = S.l[i]; mfe = Math.max(mfe, (side === 1 ? hi - entry : entry - lo) / risk); mae = Math.max(mae, (side === 1 ? entry - lo : hi - entry) / risk);
    let why = null, px = 0;
    if (side === 1 ? lo <= sl : hi >= sl) { why = 'stop'; px = sl; } else if (side === 1 ? hi >= tp : lo <= tp) { why = 'objetivo'; px = tp; } else if (b + 300 >= te + 24 * 3600) { why = 'tiempo'; px = S.c[i]; }
    if (why) {
      const tex = b + 300, slip = why === 'stop' ? SLIP * entry / risk : 0, gross = (px - entry) * side / risk, cost = FEE * entry / risk + side * fundBetween(te, tex) * entry / risk + slip;
      return { r: gross - cost, gross, cost, why, px, tex, mfe, mae };
    }
  }
  return null;
}
function book(key, r, tex, w = 1) {
  const B = ST.books[key], rw = r * w, d = madridDate(tex);
  B.n++; B.sumR += rw; if (r > 0) { B.win++; B.gW += r; } else B.gL -= r;
  B.eq += rw; B.peak = Math.max(B.peak, B.eq); B.dd = Math.max(B.dd, B.peak - B.eq);
  if (B.day === d) B.dayR += rw; else { B.day = d; B.dayR = rw; }
  const x = B.dias[d] || [0, 0, 0]; x[0]++; if (r > 0) x[1]++; x[2] = +(x[2] + rw).toFixed(3); B.dias[d] = x;
  const ks = Object.keys(B.dias).sort(); while (ks.length > 45) delete B.dias[ks.shift()];
}
// 2b) operaciones que se han cerrado desde la última ronda: se apuntan y el aprendiz aprende de su error (en orden de cierre)
const resolved = [];
for (const q of ST.pend) {
  const [t, entry, risk, sA, sF, sC, wC] = q, L_ = walk(t, entry, risk, 1), S_ = walk(t, entry, risk, -1);
  if (L_ && S_) resolved.push({ q, L: L_, S: S_, tex: Math.max(L_.tex, S_.tex) });
}
const done = new Set();
const events = [];
for (const x of resolved) for (const [side, R] of [[1, x.L], [-1, x.S]]) events.push({ x, side, R });
events.sort((a, b) => a.R.tex - b.R.tex);
const mcache = new Map(), mAt = t => { if (!mcache.has(t)) mcache.set(t, model(t)); return mcache.get(t); };
for (const { x, side, R } of events) {
  const [t, , , sA, sF, sC, wC] = x.q, m = mAt(t);
  if (m) { const k = side === 1 ? 'L' : 'S', base = side === 1 ? m.baseL : m.baseS, e = Math.max(-1.5, Math.min(1.6, R.r)) - (base + dot(ST.w[k], m.z)), zz = dot(m.z, m.z); for (let i = 0; i < m.z.length; i++) ST.w[k][i] += ON.eta * e * m.z[i] / (1 + zz); ST.nLearn++; }
  if (side === sA) book('aprendiz', R.r, R.tex);
  if (side === sF) book('control', R.r, R.tex);
  if (side === sC) { book('campeon', R.r, R.tex, wC); if (ST.books.campeon.peak - ST.books.campeon.eq >= HALT) ST.halted = true; }
}
for (const x of resolved) {
  const [t, entry, risk, sA, sF, sC, wC] = x.q, R = sA === 1 ? x.L : x.S, id = docId(t);
  const cierre = { at: new Date(R.tex * 1000).toISOString(), px: +R.px.toFixed(1), motivo: R.why, r: +R.r.toFixed(3), rBruto: +R.gross.toFixed(3), costesR: +R.cost.toFixed(3), eur: Math.round(R.r * CAPITAL * R1),
    mfe: +R.mfe.toFixed(2), mae: +R.mae.toFixed(2), horas: +((R.tex - t - 300) / 3600).toFixed(1), largoR: +x.L.r.toFixed(3), cortoR: +x.S.r.toFixed(3),
    controlR: +(sF === 1 ? x.L.r : x.S.r).toFixed(3), campeonR: sC ? +((sC === 1 ? x.L.r : x.S.r) * wC).toFixed(3) : null };
  const d = setDocs.get(id); if (d) { d.estado = R.why; d.cierre = cierre; } else writes.push({ op: 'update', collection: 'ala2', doc_id: id, data: { estado: R.why, cierre } });
  closes.push(hm(t) + ' ' + (sA === 1 ? 'largo' : 'corto') + ' ' + R.why + ' ' + sR(R.r)); done.add(t);
}
ST.pend = ST.pend.filter(q => !done.has(q[0]));

const REG_NAME = f => (f.tec_volreg > 1.3 ? 'volátil' : f.tec_volreg < 0.8 ? 'tranquilo' : 'normal') + ' · ' + (f.tec_d50 >= 0 ? 'sobre la SMA50 diaria' : 'bajo la SMA50 diaria');
function reasonText(f, d, side, m) {
  const L = [];
  if (Math.abs(f.liq_imb60) > 0.05) L.push('flujo ' + (f.liq_imb60 > 0 ? 'comprador' : 'vendedor') + ' en la última hora (' + n2(f.liq_imb60) + ')');
  if (f.liq_absorb60 > 1) L.push('absorción: mucho volumen para el rango');
  if (f.liq_lowick60 > 0.5) L.push('rechazo de mínimos'); if (f.liq_upwick60 > 0.5) L.push('rechazo de máximos');
  const T = [f.tec_e50 >= 0 ? 'precio sobre la EMA50 de 1 h' : 'precio bajo la EMA50 de 1 h'];
  if (f.tec_rsi1h > 70) T.push('RSI 1 h alto (' + f.tec_rsi1h.toFixed(0) + ')'); if (f.tec_rsi1h < 30) T.push('RSI 1 h bajo (' + f.tec_rsi1h.toFixed(0) + ')');
  T.push('posición en el rango de 24 h ' + Math.round(f.tec_pos24h * 100) + '%');
  const corr = side === 1 ? m.aL - m.baseL : m.aS - m.baseS;
  return 'Montes: ' + (L.join(', ') || 'liquidez sin señal clara') + ' (largo ' + n2(d.p.liqL) + ' / corto ' + n2(d.p.liqS) + '). Aranda: ' + T.join(', ') + ' (largo ' + n2(d.p.tecL) + ' / corto ' + n2(d.p.tecS) + '). ' +
    'Lagos: va ' + (side === 1 ? 'largo' : 'corto') + '; lo aprendido de ' + ST.nLearn + ' errores mueve la previsión ' + sR(corr) + '.';
}
// 3) decisiones nuevas cada 10 min (horario de oficina): el aprendiz y el control operan SIEMPRE; el campeón solo si Beltrán aprueba
function decideAt(t) {
  const m = model(t), entryI = (t - S.t0) / 300, hasEntry = t + 300 <= tEnd && entryI < S.c.length && S.seen[entryI];
  const doc = { at: new Date(t * 1000).toISOString(), t, hora: hm(t), ver: META.champion.ver, modo: 'a piñón + aprendizaje', fase: 'simulación' };
  if (!m || !hasEntry || dataBad.length || m.f.x.some((v, k) => !Number.isFinite(v) && !F.NAMES[k].startsWith('liq_fund'))) {
    doc.dir = 'ninguna'; doc.estado = 'sin operación'; doc.motivo = 'Lagos: faltan datos para decidir (' + (dataBad.length ? dataBad.join('; ') : !m ? 'histórico' : !hasEntry ? 'vela de entrada' : 'variables') + ').'; return doc;
  }
  const f = m.f, FF = f.F, d = m.d, entry = S.c[entryI], risk = 1.5 * f.atr;
  const sA = m.aL >= m.aS ? 1 : -1, sF = m.baseL >= m.baseS ? 1 : -1, oC = d.out[META.champion.agg], C = ST.books.campeon;
  let veto = null;
  if (ST.halted) veto = 'campeón suspendido: cayó ' + HALT + 'R desde su máximo (se reactiva solo con aprobación del usuario)';
  else if (ST.pend.some(q => q[5])) veto = 'el campeón ya tiene una posición abierta';
  else if (C.day === madridDate(t) && C.dayR <= DAY_STOP) veto = 'parada diaria del campeón (' + sR(C.dayR) + ' hoy)';
  else if (!(oC.ev > META.champion.thr)) veto = 'EV neto calibrado ' + sR(oC.ev) + ' no supera ' + sR(META.champion.thr);
  const wC = C.peak - C.eq > BRAKE ? 0.5 : 1, sC = veto ? 0 : oC.side;
  ST.pend.push([t, +entry.toFixed(1), +risk.toFixed(2), sA, sF, sC, wC]);
  const sl = entry - sA * risk, tp = entry + sA * 1.5 * risk, ev = sA === 1 ? m.aL : m.aS, costR = FEE * entry / risk;
  const pw = MD.iso(VER.cal[META.champion.agg + (sA === 1 ? 'L' : 'S') + 'pw'], sA === 1 ? d.p.avgL : d.p.avgS);
  Object.assign(doc, {
    datos: { px: +f.px.toFixed(1), entrada: +entry.toFixed(1), atr1h: +f.atr.toFixed(1), velas: 'Bitstamp 1 min + Binance futuros 5 min (OpenMarket)', ajuste: +OFF.toFixed(1) },
    liq: { imb10: r3(FF.liq_imb10), imb60: r3(FF.liq_imb60), imb240: r3(FF.liq_imb240), volz60: r3(FF.liq_volz60), absorb60: r3(FF.liq_absorb60), amihud60: r3(FF.liq_amihud60), vwap: r3(FF.liq_vwapdist), fundBp: r3(FF.liq_fund), real: realLiq(t) },
    tec: { ret1h: r3(FF.tec_ret1h), ret4h: r3(FF.tec_ret4h), ret1d: r3(FF.tec_ret1d), e50: r3(FF.tec_e50), rsi1h: r1(FF.tec_rsi1h), rsi4h: r1(FF.tec_rsi4h), pos24h: r3(FF.tec_pos24h), d50: r3(FF.tec_d50) },
    reg: { volreg: r3(FF.tec_volreg), bwrank: r3(FF.tec_bwrank), nombre: REG_NAME(FF) },
    montes: { L: r3(d.p.liqL), S: r3(d.p.liqS) }, aranda: { L: r3(d.p.tecL), S: r3(d.p.tecS) }, lagos: { L: r3(m.aL), S: r3(m.aS) },
    dir: sA === 1 ? 'largo' : 'corto', lado: sA === 1 ? 'largo' : 'corto', entry: +entry.toFixed(1), sl: +sl.toFixed(1), tp: +tp.toFixed(1), rr: 1.5, riesgoPct: R1 * 100, riesgoEUR: Math.round(CAPITAL * R1),
    costesR: +costR.toFixed(3), ev: +ev.toFixed(3), pw: Number.isFinite(pw) ? +pw.toFixed(3) : null, conf: ev >= 0.15 ? 'alta' : ev >= 0.05 ? 'media' : 'baja', aprendidos: ST.nLearn,
    motivo: reasonText(FF, d, sA, m), estado: 'abierta',
    control: { lado: sF === 1 ? 'largo' : 'corto', ev: +(sF === 1 ? m.baseL : m.baseS).toFixed(3) },
    campeon: { dir: sC ? (sC === 1 ? 'largo' : 'corto') : 'ninguna', ev: +oC.ev.toFixed(3), riesgo: wC },
    beltran: veto ? 'Campeón vetado: ' + veto + '. La operación del aprendiz es simulada y sirve para aprender.' : 'Campeón aprobado: EV neto ' + sR(oC.ev) + (wC < 1 ? ', a mitad de riesgo' : '') + '.'
  });
  return doc;
}
const tLast = Math.floor((tEnd - 300) / 600) * 600;   // la vela de entrada [t, t+5) ya cerró
let t = ST.lastT ? ST.lastT + 600 : tLast; if (!ST.goLive) ST.goLive = t;
let made = 0;
for (; t <= tLast && made < MAX_DOCS; t += 600) {
  if (!F.isOffice(t)) { ST.lastT = t; continue; }
  setDocs.set(docId(t), decideAt(t)); made++; ST.lastT = t;
}

// 4) estado e informe de Lagos
const fB = B => B.n ? B.n + ' ops, ' + Math.round(B.win / B.n * 100) + '% acierto, ' + sR(B.sumR / B.n) + '/op' : 'sin cierres';
const A = ST.books.aprendiz, Cn = ST.books.control, Ch = ST.books.campeon;
const lagos = 'Fase 2 (simulación) desde el ' + new Date(ST.goLive * 1000).toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' }) + ', una operación simulada cada 10 min. Aprendiz (aprende de cada error, ' + ST.nLearn + ' lecciones): ' + fB(A) +
  '. Control (sin aprender): ' + fB(Cn) + '. Campeón con las reglas de Beltrán: ' + fB(Ch) + '. Backtest 2022-26: operar cada decisión da −0,16R/op y aprender error a error no lo mejoró (−0,19R). Nada pasa a dinero real sin resultados positivos y aprobación del usuario.';
const estado = { at: new Date(now * 1000).toISOString(), lastT: ST.lastT, goLive: ST.goLive, champion: META.champion, modo: 'a piñón + aprendizaje', w: { L: ST.w.L.map(x => +x.toFixed(6)), S: ST.w.S.map(x => +x.toFixed(6)) }, nLearn: ST.nLearn, halted: ST.halted,
  pend: ST.pend, books: ST.books, abiertas: ST.pend.length, problems, lagos, px: +S.c[S.c.length - 1].toFixed(1) };
for (const [id, d] of setDocs) writes.push({ op: 'set', collection: 'ala2', doc_id: id, data: d });
writes.push({ op: 'set', collection: 'ala2', doc_id: 'estado', data: estado });
fs.mkdirSync(outDir, { recursive: true }); fs.writeFileSync(path.join(outDir, 'ala2_writes.json'), JSON.stringify(writes));
if (problems.length) console.log('DATOS: ' + problems.join('; '));
console.log('WRITES ' + JSON.stringify(writes));
const last = [...setDocs.values()].pop();
console.log('RESUMEN Ala 2 · ' + made + ' decisiones' + (last ? ' · última ' + last.hora + ': ' + last.dir + (last.entry ? ' ' + fmt(last.entry) : '') : '') + ' · ' + closes.length + ' cierres · abiertas ' + ST.pend.length + ' · aprendiz ' + fB(A) + ' · control ' + fB(Cn));

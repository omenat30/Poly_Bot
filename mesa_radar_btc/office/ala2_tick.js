// Ala 2 · ronda de decisión cada 10 min (L-V 7:00-20:50 Madrid). Independiente del ala 1: no lee sus señales, posiciones ni decisiones.
// Montes (liquidez) y Aranda (técnico) predicen; Lagos (director) integra y lleva las versiones; Beltrán (riesgo) calibra el EV y tiene veto.
// FASE 2: trading SIMULADO. No hay correos ni dinero real. Cada decisión (también "ninguna") queda registrada en la colección `ala2`.
// Uso: node ala2_tick.js need <bitstamp_1min.csv>                      -> LOOKBACK=<N>h  (velas de 5 min de Binance que hacen falta)
//      node ala2_tick.js <bitstamp_1min.csv> <om5.json> <flow.json> <fund.json> <oi.json> <liq.json> <estado.json> <dir_salida>
//   om5.json  : points TRADE_SIDE_AGNOSTIC_AGG BINANCE_FUTURES BTCUSDT FIVE_MINUTES <N>h
//   flow.json : points TRADE_AGG side BUY, FIVE_MINUTES 4h (flujo agresor comprador real)
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

// 2) carteras simuladas: campeón y retador, con las reglas de Beltrán
const newBook = () => ({ eq: 0, peak: 0, day: '', dayR: 0, open: null, n: 0, win: 0, sumR: 0, halted: false, hist: [] });
const ST = { lastT: EST.lastT || 0, books: { campeon: Object.assign(newBook(), EST.books && EST.books.campeon), retador: Object.assign(newBook(), EST.books && EST.books.retador) }, goLive: EST.goLive || 0 };
const ROLE = { campeon: META.champion, retador: META.challenger }, writes = [], setDocs = new Map(), closes = [];
const fundBetween = (a, b) => { let s = 0; for (const [t, r] of P.FUND) if (t > a && t <= b) s += r; return s; };
function closeTrade(key, B, o, tex, px, why) {
  const gross = (px - o.entry) * o.side / o.risk - (why === 'stop' ? SLIP * o.entry / o.risk : 0), cost = FEE * o.entry / o.risk + o.side * fundBetween(o.te, tex) * o.entry / o.risk;
  const r = gross - cost, rw = r * o.w;
  B.eq += rw; B.peak = Math.max(B.peak, B.eq); if (madridDate(tex) === B.day) B.dayR += rw; else { B.day = madridDate(tex); B.dayR = rw; }
  B.n++; B.sumR += rw; if (r > 0) B.win++; B.hist.push([o.t, o.side, +r.toFixed(3), o.w, tex]); B.open = null;
  if (B.peak - B.eq >= HALT) B.halted = true;
  if (key === 'campeon') {
    const cierre = { at: new Date(tex * 1000).toISOString(), px: +px.toFixed(1), motivo: why, r: +r.toFixed(3), rCartera: +rw.toFixed(3), rBruto: +(gross + (why === 'stop' ? SLIP * o.entry / o.risk : 0)).toFixed(3), costesR: +(cost + (why === 'stop' ? SLIP * o.entry / o.risk : 0)).toFixed(3),
      eur: Math.round(rw * CAPITAL * R1), mfe: +o.mfe.toFixed(2), mae: +o.mae.toFixed(2), previsto: o.ev, horas: +((tex - o.te) / 3600).toFixed(1) };
    const d = setDocs.get(o.id); if (d) { d.estado = why; d.cierre = cierre; } else writes.push({ op: 'update', collection: 'ala2', doc_id: o.id, data: { estado: why, cierre } });
    closes.push((o.side === 1 ? 'largo' : 'corto') + ' ' + hm(o.t) + ' → ' + why + ' ' + sR(r));
  }
}
function advance(key, until) {   // recorre las velas de 5 min cerradas que empiezan en [o.next, until)
  const B = ST.books[key], o = B.open; if (!o) return;
  for (let t = o.next; t + 300 <= until && t + 300 <= tEnd; t += 300) {
    const i = (t - S.t0) / 300; if (i < 0 || i >= S.c.length) break;
    const hi = S.h[i], lo = S.l[i], fav = ((o.side === 1 ? hi - o.entry : o.entry - lo)) / o.risk, adv = ((o.side === 1 ? o.entry - lo : hi - o.entry)) / o.risk;
    o.mfe = Math.max(o.mfe, fav); o.mae = Math.max(o.mae, adv); o.next = t + 300;
    const hitS = o.side === 1 ? lo <= o.sl : hi >= o.sl, hitT = o.side === 1 ? hi >= o.tp : lo <= o.tp;
    if (hitS) return closeTrade(key, B, o, t + 300, o.sl, 'stop');
    if (hitT) return closeTrade(key, B, o, t + 300, o.tp, 'objetivo');
    if (t + 300 >= o.te + 24 * 3600) return closeTrade(key, B, o, t + 300, S.c[i], 'tiempo');
  }
}
const REG_NAME = f => (f.tec_volreg > 1.3 ? 'volátil' : f.tec_volreg < 0.8 ? 'tranquilo' : 'normal') + ' · ' + (f.tec_d50 >= 0 ? 'sobre la SMA50 diaria' : 'bajo la SMA50 diaria');
function reasonText(f, d, side) {
  const L = [], s = side;
  if (Math.abs(f.liq_imb60) > 0.05) L.push('flujo ' + (f.liq_imb60 > 0 ? 'comprador' : 'vendedor') + ' en la última hora (' + n2(f.liq_imb60) + ')');
  if (f.liq_absorb60 > 1) L.push('absorción: mucho volumen para el rango');
  if (f.liq_lowick60 > 0.5) L.push('rechazo de mínimos'); if (f.liq_upwick60 > 0.5) L.push('rechazo de máximos');
  const T = []; T.push(f.tec_e50 >= 0 ? 'precio sobre la EMA50 de 1 h' : 'precio bajo la EMA50 de 1 h');
  if (f.tec_rsi1h > 70) T.push('RSI 1 h alto (' + f.tec_rsi1h.toFixed(0) + ')'); if (f.tec_rsi1h < 30) T.push('RSI 1 h bajo (' + f.tec_rsi1h.toFixed(0) + ')');
  T.push('posición en el rango de 24 h ' + Math.round(f.tec_pos24h * 100) + '%');
  return 'Montes: ' + (L.join(', ') || 'liquidez sin señal clara') + ' (largo ' + n2(d.p.liqL) + ' / corto ' + n2(d.p.liqS) + '). Aranda: ' + T.join(', ') + ' (largo ' + n2(d.p.tecL) + ' / corto ' + n2(d.p.tecS) + '). ' +
    'Lagos: ' + (s === 1 ? 'el largo' : 'el corto') + ' es el lado con más EV calibrado.';
}
function decideAt(t) {
  const f = F.features(P, t), entryI = (t - S.t0) / 300, hasEntry = t + 300 <= tEnd && entryI < S.c.length && S.seen[entryI];
  const doc = { at: new Date(t * 1000).toISOString(), t, hora: hm(t), ver: META.champion.ver, agg: META.champion.agg, umbral: META.champion.thr, fase: 'simulación' };
  if (!f || !hasEntry || f.x.some((v, k) => !Number.isFinite(v) && !F.NAMES[k].startsWith('liq_fund'))) {
    doc.dir = 'ninguna'; doc.motivo = 'Lagos: faltan datos para decidir (' + (!f ? 'histórico' : !hasEntry ? 'vela de entrada' : 'variables') + ').'; doc.estado = 'sin operación'; return doc;
  }
  const FF = f.F, entry = S.c[entryI], risk = 1.5 * f.atr;
  doc.datos = { px: +f.px.toFixed(1), entrada: +entry.toFixed(1), atr1h: +f.atr.toFixed(1), velas: 'Bitstamp 1 min + Binance futuros 5 min (OpenMarket)', ajuste: +OFF.toFixed(1) };
  doc.liq = { imb10: r3(FF.liq_imb10), imb60: r3(FF.liq_imb60), imb240: r3(FF.liq_imb240), volz60: r3(FF.liq_volz60), absorb60: r3(FF.liq_absorb60), amihud60: r3(FF.liq_amihud60), vwap: r3(FF.liq_vwapdist), fundBp: r3(FF.liq_fund), real: realLiq(t) };
  doc.tec = { ret1h: r3(FF.tec_ret1h), ret4h: r3(FF.tec_ret4h), ret1d: r3(FF.tec_ret1d), e50: r3(FF.tec_e50), rsi1h: r1(FF.tec_rsi1h), rsi4h: r1(FF.tec_rsi4h), pos24h: r3(FF.tec_pos24h), d50: r3(FF.tec_d50) };
  doc.reg = { volreg: r3(FF.tec_volreg), bwrank: r3(FF.tec_bwrank), nombre: REG_NAME(FF) };
  const res = {};
  for (const key of ['campeon', 'retador']) {
    const R = ROLE[key], V = META.versions[R.ver], d = MD.decide(V, f.x, V.names), o = d.out[R.agg], B = ST.books[key];
    advance(key, t);
    const s = o.side, sl = entry - s * risk, tp = entry + s * 1.5 * risk, costR = FEE * entry / risk;
    let veto = null;
    if (dataBad.length) veto = 'datos dudosos (' + dataBad.join('; ') + ')';
    else if (B.halted && key === 'campeon') veto = 'ala suspendida: la cartera cayó ' + HALT + 'R desde su máximo (Lagos la reactiva solo con aprobación del usuario)';
    else if (B.open) veto = 'ya hay una posición abierta (' + (B.open.side === 1 ? 'largo' : 'corto') + ' desde las ' + hm(B.open.t) + ')';
    else if (B.day === madridDate(t) && B.dayR <= DAY_STOP) veto = 'parada diaria: hoy ya se perdieron ' + sR(-B.dayR).replace('+', '');
    else if (!(o.ev > R.thr)) veto = 'EV neto calibrado ' + sR(o.ev) + ' no supera ' + sR(R.thr);   // el explorador (umbral −9) nunca se veta por EV
    const w = B.peak - B.eq > BRAKE ? 0.5 : 1;
    if (!veto) {
      if (madridDate(t) !== B.day) { B.day = madridDate(t); B.dayR = 0; }
      B.open = { id: docId(t), t, side: s, entry, sl, tp, risk, te: t + 300, next: t + 300, w, mfe: 0, mae: 0, ev: +o.ev.toFixed(3), pw: +o.pw.toFixed(3) };
    }
    res[key] = { d, o, veto, w, s, sl, tp, costR };
  }
  const c = res.campeon, ok = !c.veto;
  Object.assign(doc, {
    montes: { L: r3(c.d.p.liqL), S: r3(c.d.p.liqS) }, aranda: { L: r3(c.d.p.tecL), S: r3(c.d.p.tecS) }, lagos: { L: r3(c.d.p[META.champion.agg + 'L']), S: r3(c.d.p[META.champion.agg + 'S']) },
    lado: c.s === 1 ? 'largo' : 'corto', dir: ok ? (c.s === 1 ? 'largo' : 'corto') : 'ninguna',
    entry: +entry.toFixed(1), sl: +c.sl.toFixed(1), tp: +c.tp.toFixed(1), rr: 1.5, riesgoPct: +(R1 * 100 * c.w).toFixed(2), riesgoEUR: Math.round(CAPITAL * R1 * c.w),
    costesR: +c.costR.toFixed(3), ev: +c.o.ev.toFixed(3), evOtro: +c.o.evOther.toFixed(3), pw: +c.o.pw.toFixed(3), conf: c.o.ev >= 0.15 ? 'alta' : c.o.ev >= 0.05 ? 'media' : 'baja',
    motivo: reasonText(FF, c.d, c.s), beltran: c.veto ? 'Veto: ' + c.veto + '.' : 'Aprobada: EV neto ' + sR(c.o.ev) + ', ' + (c.w < 1 ? 'riesgo a la mitad (caída > ' + BRAKE + 'R)' : 'riesgo completo') + '.',
    estado: ok ? 'abierta' : 'sin operación',
    retador: { ver: ROLE.retador.ver, agg: ROLE.retador.agg, umbral: ROLE.retador.thr, dir: res.retador.veto ? 'ninguna' : (res.retador.s === 1 ? 'largo' : 'corto'), ev: +res.retador.o.ev.toFixed(3), veto: res.retador.veto }
  });
  return doc;
}

// 3) decisiones nuevas: cada 10 min en horario de oficina, desde la última registrada (como mucho MAX_DOCS por ronda)
const tLast = Math.floor((tEnd - 300) / 600) * 600;   // la vela de entrada [t, t+5) ya cerró
let t = ST.lastT ? ST.lastT + 600 : tLast; if (!ST.goLive) ST.goLive = t;
let made = 0;
for (; t <= tLast && made < MAX_DOCS; t += 600) {
  if (!F.isOffice(t)) continue;
  const d = decideAt(t); setDocs.set(docId(t), d); made++; ST.lastT = t;
}
if (!made && tLast > ST.lastT) ST.lastT = Math.max(ST.lastT, tLast - (F.isOffice(tLast) ? 600 : 0));
for (const key of ['campeon', 'retador']) advance(key, tEnd);

// 4) estado (marcador, posiciones abiertas) e informe de Lagos
const bookOut = B => { const o = B.open; return Object.assign({}, B, { open: o ? Object.assign({}, o, { rNow: r3(((S.c[S.c.length - 1] - o.entry) * o.side) / o.risk) }) : null, hist: B.hist.slice(-400) }); };
const ch = ST.books.campeon, rt = ST.books.retador;
const lagos = 'Fase 2 (simulación) desde el ' + new Date(ST.goLive * 1000).toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' }) + '. Campeón ' + META.champion.ver + ' (media de Montes y Aranda, EV > ' + String(META.champion.thr).replace('.', ',') + 'R): ' + ch.n + ' operaciones, ' + sR(ch.sumR) +
  '. Explorador de Lagos (sin filtro de EV, solo para aprender): ' + rt.n + ' operaciones, ' + sR(rt.sumR) + '. El backtest 2022-26 no mostró ventaja: nada pasa a dinero real sin 100 operaciones simuladas con R medio positivo y aprobación del usuario.';
const estado = { at: new Date(now * 1000).toISOString(), lastT: ST.lastT, goLive: ST.goLive, champion: META.champion, challenger: META.challenger, books: { campeon: bookOut(ch), retador: bookOut(rt) }, problems, lagos, px: +S.c[S.c.length - 1].toFixed(1), ultima: made ? docId(ST.lastT) : (EST.ultima || null) };
for (const [id, d] of setDocs) writes.push({ op: 'set', collection: 'ala2', doc_id: id, data: d });
writes.push({ op: 'set', collection: 'ala2', doc_id: 'estado', data: estado });
fs.mkdirSync(outDir, { recursive: true }); fs.writeFileSync(path.join(outDir, 'ala2_writes.json'), JSON.stringify(writes));
if (problems.length) console.log('DATOS: ' + problems.join('; '));
console.log('WRITES ' + JSON.stringify(writes));
const last = [...setDocs.values()].pop();
console.log('RESUMEN Ala 2 · ' + made + ' decisiones' + (last ? ' · última ' + last.hora + ': ' + last.dir + (last.dir === 'ninguna' ? ' (' + (last.beltran || last.motivo || '').slice(0, 90) + ')' : ' ' + fmt(last.entry) + ', stop ' + fmt(last.sl) + ', objetivo ' + fmt(last.tp)) : '') + (closes.length ? ' · cierres: ' + closes.join('; ') : '') + ' · campeón ' + ch.n + ' ops ' + sR(ch.sumR));

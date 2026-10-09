(() => {
  // ---------- shared helpers ----------
  const $ = s => document.querySelector(s);
  const el = (t, a = {}, k = []) => { const e = document.createElement(t); for (const [n, v] of Object.entries(a)) { if (n === 'text') e.textContent = v; else e.setAttribute(n, v); } for (const c of [].concat(k)) if (c != null) e.append(c); return e; };
  const NS = 'http://www.w3.org/2000/svg', sv = (t, a = {}) => { const e = document.createElementNS(NS, t); for (const [n, v] of Object.entries(a)) e.setAttribute(n, v); return e; };
  const nf0 = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 });
  const fmt = x => x == null || !isFinite(x) ? '–' : nf0.format(x);
  const sR = (x, d = 2) => x == null || !isFinite(x) ? '–' : (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(d).replace('.', ',') + 'R';
  const cls = v => v > 0 ? 'pos' : v < 0 ? 'neg' : '';
  const hm = iso => new Date(iso).toLocaleTimeString('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' });
  const when = iso => new Date(iso).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', '');
  const madridNow = () => { const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date()).split(':').map(Number); return p[0] * 60 + p[1]; };
  const AG = {
    vega: { name: 'Vega', role: 'Tendencia diaria', color: '#2a59c9', real: true, risk: 0.5, job: 'Compra cuando el cierre diario supera la media de 20 días con momentum positivo. Stop móvil a 3,5 ATR diarios. Sale cuando se pierde la tendencia. Solo largos.' },
    ortega: { name: 'Ortega', role: 'Ruptura de 5 días', color: '#0b7a57', real: true, risk: 0.5, job: 'Compra el cierre de 4 h sobre el máximo de 5 días con la media de 50 días al alza, o vende el cierre bajo el mínimo de 5 días con ella a la baja. Stop móvil a 2 ATR. Cobra un 33% a +1,5R y pone el stop en +0,3R al llegar a +0,75R.' },
    paz: { name: 'Paz', role: 'Retroceso a favor', color: '#9b3d8f', real: true, risk: 0.25, job: 'Con la media de 50 días a favor, espera un retroceso de 1 h y entra cuando el precio recupera la EMA50 de 1 h, pero solo si Vega u Ortega ya están dentro en el mismo sentido. Stop bajo el mínimo de 6 h; al llegar a +1,5R lo sube a +0,3R. Medio riesgo.' },
    rios: { name: 'Ríos', role: 'Compresión y volumen', color: '#8f5f00', real: true, risk: 0.25, job: 'Busca la volatilidad de 1 h comprimida y opera la ruptura con volumen a favor de la media de 50 días, solo si Vega u Ortega ya están dentro en el mismo sentido. Al llegar a +1R sube el stop a +0,3R. Medio riesgo.' },
    calvo: { name: 'Calvo', role: 'Riesgo y emergencias', color: '#5a6677', real: false, risk: 0, job: 'Cuadra los datos de Bitstamp y Binance, lee el calendario macro, lleva el marcador en vivo y preside la sala de emergencias cuando BTC hace un movimiento brusco.' }
  };
  const ORDER = ['vega', 'ortega', 'paz', 'rios', 'calvo'], TRADERS = ['vega', 'ortega', 'paz', 'rios'];
  const SIDE = p => p && p.side === 'short' ? 'corto' : 'largo';
  const S = { ticks: [], signals: [], trades: [], sel: null, db: null };
  window.MESA = { AG, ORDER, TRADERS, S, listeners: [], emergency: () => activeEmergency() };
  const activeEmergency = () => { const t = S.ticks[0]; return t && t.emergency && Date.now() - new Date(t.at) < 50 * 60e3 ? t.emergency : null; };
  const emit = () => window.MESA.listeners.forEach(f => { try { f(S); } catch (e) { console.error(e); } });

  // ---------- office status ----------
  function officeOpen() { const m = madridNow(); return m >= 7 * 60 && m < 20 * 60; }
  function renderTop() {
    const open = officeOpen(), chip = $('#officeChip');
    chip.className = 'chip ' + (open ? 'open' : 'closed');
    $('#officeTxt').textContent = open ? 'Oficina abierta · rondas cada 15 min' : 'Oficina cerrada · abre a las 7:00';
    const t = S.ticks[0];
    $('#pxNow').textContent = t ? fmt(t.price) : '–';
    $('#lastRound').textContent = t ? when(t.at) : 'aún ninguna';
  }
  // ---------- round panel ----------
  function renderRound() {
    const t = S.ticks[0], box = $('#agents'); box.textContent = '';
    $('#roundAt').textContent = t ? 'ronda de las ' + hm(t.at) : 'esperando la primera ronda';
    for (const k of ORDER) {
      const a = AG[k], n = t && t.notes && t.notes[k];
      const b = el('button', { type: 'button', class: 'agent', 'aria-pressed': String(S.sel === k) }, [
        el('span', { class: 'dot', style: 'background:' + a.color, text: a.name[0] }),
        el('span', { class: 'who' }, [el('b', { text: a.name }), el('span', { class: 'muted', text: a.role }), n ? el('span', { class: 'lvl ' + (n.level || 'ok'), text: n.level === 'trade' ? 'opera' : n.level === 'idea' ? 'vigila' : n.level === 'alerta' ? 'aviso' : 'ok' }) : null]),
        el('span', { class: 'txt', text: n ? n.text : a.job })
      ]);
      b.addEventListener('click', () => { S.sel = S.sel === k ? null : k; renderRound(); emit(); });
      box.append(b);
    }
    if (!t) box.append(el('p', { class: 'empty', text: 'La primera ronda llega en cuanto abra la oficina: cada 15 minutos entre las 7:00 y las 20:00, los cinco agentes dejan aquí lo que han leído.' }));
  }
  // ---------- book ----------
  function renderBook() {
    const t = S.ticks[0], bk = $('#book'); bk.textContent = '';
    for (const k of TRADERS) {
      const a = AG[k], n = t && t.notes && t.notes[k], p = n && n.pos;
      const d = el('article', { class: 'desk' }, [
        el('div', { class: 'row' }, [el('h3', { text: a.name + ' · ' + a.role }), el('span', { class: 'pill real', text: String(a.risk).replace('.', ',') + '% riesgo' })]),
        el('div', { class: 'row' }, [el('span', { class: 'pill ' + (p ? (p.side === 'short' ? 'in short' : 'in') : 'out'), text: p ? SIDE(p) + ' abierto' : 'fuera' }), p && !p.live ? el('span', { class: 'muted', style: 'font-size:.8rem', text: 'abierta antes del arranque' }) : null]),
        p ? el('dl', {}, [el('dt', { text: 'Entrada' }), el('dd', { text: fmt(p.entry) }), el('dt', { text: 'Stop actual' }), el('dd', { text: fmt(p.stop) }), el('dt', { text: 'Va' }), el('dd', { class: cls(p.rNow), text: sR(p.rNow) }), el('dt', { text: 'Desde' }), el('dd', { text: when(p.since) })]) : null,
        el('p', { class: 'muted', style: 'font-size:.88rem', text: n ? n.text : a.job })
      ]);
      bk.append(d);
    }
    const fd = $('#feed'); fd.textContent = '';
    if (!S.signals.length) fd.append(el('div', { class: 'it' }, [el('span', { class: 'muted', text: '—' }), el('b', { text: 'Avisos' }), el('span', { class: 'muted', text: 'Aquí aparecen las entradas, subidas de stop y cierres en cuanto ocurran. Desde el 9 de octubre de 2026.' })]));
    for (const s of S.signals.slice(0, 25)) {
      const a = AG[s.agent] || { name: s.agent, role: '' };
      fd.append(el('div', { class: 'it' }, [el('span', { class: 'muted mono', text: when(s.at) }), el('b', { class: s.type === 'emergencia' ? 'neg' : '', text: s.type === 'emergencia' ? '🚨 Emergencias' : a.name }), el('span', { class: s.type === 'salida' ? cls(s.r) : '', text: s.text })]));
    }
  }

  // ---------- rendimiento: backtest frente a vivo ----------
  const RD = JSON.parse(document.getElementById('researchData').textContent);
  const WEEK = 604800, wOf = k => RD.w[k];
  function btStats(keys, a, b) {
    const Z = []; for (const k of keys) for (const x of RD.tr[k]) if (x[0] >= a && x[0] < b) Z.push([x[0], x[1], wOf(k)]);
    const n = Z.length, yrs = (Math.min(b, RD.end) - a) / 31557600;
    return { n, win: Z.filter(x => x[1] > 0).length / (n || 1), exp: Z.reduce((p, x) => p + x[1], 0) / (n || 1), expW: Z.reduce((p, x) => p + x[1] * x[2], 0) / (n || 1), perW: n / (yrs * 52.18), perY: Z.reduce((p, x) => p + x[1] * x[2], 0) / yrs };
  }
  const pc = x => isFinite(x) ? Math.round(x * 100) + '%' : '–', d2 = x => isFinite(x) ? x.toFixed(1).replace('.', ',') : '–';
  function renderPerf() {
    const t = S.ticks[0], sc = t && t.score, tb = $('#perfTbl'); tb.textContent = '';
    tb.append(el('thead', {}, [el('tr', {}, [el('th', { scope: 'col', text: '' }), el('th', { scope: 'col', text: 'Riesgo' }), el('th', { scope: 'col', colspan: '3', text: 'Backtest 2022–26 (no visto)' }), el('th', { scope: 'col', colspan: '3', text: 'En vivo' })]),
      el('tr', {}, ['Agente', 'por op.', 'Win rate', 'Ops/semana', 'R esperado/op', 'Win rate', 'Ops/semana', 'R medio/op'].map(h => el('th', { scope: 'col', text: h })))]));
    const bd = el('tbody'), weeks = sc && sc.mesa ? Math.max(1, (Date.now() / 1000 - new Date(sc.mesa.since) / 1000) / WEEK) : null;
    const row = (label, keys, risk, live, bold) => { const b = btStats(keys, RD.split, 1e11); bd.append(el('tr', { style: bold ? 'font-weight:600' : '' }, [el('td', { text: label }), el('td', { text: risk }), el('td', { text: pc(b.win) }), el('td', { text: d2(b.perW) }), el('td', { class: cls(b.exp), text: sR(b.exp) }), el('td', { text: live && live.n ? pc(live.win / live.n) : '–' }), el('td', { text: live && weeks ? d2(live.n / weeks) : '–' }), el('td', { class: live && live.n ? cls(live.sumR) : '', text: live && live.n ? sR(live.sumR / live.n) : '–' })])); return b; };
    for (const k of TRADERS) row(AG[k].name, [k], String(AG[k].risk).replace('.', ',') + '%', sc && sc[k], false);
    const m = row('Mesa', TRADERS, 'hasta 1,5%', sc && sc.mesa, true);
    tb.append(bd);
    const k = $('#perfKpis'); k.textContent = '';
    const kp = (v, l, c) => el('div', { class: 'kpi' }, [el('b', { class: c || '', text: v }), el('span', { text: l })]);
    const lw = sc && sc.mesa && sc.mesa.n ? sc.mesa : null;
    k.append(kp(pc(m.win), 'win rate de la mesa (2022–26)'), kp(d2(m.perW), 'operaciones por semana · objetivo 2–3', m.perW >= 2 && m.perW <= 3 ? 'pos' : 'neg'), kp(sR(m.exp), 'R esperado por operación', cls(m.exp)), kp('+' + d2(m.perY) + 'R', 'al año con el riesgo de cada agente'),
      kp(lw ? lw.n + ' · ' + pc(lw.win / lw.n) : '0', lw ? 'cerradas en vivo · win rate' : 'cerradas en vivo (desde el 9 oct)'));
  }
  function renderEmergency() {
    const box = $('#emerg'), live = activeEmergency(), last = S.ticks.find(t => t.emergency), e = live || (last && last.emergency);
    box.textContent = ''; box.className = 'emerg' + (live ? ' on' : '');
    const head = el('div', { class: 'row' }, [el('h3', { text: live ? '🚨 Sala de emergencias reunida' : 'Sala de emergencias' }), el('span', { class: 'eyebrow', text: e ? when(e.at) : 'sin movimientos bruscos en las últimas rondas' })]);
    box.append(head);
    if (!e) { box.append(el('p', { class: 'muted', text: 'Si BTC se mueve 3,5 desviaciones o más en 1–3 horas (pasa en torno a 1–2 veces por semana), los cinco dejan lo que hacen y se reúnen aquí. Cada uno vota con su sistema (largo, corto, mantener o nada) y Calvo da el veredicto. Te llega un correo con la decisión.' })); return; }
    box.append(el('p', {}, [el('b', { class: e.move < 0 ? 'neg' : 'pos', text: 'BTC ' + (e.move >= 0 ? '+' : '−') + Math.abs(e.move * 100).toFixed(1).replace('.', ',') + '% en ' + e.hours + ' h' }), ' (' + Math.abs(e.z).toFixed(1).replace('.', ',') + ' desviaciones). Veredicto: ', el('b', { text: e.verdict }), '. ' + e.verdictText]));
    const ul = el('ul', { class: 'votes' });
    for (const k of TRADERS) { const v = e.votes && e.votes[k]; if (v) ul.append(el('li', {}, [el('span', { class: 'dot', style: 'background:' + AG[k].color, text: AG[k].name[0] }), el('b', { text: AG[k].name }), el('span', { class: 'vote v-' + v.vote, text: v.vote }), el('span', { class: 'muted', text: v.why })])); }
    box.append(ul);
  }

  // ---------- research ----------
  (function research() {
    const T = RD.tr, KS = TRADERS, all = KS.flatMap(k => T[k].map(x => [x[0], x[1] * RD.w[k], x[1]])).sort((a, b) => a[0] - b[0]);
    const st = Z => { const n = Z.length, s = Z.reduce((p, x) => p + x[1], 0); let c = 0, pk = 0, dd = 0; for (const x of Z) { c += x[1]; pk = Math.max(pk, c); dd = Math.max(dd, pk - c); } const m = s / (n || 1), sd = Math.sqrt(Z.reduce((p, x) => p + (x[1] - m) ** 2, 0) / Math.max(1, n - 1)); return { n, m, s, dd, t: m / sd * Math.sqrt(n), win: Z.filter(x => x[2] > 0).length / (n || 1), raw: Z.reduce((p, x) => p + x[2], 0) / (n || 1) }; };
    const A = all.filter(x => x[0] < RD.split), B = all.filter(x => x[0] >= RD.split), sa = st(A), sb = st(B);
    const yrsB = (RD.end - RD.split) / 31557600;
    $('#thesis').append(el('b', { text: 'La mesa sigue la tendencia y ahora entra solo donde hay confluencia. ' }), `Vega compra la tendencia diaria y Ortega opera la ruptura del rango de 5 días. Paz (retrocesos de 1 h) y Ríos (compresión de volatilidad) solo entran cuando Vega u Ortega ya están dentro en el mismo sentido. Ortega cobra un tercio a +1,5R y los tres protegen la operación con el stop en +0,3R cuando va bien. Con las reglas elegidas en 2017–2021, en 2022–2026 la mesa hizo ${sb.n} operaciones (${(sb.n / yrsB / 52.18).toFixed(1).replace('.', ',')} por semana), ${Math.round(sb.win * 100)}% de acierto y ${sR(sb.raw)} por operación, frente a ${Math.round(RD.v2.win * 100)}% y ${sR(RD.v2.exp)} de la versión anterior. Son ${sR(sb.s / yrsB, 0)} al año, con una caída máxima de ${sb.dd.toFixed(0)}R (antes ${Math.round(RD.v2.dd)}R). Con 1R = 0,5% del capital: cerca de un ${(sb.s / yrsB * 0.5).toFixed(0)}% anual y caídas de hasta un ${(sb.dd * 0.5).toFixed(0)}%. Con costes dobles sigue en +0,19R por operación. El acierto sube, pero sigue por debajo del 40%: en BTC la tendencia gana porque las ganadoras son grandes, no porque sean muchas. Las versiones con un 45% de acierto en 2022–26 se quedan en +0,10–0,17R por operación.`);
    const kp = (v, l, c) => el('div', { class: 'kpi' }, [el('b', { class: c || '', text: v }), el('span', { text: l })]);
    $('#resKpis').append(kp(sR(sa.raw), 'R por op. · 2017–21 (ajuste)', cls(sa.raw)), kp(sR(sb.raw), 'R por op. · 2022–26 (no visto)', cls(sb.raw)), kp(sb.t.toFixed(1).replace('.', ','), 't en 2022–26'), kp((sb.n / yrsB / 52.18).toFixed(1).replace('.', ','), 'operaciones por semana'), kp((() => { let n = 0; for (let y = 2017; y <= 2026; y++) if (all.filter(x => new Date(x[0] * 1000).getUTCFullYear() === y).reduce((p, x) => p + x[1], 0) > 0.5) n++; return n + ' de 10'; })(), 'años en positivo'));
    const svg = $('#resChart'), X0 = 46, X1 = 708, Y0 = 14, Y1 = 248;
    const SER = { mesa: ['Mesa (ponderada)', 'var(--ink)', all.map(x => [x[0], x[1]]), 2.6], vega: ['Vega', '#2a59c9', T.vega, 1.5], ortega: ['Ortega', 'var(--long)', T.ortega, 1.5], paz: ['Paz (½R)', '#9b3d8f', T.paz.map(x => [x[0], x[1] * RD.w.paz]), 1.5], rios: ['Ríos (½R)', 'var(--warn)', T.rios.map(x => [x[0], x[1] * RD.w.rios]), 1.5] };
    let lo = 0, hi = 0; const L = {};
    for (const k in SER) { let c = 0; L[k] = [[RD.start, 0]].concat(SER[k][2].map(([t, r]) => [t, c += r])); for (const [, v] of L[k]) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }
    const sx = t => X0 + (t - RD.start) / (RD.end - RD.start) * (X1 - X0), sy = v => Y1 - (v - lo) / (hi - lo || 1) * (Y1 - Y0);
    svg.append(sv('rect', { x: X0, y: Y0, width: sx(RD.split) - X0, height: Y1 - Y0, fill: 'var(--accent-soft)', opacity: .5 }));
    const stepV = hi - lo > 250 ? 100 : 50;
    for (let v = Math.ceil(lo / stepV) * stepV; v <= hi; v += stepV) { svg.append(sv('line', { x1: X0, x2: X1, y1: sy(v), y2: sy(v), stroke: v === 0 ? 'var(--muted)' : 'var(--line)' })); const t = sv('text', { x: X0 - 6, y: sy(v) + 4, 'text-anchor': 'end' }); t.textContent = (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v); svg.append(t); }
    for (let y = 2017; y <= 2026; y++) { const t = sv('text', { x: sx(Date.UTC(y, 0, 1) / 1000) + 2, y: 268 }); t.textContent = y; svg.append(t); }
    const l1 = sv('text', { x: X0 + 6, y: Y0 + 12 }); l1.textContent = 'parámetros elegidos aquí'; svg.append(l1);
    const l2 = sv('text', { x: sx(RD.split) + 6, y: Y0 + 12 }); l2.textContent = 'años no vistos →'; svg.append(l2);
    for (const k of ['rios', 'paz', 'vega', 'ortega', 'mesa']) svg.append(sv('polyline', { points: L[k].map(([t, v]) => sx(t).toFixed(1) + ',' + sy(v).toFixed(1)).join(' '), fill: 'none', stroke: SER[k][1], 'stroke-width': SER[k][3], 'stroke-linejoin': 'round' }));
    for (const k in SER) { const z = SER[k][2]; $('#resLegend').append(el('span', {}, [el('i', { style: 'background:' + SER[k][1] }), SER[k][0] + ': ' + sR(z.reduce((p, x) => p + x[1], 0), 0)])); }
    const yr = t => new Date(t * 1000).getUTCFullYear(), rows = [];
    for (let y = 2017; y <= 2026; y++) { const f = k => T[k].filter(x => yr(x[0]) === y).reduce((p, x) => p + x[1] * RD.w[k], 0), n = KS.reduce((p, k) => p + T[k].filter(x => yr(x[0]) === y).length, 0); const v = KS.map(f); rows.push([String(y), ...v, v.reduce((a, b) => a + b, 0), n]); }
    const ty = $('#resYears'); ty.append(el('thead', {}, el('tr', {}, ['Año', 'Vega', 'Ortega', 'Paz', 'Ríos', 'Mesa', 'Ops'].map(h => el('th', { scope: 'col', text: h })))));
    const tb = el('tbody'); for (const r of rows) tb.append(el('tr', {}, [el('td', { text: r[0] }), ...r.slice(1, 6).map((v, i) => el('td', { class: cls(v), style: i === 4 ? 'font-weight:600' : '', text: sR(v, 1) })), el('td', { text: String(r[6]) })])); ty.append(tb);
    const FN = { vega: ['Vega', 'Tendencia diaria (media de 20 días + momentum)', 'ok'], ortega2: ['Ortega', 'Ruptura del rango de 5 días (largo y corto)', 'ok'], paz3: ['Paz', 'Retroceso de 1 h a favor de la media de 50 días', 'ok'], rios2: ['Ríos', 'Compresión de volatilidad + volumen', 'ok'], calvo: ['Calvo', 'Movimiento brusco: seguirlo o darle la vuelta', 'no'], ortega: ['Ortega (antes)', 'Barrido de liquidez y vuelta', 'no'], rios: ['Ríos (antes)', 'Cascada o capitulación: comprar el pánico', 'no'], paz: ['Paz (antes)', 'Ruptura del rango asiático', 'no'] };
    const VL = { ok: 'en real', pap: 'en papel', no: 'descartada' };
    const tf = $('#resFam'); tf.append(el('thead', {}, el('tr', {}, ['Agente', 'Idea', 'Variantes', 'Positivas 22–26', 'Elegida: 17–21', 'Elegida: 22–26', 'Veredicto'].map(h => el('th', { scope: 'col', text: h })))));
    const tbf = el('tbody');
    for (const f of RD.fam) { const [a, idea, v] = FN[f.fam]; tbf.append(el('tr', {}, [el('td', { text: a }), el('td', { class: 'txt', text: idea }), el('td', { text: String(f.variants) }), el('td', { text: f.posTest + ' de ' + f.variants }), el('td', { class: cls(f.train.exp), text: sR(f.train.exp) + ' · ' + f.train.n }), el('td', { class: cls(f.test.exp), text: sR(f.test.exp) + ' · ' + f.test.n }), el('td', {}, el('span', { class: 'verd ' + v, text: VL[v] }))])); }
    tf.append(tbf);
  })();

  // ---------- journal ----------
  const J = { rows: [] }, f = $('#jForm');
  const num = v => v === '' || v == null ? null : +String(v).replace(',', '.');
  const calc = x => { const risk = Math.abs(x.plannedEntry - x.plannedStop), s = x.side === 'short' ? -1 : 1; return { slip: (x.fillEntry - x.plannedEntry) * s / risk, r: x.exitPx == null ? null : ((x.exitPx - x.fillEntry) * s * x.qty - (x.fees || 0)) / (risk * x.qty) }; };
  function renderJournal() {
    const C = J.rows.filter(x => x.exitPx != null).sort((a, b) => a.openedAt < b.openedAt ? -1 : 1).map(x => Object.assign({}, x, calc(x)));
    let c = 0, pk = 0, dd = 0; for (const x of C) { c += x.r; pk = Math.max(pk, c); dd = Math.max(dd, pk - c); }
    const wk = Date.now() - 7 * 864e5, wR = C.filter(x => new Date(x.closedAt || x.openedAt) >= wk).reduce((p, x) => p + x.r, 0);
    const m = C.length ? c / C.length : null, sl = J.rows.length ? J.rows.reduce((p, x) => p + calc(x).slip, 0) / J.rows.length : null;
    const kp = (v, l, k2) => el('div', { class: 'kpi' }, [el('b', { class: k2 || '', text: v }), el('span', { text: l })]);
    const k = $('#jKpis'); k.textContent = '';
    k.append(kp(String(C.length), 'cerradas'), kp(m == null ? '–' : sR(m), 'R medio real', m == null ? '' : cls(m)), kp(C.length ? sR(c, 1) : '–', 'R total real'), kp(C.length ? '−' + dd.toFixed(1).replace('.', ',') + 'R' : '–', 'caída desde el máximo'), kp(sl == null ? '–' : sR(sl), 'deslizamiento medio al entrar'));
    const kill = $('#jKill'); kill.hidden = true;
    if (dd >= 10) { kill.hidden = false; kill.textContent = 'Parada total: la caída real llega a ' + dd.toFixed(1).replace('.', ',') + 'R. No abras nada nuevo hasta revisar el sistema.'; }
    else if (wR <= -3) { kill.hidden = false; kill.textContent = 'Parada semanal: ' + sR(wR, 1) + ' en 7 días. Nada nuevo hasta el lunes.'; }
    const tb = $('#jTable'); tb.textContent = '';
    if (!J.rows.length) { tb.append(el('tbody', {}, el('tr', {}, el('td', { class: 'txt muted', text: 'Aún no hay operaciones apuntadas. Cuando ejecutes un aviso de la Mesa, apúntalo aquí con tus precios reales.' })))); return; }
    tb.append(el('thead', {}, el('tr', {}, ['Fecha', 'Agente', 'Aviso', 'Real', 'Stop', 'Salida', 'Desliz.', 'R real', ''].map(h => el('th', { scope: 'col', text: h })))));
    const bd = el('tbody');
    for (const x of J.rows.slice().sort((a, b) => a.openedAt < b.openedAt ? 1 : -1)) {
      const q = calc(x), cell = el('td');
      const closeBox = el('span', { class: 'confirm' }), delBox = el('span', { class: 'confirm' });
      if (x.exitPx == null) {
        const inp = el('input', { type: 'number', step: 'any', 'aria-label': 'Precio de salida', style: 'width:7em;font:.8rem var(--f-mono);padding:2px 4px' }), ok = el('button', { type: 'button', class: 'btn sm', text: 'Cerrar' });
        ok.onclick = async () => { const p = num(inp.value); if (!(p > 0)) { inp.focus(); return; } try { await S.db.collection('trades').doc(x.id).update({ exitPx: p, closedAt: new Date().toISOString() }); } catch (e) { $('#jMsg').textContent = 'No se pudo cerrar (' + (e.code || 'error') + ').'; } };
        closeBox.append(inp, ok);
      }
      const del = el('button', { type: 'button', class: 'btn sm', text: 'Borrar' });
      del.onclick = () => { delBox.textContent = ''; const y = el('button', { type: 'button', class: 'btn sm', text: 'Sí, borrar' }), n = el('button', { type: 'button', class: 'btn sm', text: 'No' }); y.onclick = async () => { try { await S.db.collection('trades').doc(x.id).delete(); } catch (e) { $('#jMsg').textContent = 'No se pudo borrar (' + (e.code || 'error') + ').'; } }; n.onclick = () => renderJournal(); delBox.append('¿Seguro? ', y, n); };
      delBox.append(del); cell.append(closeBox, ' ', delBox);
      bd.append(el('tr', {}, [el('td', { text: when(x.openedAt) }), el('td', { text: (AG[x.source] || { name: x.source }).name + (x.side === 'short' ? ' · corto' : '') }), el('td', { text: fmt(x.plannedEntry) }), el('td', { text: fmt(x.fillEntry) }), el('td', { text: fmt(x.plannedStop) }), el('td', { text: x.exitPx == null ? 'abierta' : fmt(x.exitPx) }), el('td', { class: q.slip > 0.05 ? 'neg' : '', text: sR(q.slip) }), el('td', { class: q.r == null ? '' : cls(q.r), text: q.r == null ? '–' : sR(q.r) }), cell]));
    }
    tb.append(bd);
  }
  f.addEventListener('submit', async ev => {
    ev.preventDefault(); const msg = $('#jMsg');
    if (!S.db) { msg.textContent = 'El registro no está disponible en esta vista.'; return; }
    const F = new FormData(f);
    const x = { openedAt: new Date(F.get('openedAt')).toISOString(), source: F.get('source'), symbol: 'BTCUSDT', side: F.get('side') === 'short' ? 'short' : 'long', plannedEntry: num(F.get('plannedEntry')), plannedStop: num(F.get('plannedStop')), fillEntry: num(F.get('fillEntry')), exitPx: num(F.get('exitPx')), qty: num(F.get('qty')), fees: num(F.get('fees')) || 0, createdAt: new Date().toISOString() };
    if (x.exitPx != null) x.closedAt = x.createdAt;
    if (!(x.qty > 0) || !((x.plannedEntry - x.plannedStop) * (x.side === 'short' ? -1 : 1) > 0)) { msg.textContent = 'Revisa la cantidad y que el stop esté por debajo de la entrada en largos (por encima en cortos).'; return; }
    $('#jSave').disabled = true; msg.textContent = 'Guardando…';
    try { await S.db.collection('trades').add(x); f.reset(); $('#jFees').value = '0'; msg.textContent = 'Guardada.'; } catch (e) { msg.textContent = 'No se pudo guardar (' + (e.code || 'error') + ').'; }
    $('#jSave').disabled = false;
  });

  const all = () => { renderTop(); renderRound(); renderBook(); renderPerf(); renderEmergency(); emit(); };
  all(); renderJournal(); setInterval(() => { renderTop(); renderEmergency(); }, 30000);
  (async () => {
    const db = window.claude && claude.use ? await claude.use('db') : null;
    if (!db) { $('#roundAt').textContent = 'sin conexión con la oficina en esta vista'; return; }
    S.db = db;
    db.collection('ticks').orderBy('at', 'desc').limit(96).onSnapshot(s => { S.ticks = s.docs.map(d => d.data()); all(); }, e => { $('#roundAt').textContent = 'sin conexión (' + e.code + ')'; });
    db.collection('signals').orderBy('at', 'desc').limit(80).onSnapshot(s => { S.signals = s.docs.map(d => d.data()); renderBook(); emit(); }, () => {});
    db.collection('trades').onSnapshot(s => { J.rows = s.docs.map(d => Object.assign({ id: d.id }, d.data())); renderJournal(); }, () => {});
  })();
})();

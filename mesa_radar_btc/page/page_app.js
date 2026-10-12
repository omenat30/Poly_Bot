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
    vega: { name: 'Vega', role: 'Aprendiz del Radar · rupturas', color: '#2a59c9', real: true, risk: 0.5, job: 'Aprendiz del Radar BTC 15m para las rupturas. El Radar solo lleva una operación a la vez; mientras está dentro, su propio modelo sigue viendo rupturas que él ignora. Vega toma esas otras oportunidades (1R, 0,5%) si van en el mismo sentido que la operación del Radar y este aún no ha recorrido +0,8R. Stop y objetivo de 1,65R fijos en el exchange; cierre a las 72 h. Su tendencia diaria propia queda en sombra: era la de menor R por operación.' },
    ortega: { name: 'Ortega', role: 'Ruptura de 5 días', color: '#0b7a57', real: true, risk: 0.5, job: 'Compra el cierre de 4 h sobre el máximo de 5 días con la media de 50 días al alza, o vende el cierre bajo el mínimo de 5 días con ella a la baja (1R, 0,5%). Stop móvil a 2 ATR; al llegar a +1R lo pasa a +0,3R. Diversifica a los aprendices: opera días, no minutos.' },
    paz: { name: 'Paz', role: 'Retroceso · aprendiz reversiones', color: '#9b3d8f', real: true, risk: 0.5, job: 'Dos trabajos. Su estrategia propia (0,5R): con la media de 50 días a favor, espera un retroceso de 1 h (RSI bajo 40, o sobre 60 en cortos) y entra cuando el precio recupera la EMA50 de 1 h. Y como aprendiz del Radar, las reversiones a la media que el Radar ve pero no toma porque ya está dentro, si van en su mismo sentido (1R).' },
    rios: { name: 'Ríos', role: 'Aprendiz del Radar · barridos', color: '#8f5f00', real: true, risk: 0.5, job: 'Aprendiz del Radar para los barridos de liquidez (el precio barre un máximo o mínimo previo y se gira): toma los que el Radar ve sin poder operarlos, a favor de su posición (1R). Son pocos. Su compresión de volatilidad propia sigue en sombra y trabaja con Ferrer: cada uno añade la lectura del otro (compresión y funding) a sus notas.' },
    ferrer: { name: 'Ferrer', role: 'Funding · en sombra', color: '#b0479a', real: false, risk: 0, job: 'En sombra desde la auditoría del 11 oct (sin ventaja: −0,02R por operación): su señal se registra y no se opera. Lee el funding de los futuros de Binance. Cuando una multitud paga caro por estar en un lado (media de 3 días > 0,05% o < −0,005% cada 8 h) y el precio rompe en su contra, opera el squeeze a favor de la rotura: objetivo 3R y stop a +0,3R al llegar a +1R. Opera poco: solo con multitudes atrapadas.' },
    salinas: { name: 'Salinas', role: 'Gestor de carteras', color: '#1f2a3a', real: false, risk: 0, job: 'Tamaños v12: Ortega 1R (0,5%) y Paz 0,5R con sus estrategias propias; cada oportunidad de los aprendices del Radar 1R. No deja pasar de 2R de riesgo abierto y, si la cartera cae más de 8R desde su máximo (contando lo abierto), pone todo a mitad de riesgo. Paradas: −3R en 7 días pausa una semana; −10R desde el máximo para todo hasta una revisión independiente.' },
    nubarrones: { name: 'Nubarrones', role: 'Bajistas y macro', color: '#3b4a6b', real: false, risk: 0, job: 'Su veto a los cortos de Ríos se sostiene en 2017-19 y 2020-26; el de los cortos de Paz solo en los años con que se diseñó (en 2017-19 esos cortos ganaban), así que queda en validación. Experto en mercados bajistas y macro. Clasifica la fase del mercado (alcista, corrección, posible techo, giro temprano o bajista maduro) y, en bajista maduro, veta los cortos de Paz y Ríos: en 2017–19 y en 2020–26 esos cortos perdían porque los rebotes de bajista los barren. No opera: su propia operativa no pasó la prueba.' },
    duarte: { name: 'Duarte', role: 'Ciencia de datos', color: '#0e7490', real: false, risk: 0, job: 'Lleva el modelo de calidad (regresión logística reentrenada con cada operación cerrada). Por decisión de la auditoría no veta nada en producción: puntúa cada señal y compara en sombra la cartera sin modelo con la que vetaría el cuartil bajo.' },
    iturbe: { name: 'Iturbe', role: 'Validación', color: '#7a3e00', real: false, risk: 0, job: 'Se incorpora tras la auditoría para validar, no para buscar estrategias. Mide la cartera en vivo contra lo esperado, mantiene el inventario de experimentos y las pruebas de selección (Deflated Sharpe, SPA) y fija las puertas para escalar: 100 operaciones, 12 meses y deslizamiento real medido.' },
    calvo: { name: 'Calvo', role: 'Riesgo y emergencias', color: '#5a6677', real: false, risk: 0, job: 'Cuadra los datos de Bitstamp y Binance y, si fallan, bloquea toda entrada nueva (parada operativa). Lleva el marcador en vivo neto de funding, mide el retraso y el coste real en el registro y preside la sala de emergencias. El calendario macro es solo informativo.' },
  };
  const ORDER = ['vega', 'ortega', 'paz', 'rios', 'ferrer', 'nubarrones', 'salinas', 'duarte', 'iturbe', 'calvo'], TRADERS = ['vega', 'ortega', 'paz', 'rios', 'ferrer'];
  const SIDE = p => p && p.side === 'short' ? 'corto' : 'largo';
  const S = { ticks: [], signals: [], trades: [], sel: null, db: null };
  window.MESA = { AG, ORDER, TRADERS, S, listeners: [], emergency: () => activeEmergency() };
  const activeEmergency = () => { const t = S.ticks[0]; return t && t.emergency && Date.now() - new Date(t.at) < 50 * 60e3 ? t.emergency : null; };
  const emit = () => window.MESA.listeners.forEach(f => { try { f(S); } catch (e) { console.error(e); } });

  // ---------- office status ----------
  const madridDow = () => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', weekday: 'short' }).format(new Date());
  const OPEN_EXTRA_UNTIL = Date.UTC(2026, 9, 12, 23, 0);   // apertura extra (lunes 12 oct 2026, hasta la 01:00 de Madrid) para la visita de la auditoría externa; después, horario normal
  function officeOpen() { if (Date.now() < OPEN_EXTRA_UNTIL) return true; const m = madridNow(), d = madridDow(); return d !== 'Sat' && d !== 'Sun' && m >= 7 * 60 && m < 21 * 60; }
  window.MESA_OPEN = officeOpen;
  function renderTop() {
    const open = officeOpen(), chip = $('#officeChip');
    chip.className = 'chip ' + (open ? 'open' : 'closed');
    $('#officeTxt').textContent = open ? 'Oficina abierta · rondas cada 15 min' : 'Oficina cerrada · todos en casa · abre L–V a las 7:00';
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
    if (!t) box.append(el('p', { class: 'empty', text: 'La primera ronda llega en cuanto abra la oficina: cada 15 minutos de lunes a viernes entre las 7:00 y las 21:00, los diez agentes dejan aquí lo que han leído.' }));
  }
  // ---------- book ----------
  function renderBook() {
    const t = S.ticks[0], bk = $('#book'); bk.textContent = '';
    for (const k of TRADERS) {
      const a = AG[k], n = t && t.notes && t.notes[k], p = n && n.pos;
      const d = el('article', { class: 'desk' }, [
        el('div', { class: 'row' }, [el('h3', { text: a.name + ' · ' + a.role }), el('span', { class: 'pill real', text: String(a.risk).replace('.', ',') + '% riesgo' })]),
        el('div', { class: 'row' }, [el('span', { class: 'pill ' + (p ? (p.side === 'short' ? 'in short' : 'in') : 'out'), text: p ? SIDE(p) + ' abierto' : 'fuera' }), p && p.test ? el('span', { class: 'pill papel', text: 'prueba · no operar' }) : p && !p.live ? el('span', { class: 'muted', style: 'font-size:.8rem', text: 'abierta antes del arranque' }) : null]),
        p ? el('dl', {}, [el('dt', { text: 'Entrada' }), el('dd', { text: fmt(p.entry) }), el('dt', { text: 'Stop actual' }), el('dd', { text: fmt(p.stop) }), el('dt', { text: 'Va' }), el('dd', { class: cls(p.rNow), text: sR(p.rNow) }), el('dt', { text: 'Desde' }), el('dd', { text: when(p.since) })]) : null,
        el('p', { class: 'muted', style: 'font-size:.88rem', text: n ? n.text : a.job })
      ]);
      bk.append(d);
    }
    const fd = $('#feed'); fd.textContent = '';
    if (!S.signals.length) fd.append(el('div', { class: 'it' }, [el('span', { class: 'muted', text: '—' }), el('b', { text: 'Avisos' }), el('span', { class: 'muted', text: 'Aquí aparecen las entradas, subidas de stop y cierres en cuanto ocurran. Desde el 9 de octubre de 2026.' })]));
    for (const s of S.signals.slice(0, 25)) {
      const a = AG[s.agent] || { name: s.agent, role: '' };
      fd.append(el('div', { class: 'it' }, [el('span', { class: 'muted mono', text: when(s.at) }), el('b', { class: s.type === 'emergencia' ? 'neg' : '', text: (s.test ? '🧪 ' : '') + (s.type === 'emergencia' ? '🚨 Emergencias' : a.name) }), el('span', { class: s.type === 'salida' ? cls(s.r) : '', text: s.text })]));
    }
  }

  // ---------- rendimiento: backtest frente a vivo ----------
  const RD = JSON.parse(document.getElementById('researchData').textContent);
  const WEEK = 604800, wOf = k => RD.w[k];
  function btStats(keys, a, b) {
    const Z = []; for (const k of keys) for (const x of RD.tr[k]) if (x[0] >= a && x[0] < b && !(x[3] === 0)) Z.push([x[0], x[1], x[3] != null ? x[3] : wOf(k)]);
    const n = Z.length, yrs = (Math.min(b, RD.end) - a) / 31557600;
    return { n, win: Z.filter(x => x[1] > 0).length / (n || 1), exp: Z.reduce((p, x) => p + x[1], 0) / (n || 1), expW: Z.reduce((p, x) => p + x[1] * x[2], 0) / (n || 1), perW: n / (yrs * 52.18), perY: Z.reduce((p, x) => p + x[1] * x[2], 0) / yrs };
  }
  const pc = x => isFinite(x) ? Math.round(x * 100) + '%' : '–', d2 = x => isFinite(x) ? x.toFixed(1).replace('.', ',') : '–';
  function renderPerf() {
    const t = S.ticks[0], sc = t && t.score, tb = $('#perfTbl'); tb.textContent = '';
    tb.append(el('thead', {}, [el('tr', {}, [el('th', { scope: 'col', text: '' }), el('th', { scope: 'col', text: 'Riesgo' }), el('th', { scope: 'col', colspan: '3', text: 'Walk-forward 2020–26 (nunca visto)' }), el('th', { scope: 'col', colspan: '3', text: 'En vivo' })]),
      el('tr', {}, ['Agente', 'por op.', 'Win rate', 'Ops/semana', 'R/op (riesgo propio)', 'Win rate', 'Ops/semana', 'R medio/op'].map(h => el('th', { scope: 'col', text: h })))]));
    const bd = el('tbody'), weeks = sc && sc.mesa ? Math.max(1, (Date.now() / 1000 - new Date(sc.mesa.since) / 1000) / WEEK) : null;
    const row = (label, keys, risk, live, bold) => { const b = btStats(keys, RD.split, 1e11); bd.append(el('tr', { style: bold ? 'font-weight:600' : '' }, [el('td', { text: label }), el('td', { text: risk }), el('td', { text: pc(b.win) }), el('td', { text: d2(b.perW) }), el('td', { class: cls(b.exp), text: sR(b.exp) }), el('td', { text: live && live.n ? pc(live.win / live.n) : '–' }), el('td', { text: live && weeks ? d2(live.n / weeks) : '–' }), el('td', { class: live && live.n ? cls(live.sumR) : '', text: live && live.n ? sR(live.sumR / live.n) : '–' })])); return b; };
    for (const k of TRADERS) row(AG[k].name, [k], String(AG[k].risk).replace('.', ',') + '%', sc && sc[k], false);
    const m = row('Mesa', TRADERS, 'tope 1% (2R)', sc && sc.mesa, true);
    tb.append(bd);
    const k = $('#perfKpis'); k.textContent = '';
    const kp = (v, l, c) => el('div', { class: 'kpi' }, [el('b', { class: c || '', text: v }), el('span', { text: l })]);
    const lw = sc && sc.mesa && sc.mesa.n ? sc.mesa : null;
    k.append(kp(pc(m.win), 'win rate de la mesa (walk-forward 2020–26)'), kp(d2(m.perW), 'operaciones por semana · objetivo 2–3', m.perW >= 2 && m.perW <= 3 ? 'pos' : 'neg'), kp(sR(m.expW), 'R de cartera por operación (1R = 0,5% del capital)', cls(m.expW)), kp('+' + d2(m.perY) + 'R', 'al año, neto de costes y funding'),
      kp(lw ? lw.n + ' · ' + pc(lw.win / lw.n) : '0', lw ? 'cerradas en vivo · win rate' : 'cerradas en vivo (desde el 9 oct)'));
  }
  function renderEmergency() {
    const box = $('#emerg'), live = activeEmergency(), last = S.ticks.find(t => t.emergency), e = live || (last && last.emergency);
    box.textContent = ''; box.className = 'emerg' + (live ? ' on' : '');
    const head = el('div', { class: 'row' }, [el('h3', { text: live ? '🚨 Sala de emergencias reunida' : 'Sala de emergencias' }), el('span', { class: 'eyebrow', text: e ? when(e.at) : 'sin movimientos bruscos en las últimas rondas' })]);
    box.append(head);
    if (!e) { box.append(el('p', { class: 'muted', text: 'Si BTC se mueve 3,5 desviaciones o más en 1–3 horas (pasa en torno a 1–2 veces por semana), los ocho dejan lo que hacen y se reúnen aquí. Cada uno vota con su sistema (largo, corto, mantener o nada) y Calvo da el veredicto. Te llega un correo con la decisión.' })); return; }
    box.append(el('p', {}, [el('b', { class: e.move < 0 ? 'neg' : 'pos', text: 'BTC ' + (e.move >= 0 ? '+' : '−') + Math.abs(e.move * 100).toFixed(1).replace('.', ',') + '% en ' + e.hours + ' h' }), ' (' + Math.abs(e.z).toFixed(1).replace('.', ',') + ' desviaciones). Veredicto: ', el('b', { text: e.verdict }), '. ' + e.verdictText]));
    const ul = el('ul', { class: 'votes' });
    for (const k of TRADERS.concat('nubarrones')) { const v = e.votes && e.votes[k]; if (v) ul.append(el('li', {}, [el('span', { class: 'dot', style: 'background:' + AG[k].color, text: AG[k].name[0] }), el('b', { text: AG[k].name }), el('span', { class: 'vote v-' + v.vote, text: v.vote }), el('span', { class: 'muted', text: v.why })])); }
    box.append(ul);
  }


  // ---------- aprendizaje diario sin riesgo: vigente frente a aspirantes en sombra (Iturbe) ----------
  function renderLearn() {
    const box = $('#learnTbl'); if (!box) return; box.textContent = '';
    const v = S.ticks[0] && S.ticks[0].notes && S.ticks[0].notes.iturbe && S.ticks[0].notes.iturbe.val;
    const head = el('tr', {}, ['Versión', 'Estado', 'Operaciones cerradas', 'Ganadoras', 'R de cartera'].map((h, i) => el('th', { scope: 'col', class: i < 2 ? 'txt' : '', text: h })));
    box.append(el('thead', {}, [head])); const body = el('tbody'); box.append(body);
    if (!v || !v.retadores) { body.append(el('tr', {}, [el('td', { class: 'txt', colspan: '5', text: 'La primera ronda con la comparación llega en cuanto abra la oficina.' })])); return; }
    const rows = [{ name: 'v12 vigente', st: 'Opera', n: v.vigente.n, win: null, sumR: v.vigente.sumR }].concat(v.retadores.map(r => ({ name: r.name, st: 'En sombra', n: r.n, win: r.win, sumR: r.sumR })));
    for (const r of rows) body.append(el('tr', {}, [el('td', { class: 'txt', text: r.name }), el('td', { class: 'txt', text: r.st }), el('td', { text: String(r.n) }), el('td', { text: r.win == null ? '–' : String(r.win) }), el('td', { class: r.sumR > 0 ? 'pos' : r.sumR < 0 ? 'neg' : '', text: sR(r.sumR) })]));
  }
  // ---------- histórico de operaciones (entradas avisadas con su salida, y oportunidades que no entraron) ----------
  function renderHist() {
    const tb = $('#histTbl'), kp = $('#histKpis'); if (!tb) return; tb.textContent = ''; kp.textContent = '';
    const fdt = iso => new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
    const sig = S.signals.filter(g => g.real && !g.test), byId = new Map(sig.map(g => [g.id, g]));
    const rows = [];
    for (const g of sig) {
      if (g.type === 'entrada') {
        const out = byId.get(g.id.replace('-in-', '-out-')), ap = g.desk === 'radar';
        rows.push({ at: g.at, agent: g.agent, kind: ap ? 'Aprendiz del Radar' : 'Estrategia propia', side: g.side, entry: g.entry, stop: g.stop, target: g.target, r: out ? out.r : null, estado: out ? (out.r > 0 ? 'Ganada' : 'Perdida') : 'Abierta', closeAt: out ? out.at : null, exit: out ? out.exit : null });
      } else if (g.type === 'bloqueo') rows.push({ at: g.at, agent: g.agent, kind: 'No entró', estado: 'No entró', note: g.text });
    }
    rows.sort((x, y) => new Date(y.at) - new Date(x.at));
    const cl = rows.filter(x => x.r != null), w = cl.filter(x => x.r > 0).length, s = cl.reduce((p, x) => p + x.r, 0);
    const k = (v, l, c) => el('div', { class: 'kpi' }, [el('b', { class: c || '', text: v }), el('span', { text: l })]);
    kp.append(k(String(rows.filter(x => x.entry != null).length), 'operaciones avisadas'), k(String(rows.filter(x => x.estado === 'Abierta').length), 'abiertas'),
      k(cl.length ? Math.round(w / cl.length * 100) + '%' : '–', 'acierto (cerradas)'), k(cl.length ? sR(s) : '–', 'R total (cerradas)', cl.length ? (s >= 0 ? 'pos' : 'neg') : ''), k(cl.length ? sR(s / cl.length) : '–', 'R por operación'));
    const head = el('tr', {}, ['Fecha', 'Agente', 'Tipo', 'Lado', 'Entrada', 'Stop', 'Objetivo', 'Salida', 'Resultado'].map((h, i) => el('th', { scope: 'col', class: i < 3 ? 'txt' : '', text: h })));
    tb.append(el('thead', {}, [head])); const body = el('tbody'); tb.append(body);
    if (!rows.length) { body.append(el('tr', {}, [el('td', { class: 'txt', colspan: '9', text: 'Todavía no hay operaciones en vivo. Cada entrada que te llegue por correo aparecerá aquí con su resultado.' })])); return; }
    for (const x of rows.slice(0, 60)) {
      const name = (AG[x.agent] && AG[x.agent].name) || x.agent;
      if (x.estado === 'No entró') { body.append(el('tr', { class: 'muted' }, [el('td', { class: 'txt', text: fdt(x.at) }), el('td', { class: 'txt', text: name }), el('td', { class: 'txt', text: 'No entró' }), el('td', { class: 'txt', colspan: '6', text: x.note || '' })])); continue; }
      const res = x.r != null ? sR(x.r) : 'Abierta';
      body.append(el('tr', {}, [el('td', { class: 'txt', text: fdt(x.at) }), el('td', { class: 'txt', text: name }), el('td', { class: 'txt', text: x.kind }),
        el('td', { class: x.side === 'long' ? 'pos' : 'neg', text: x.side === 'long' ? 'Largo' : 'Corto' }), el('td', { text: fmt(x.entry) }), el('td', { text: fmt(x.stop) }), el('td', { text: x.target ? fmt(x.target) : '–' }),
        el('td', { text: x.exit != null ? fmt(x.exit) + ' · ' + fdt(x.closeAt) : '–' }), el('td', { class: x.r == null ? '' : x.r > 0 ? 'pos' : 'neg', text: res })]));
    }
  }

  // ---------- research ----------
  (function research() {
    const T = RD.tr, KS = TRADERS, wt = (k, x) => x[3] != null ? x[3] : RD.w[k], all = KS.flatMap(k => T[k].filter(x => x[3] !== 0).map(x => [x[0], x[1] * wt(k, x), x[1]])).sort((a, b) => a[0] - b[0]);
    const st = Z => { const n = Z.length, s = Z.reduce((p, x) => p + x[1], 0); let c = 0, pk = 0, dd = 0; for (const x of Z) { c += x[1]; pk = Math.max(pk, c); dd = Math.max(dd, pk - c); } const m = s / (n || 1), sd = Math.sqrt(Z.reduce((p, x) => p + (x[1] - m) ** 2, 0) / Math.max(1, n - 1)); return { n, m, s, dd, t: m / sd * Math.sqrt(n), win: Z.filter(x => x[2] > 0).length / (n || 1), raw: Z.reduce((p, x) => p + x[2], 0) / (n || 1) }; };
    const A = all.filter(x => x[0] < RD.split), B = all.filter(x => x[0] >= RD.split), sa = st(A), sb = st(B);
    const yrsB = (RD.end - RD.split) / 31557600;
    $('#thesis').append(el('b', { text: 'Mesa v12: los aprendices del Radar. ' }), `Vega, Paz y Ríos han aprendido el modelo del Radar BTC 15m y lo usan para buscar oportunidades que el Radar no toma: las que su propio modelo ve mientras él ya está dentro, solo a favor de su operación y antes de que haya recorrido +0,8R. Ortega y Paz siguen con sus estrategias propias. De 2020 a 2026, con costes y funding, la mesa hizo ${sb.n} operaciones (${(sb.n / yrsB / 52.18).toFixed(1).replace('.', ',')} por semana), ${Math.round(sb.win * 100)}% de acierto, ${sR(sb.raw)} por operación (${sR(sb.s / sb.n)} de cartera), ${sR(sb.s / yrsB, 1)} al año y una caída máxima de ${sb.dd.toFixed(1).replace('.', ',')}R. La v10 daba ${Math.round(RD.prev.win * 100)}% de acierto y +${String(RD.prev.Ry).replace('.', ',')}R al año. La ventaja de la mesa propia sigue sin estar demostrada estadísticamente y 2025 fue negativo (−7R). Con 1R = 0,5% del capital: cerca de un ${(sb.s / yrsB * 0.5).toFixed(0)}% anual histórico y caídas de hasta un ${(sb.dd * 0.5).toFixed(0)}%, sin garantía de que se repita.`);
    const kp = (v, l, c) => el('div', { class: 'kpi' }, [el('b', { class: c || '', text: v }), el('span', { text: l })]);
    $('#resKpis').append(kp(sR(sb.s / yrsB, 1), 'R al año · walk-forward 2020–26', cls(sb.s)), kp(sR(sb.raw), 'R por operación (riesgo propio)', cls(sb.raw)), kp(sR(sb.s / sb.n), 'R de cartera por operación', cls(sb.s)), kp(sb.t.toFixed(1).replace('.', ','), 't (ponderada por riesgo)'), kp((sb.n / yrsB / 52.18).toFixed(1).replace('.', ','), 'operaciones por semana'), kp((() => { let n = 0; for (let y = new Date(RD.start * 1000).getUTCFullYear(); y <= 2026; y++) if (all.filter(x => new Date(x[0] * 1000).getUTCFullYear() === y).reduce((p, x) => p + x[1], 0) > 0.5) n++; return n + ' de ' + (2027 - new Date(RD.start * 1000).getUTCFullYear()); })(), 'años en positivo'));
    const svg = $('#resChart'), X0 = 46, X1 = 708, Y0 = 14, Y1 = 248;
    const SER = { mesa: ['Mesa (ponderada)', 'var(--ink)', all.map(x => [x[0], x[1]]), 2.6], vega: ['Vega', '#2a59c9', T.vega.map(x => [x[0], x[1] * wt('vega', x)]), 1.5], ortega: ['Ortega', 'var(--long)', T.ortega.map(x => [x[0], x[1] * wt('ortega', x)]), 1.5], paz: ['Paz', '#9b3d8f', T.paz.map(x => [x[0], x[1] * wt('paz', x)]), 1.5], rios: ['Ríos', 'var(--warn)', T.rios.map(x => [x[0], x[1] * wt('rios', x)]), 1.5], ferrer: ['Ferrer', '#b0479a', T.ferrer.map(x => [x[0], x[1] * wt('ferrer', x)]), 1.5] };
    let lo = 0, hi = 0; const L = {};
    for (const k in SER) { let c = 0; L[k] = [[RD.start, 0]].concat(SER[k][2].map(([t, r]) => [t, c += r])); for (const [, v] of L[k]) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }
    const sx = t => X0 + (t - RD.start) / (RD.end - RD.start) * (X1 - X0), sy = v => Y1 - (v - lo) / (hi - lo || 1) * (Y1 - Y0);
    svg.append(sv('rect', { x: X0, y: Y0, width: sx(RD.split) - X0, height: Y1 - Y0, fill: 'var(--accent-soft)', opacity: .5 }));
    const stepV = hi - lo > 250 ? 100 : 50;
    for (let v = Math.ceil(lo / stepV) * stepV; v <= hi; v += stepV) { svg.append(sv('line', { x1: X0, x2: X1, y1: sy(v), y2: sy(v), stroke: v === 0 ? 'var(--muted)' : 'var(--line)' })); const t = sv('text', { x: X0 - 6, y: sy(v) + 4, 'text-anchor': 'end' }); t.textContent = (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v); svg.append(t); }
    for (let y = new Date(RD.start * 1000).getUTCFullYear(); y <= 2026; y++) { const t = sv('text', { x: sx(Date.UTC(y, 0, 1) / 1000) + 2, y: 268 }); t.textContent = y; svg.append(t); }
    const l1 = sv('text', { x: X0 + 6, y: Y0 + 12 }); 
    const l2 = sv('text', { x: sx(RD.split) + 6, y: Y0 + 12 }); l2.textContent = 'cada año, con reglas elegidas solo con los anteriores →'; svg.append(l2);
    for (const k of ['ferrer', 'rios', 'paz', 'vega', 'ortega', 'mesa']) svg.append(sv('polyline', { points: L[k].map(([t, v]) => sx(t).toFixed(1) + ',' + sy(v).toFixed(1)).join(' '), fill: 'none', stroke: SER[k][1], 'stroke-width': SER[k][3], 'stroke-linejoin': 'round' }));
    for (const k in SER) { const z = SER[k][2]; $('#resLegend').append(el('span', {}, [el('i', { style: 'background:' + SER[k][1] }), SER[k][0] + ': ' + sR(z.reduce((p, x) => p + x[1], 0), 0)])); }
    const yr = t => new Date(t * 1000).getUTCFullYear(), rows = [];
    for (let y = new Date(RD.start * 1000).getUTCFullYear(); y <= 2026; y++) { const f = k => T[k].filter(x => yr(x[0]) === y).reduce((p, x) => p + x[1] * wt(k, x), 0), n = KS.reduce((p, k) => p + T[k].filter(x => yr(x[0]) === y && x[3] !== 0).length, 0); const v = KS.map(f); rows.push([String(y), ...v, v.reduce((a, b) => a + b, 0), n]); }
    const ty = $('#resYears'); ty.append(el('thead', {}, el('tr', {}, ['Año', 'Vega', 'Ortega', 'Paz', 'Ríos', 'Ferrer', 'Mesa', 'Ops'].map(h => el('th', { scope: 'col', text: h })))));
    const tb = el('tbody'); for (const r of rows) tb.append(el('tr', {}, [el('td', { text: r[0] }), ...r.slice(1, KS.length + 2).map((v, i) => el('td', { class: cls(v), style: i === KS.length ? 'font-weight:600' : '', text: sR(v, 1) })), el('td', { text: String(r[KS.length + 2]) })])); ty.append(tb);
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
    const sigFor = x => S.signals.filter(g => g.type === 'entrada' && g.agent === x.source && !g.test && new Date(g.at) <= new Date(x.openedAt) && new Date(x.openedAt) - new Date(g.at) < 12 * 36e5).sort((a, b) => a.at < b.at ? 1 : -1)[0];
    const lats = J.rows.map(x => { const g = sigFor(x); return g ? (new Date(x.openedAt) - new Date(g.at)) / 6e4 : null; }).filter(v => v != null), lat = lats.length ? lats.reduce((p, v) => p + v, 0) / lats.length : null;
    const cps = C.filter(x => x.qty > 0 && x.fillEntry > 0).map(x => (x.fees || 0) / (x.qty * x.fillEntry) * 100), costPct = cps.length ? cps.reduce((p, v) => p + v, 0) / cps.length : null;
    const kp = (v, l, k2) => el('div', { class: 'kpi' }, [el('b', { class: k2 || '', text: v }), el('span', { text: l })]);
    const k = $('#jKpis'); k.textContent = '';
    k.append(kp(String(C.length), 'cerradas'), kp(m == null ? '–' : sR(m), 'R medio real', m == null ? '' : cls(m)), kp(C.length ? sR(c, 1) : '–', 'R total real'), kp(C.length ? '−' + dd.toFixed(1).replace('.', ',') + 'R' : '–', 'caída desde el máximo'), kp(sl == null ? '–' : sR(sl), 'deslizamiento medio al entrar'), kp(lat == null ? '–' : Math.round(lat) + ' min', 'retraso medio aviso → entrada'), kp(costPct == null ? '–' : costPct.toFixed(2).replace('.', ',') + '%', 'coste real ida y vuelta (prueba: 0,14%)', costPct != null && costPct > 0.18 ? 'neg' : ''));
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

  const all = () => { renderTop(); renderRound(); renderBook(); renderPerf(); renderEmergency(); renderLearn(); emit(); };
  all(); renderJournal(); setInterval(() => { renderTop(); renderEmergency(); }, 30000);
  (async () => {
    const db = window.claude && claude.use ? await claude.use('db') : null;
    if (!db) { $('#roundAt').textContent = 'sin conexión con la oficina en esta vista'; return; }
    S.db = db;
    db.collection('ticks').orderBy('at', 'desc').limit(96).onSnapshot(s => { S.ticks = s.docs.map(d => d.data()); all(); }, e => { $('#roundAt').textContent = 'sin conexión (' + e.code + ')'; });
    db.collection('signals').orderBy('at', 'desc').limit(400).onSnapshot(s => { S.signals = s.docs.map(d => d.data()); renderBook(); renderHist(); emit(); }, () => {});
    db.collection('trades').onSnapshot(s => { J.rows = s.docs.map(d => Object.assign({ id: d.id }, d.data())); renderJournal(); }, () => {});
  })();
})();

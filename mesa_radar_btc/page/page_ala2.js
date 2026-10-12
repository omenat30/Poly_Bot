(() => {
  // Segunda ala · ML (fase 2, simulación). Lee solo la colección `ala2` y su documento `estado`; la comparación con el ala 1 se hace aquí,
  // en el informe, nunca en las decisiones. Incluye su propia sala en 3D: Montes, Aranda, Beltrán y Lagos.
  const $ = s => document.querySelector(s);
  const el = (t, a = {}, ch = []) => { const e = document.createElement(t); for (const [k, v] of Object.entries(a)) { if (k === 'text') e.textContent = v; else e.setAttribute(k, v); } for (const c of [].concat(ch)) if (c != null) e.append(c); return e; };
  const BT = (() => { try { return JSON.parse($('#ala2Data').textContent); } catch (e) { return null; } })();
  const fmt = x => x == null || !Number.isFinite(+x) ? '–' : Math.round(x).toLocaleString('es-ES');
  const n2 = (x, d = 2) => x == null || !Number.isFinite(+x) ? '–' : (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(d).replace('.', ',');
  const sR = x => x == null || !Number.isFinite(+x) ? '–' : n2(x) + 'R', pc = x => x == null || !Number.isFinite(+x) ? '–' : Math.round(x * 100) + '%';
  const dec = (x, d = 2) => x == null || !Number.isFinite(+x) ? '–' : (+x).toFixed(d).replace('.', ',');
  const fdt = s => new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(typeof s === 'number' ? s * 1000 : s));
  const A2 = { decisions: [], estado: null };
  const AGENTS = {
    montes: { name: 'Montes', role: 'Liquidez', color: '#0e7490' }, aranda: { name: 'Aranda', role: 'Técnico', color: '#7c3aed' },
    beltran: { name: 'Beltrán', role: 'Riesgo · veto', color: '#b45309' }, lagos: { name: 'Lagos', role: 'Director · ML', color: '#1f2937' }
  };
  // ---------- métricas comunes (vivo y backtest) ----------
  function metrics(list, weeks) {   // list: [{r, t}] ordenado por cierre
    const n = list.length; if (!n) return { n: 0 };
    const r = list.map(x => x.r), w = r.filter(x => x > 0), l = r.filter(x => x <= 0), sum = r.reduce((a, b) => a + b, 0);
    let eq = 0, pk = 0, dd = 0; for (const x of r) { eq += x; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); }
    const gw = w.length ? w.reduce((a, b) => a + b, 0) / w.length : 0, gl = l.length ? -l.reduce((a, b) => a + b, 0) / l.length : 0;
    return { n, sem: weeks > 0 ? n / weeks : null, win: w.length / n, rop: sum / n, payoff: gl > 0 ? gw / gl : null, pf: gl > 0 ? w.reduce((a, b) => a + b, 0) / -l.reduce((a, b) => a + b, 0) : null, sum, dd, ropBruto: list.every(x => x.cost != null) ? (sum + list.reduce((a, x) => a + x.cost, 0)) / n : null };
  }
  function ala1Live() {
    const S = window.MESA && window.MESA.S; if (!S) return null;
    const sig = S.signals.filter(g => g.real && !g.test), byId = new Map(sig.map(g => [g.id, g])), out = [];
    let first = Infinity; for (const g of sig) if (g.type === 'entrada') { first = Math.min(first, Date.parse(g.at) / 1000); const o = byId.get(g.id.replace('-in-', '-out-')); if (o && o.r != null) out.push({ r: +o.r, t: Date.parse(o.at) / 1000 }); }
    out.sort((a, b) => a.t - b.t); return { list: out, since: first };
  }
  // ---------- render ----------
  function renderTop() {
    const e = A2.estado, d = A2.decisions[0], k = $('#a2Kpis'); if (!k) return; k.textContent = '';
    const kp = (v, l, c) => el('div', { class: 'kpi' }, [el('b', { class: c || '', text: v }), el('span', { text: l })]);
    const ch = e && e.books && e.books.campeon, ex = e && e.books && e.books.retador;
    k.append(kp(String(A2.decisions.length >= 300 ? '300+' : A2.decisions.length), 'decisiones registradas'), kp(ch ? String(ch.n) : '0', 'operaciones del campeón'), kp(ch ? sR(ch.sumR) : '–', 'R del campeón', ch && ch.sumR < 0 ? 'neg' : ch && ch.sumR > 0 ? 'pos' : ''),
      kp(ex ? String(ex.n) : '0', 'señales del explorador'), kp(ex ? sR(ex.sumR) : '–', 'R del explorador', ex && ex.sumR < 0 ? 'neg' : ex && ex.sumR > 0 ? 'pos' : ''), kp(e ? (e.champion && e.champion.ver) || '–' : '–', 'versión del modelo'));
    $('#a2Lagos').textContent = e ? e.lagos : 'Esperando la primera ronda del ala 2 (cada 10 minutos, L–V 7:00–20:50).';
    if (e && e.problems && e.problems.length) $('#a2Lagos').textContent += ' Aviso de datos: ' + e.problems.join('; ') + '.';
    const c = $('#a2Last'); c.textContent = '';
    if (!d) { c.append(el('p', { class: 'muted', text: 'Todavía no hay decisiones.' })); return; }
    const side = d.dir === 'largo' ? 'pos' : d.dir === 'corto' ? 'neg' : 'muted';
    c.append(el('div', { class: 'a2-dec' }, [el('span', { class: 'eyebrow', text: 'Decisión de las ' + d.hora + ' · ' + fdt(d.t).split(',')[0] }), el('b', { class: side, text: d.dir === 'ninguna' ? 'Sin operación' : (d.dir === 'largo' ? 'Largo' : 'Corto') + ' ' + fmt(d.entry) }),
      el('span', { class: 'muted', text: 'Lado preferido: ' + (d.lado || '–') + ' · EV neto ' + sR(d.ev) + ' · probabilidad de acierto ' + pc(d.pw) + ' · confianza ' + (d.conf || '–') })]));
    if (d.entry) { if (d.dir === 'ninguna') c.append(el('span', { class: 'eyebrow', text: 'Si hubiera entrado por el lado preferido' }));
      c.append(el('div', { class: 'a2-grid' }, [['Entrada', fmt(d.entry)], ['Stop', fmt(d.sl)], ['Objetivo', fmt(d.tp)], ['R:R', '1:' + dec(d.rr, 1)], ['Riesgo', (d.riesgoPct != null ? String(d.riesgoPct).replace('.', ',') + '% · ' : '') + fmt(d.riesgoEUR) + ' €'], ['Costes', sR(d.costesR ? -d.costesR : null)]].map(([a, b]) => el('div', {}, [el('span', { class: 'muted', text: a }), el('b', { text: b })]))));
      c.append(el('span', { class: 'muted', style: 'font-size:.78rem', text: 'Riesgo en euros sobre un capital teórico de 10.000 €.' })); }
    c.append(el('p', { text: d.motivo || '' }), el('p', { class: d.dir === 'ninguna' ? 'a2-veto' : 'a2-ok', text: 'Beltrán · ' + (d.beltran || '–') }));
    if (d.retador) c.append(el('p', { class: 'muted', text: 'Explorador de Lagos: ' + (d.retador.dir === 'ninguna' ? 'sin señal' + (d.retador.veto ? ' (' + d.retador.veto + ')' : '') : d.retador.dir + ' (EV ' + sR(d.retador.ev) + ', solo para aprender)') }));
  }
  function renderLog() {
    const tb = $('#a2Log'); if (!tb) return; tb.textContent = '';
    tb.append(el('thead', {}, [el('tr', {}, ['Hora', 'Decisión', 'Precio', 'Montes L/C', 'Aranda L/C', 'Lagos L/C', 'EV neto', 'P(acierto)', 'Régimen', 'Beltrán', 'Resultado'].map((h, i) => el('th', { scope: 'col', class: [0, 1, 8, 9].includes(i) ? 'txt' : '', text: h })))]));
    const body = el('tbody'); tb.append(body);
    if (!A2.decisions.length) { body.append(el('tr', {}, [el('td', { class: 'txt', colspan: '11', text: 'Sin decisiones todavía.' })])); return; }
    for (const d of A2.decisions.slice(0, 24)) {
      const res = d.cierre ? sR(d.cierre.r) + ' · ' + d.cierre.motivo : d.estado === 'abierta' ? 'abierta' : '–';
      body.append(el('tr', { class: d.dir === 'ninguna' ? 'a2-none' : '' }, [el('td', { class: 'txt', text: fdt(d.t) }), el('td', { class: 'txt ' + (d.dir === 'largo' ? 'pos' : d.dir === 'corto' ? 'neg' : 'muted'), text: d.dir }),
        el('td', { text: fmt(d.datos ? d.datos.px : null) }), el('td', { text: d.montes ? n2(d.montes.L) + ' / ' + n2(d.montes.S) : '–' }), el('td', { text: d.aranda ? n2(d.aranda.L) + ' / ' + n2(d.aranda.S) : '–' }), el('td', { text: d.lagos ? n2(d.lagos.L) + ' / ' + n2(d.lagos.S) : '–' }),
        el('td', { class: d.ev > 0 ? 'pos' : 'neg', text: sR(d.ev) }), el('td', { text: pc(d.pw) }), el('td', { class: 'txt', text: d.reg ? d.reg.nombre : '–' }), el('td', { class: 'txt a2-why', text: (d.beltran || d.motivo || '').replace(/^Veto: /, '').replace(/^EV neto calibrado (\S+) no supera (\S+)\.$/, 'veto: EV $1 < $2').slice(0, 80) }),
        el('td', { class: d.cierre ? (d.cierre.r > 0 ? 'pos' : 'neg') : '', text: res })]));
    }
  }
  function renderTrades() {
    const tb = $('#a2Trades'); if (!tb) return; tb.textContent = ''; const e = A2.estado;
    tb.append(el('thead', {}, [el('tr', {}, ['Abierta', 'Cartera', 'Lado', 'Entrada', 'Stop', 'Objetivo', 'MFE / MAE', 'Previsto', 'Resultado', 'Cierre'].map((h, i) => el('th', { scope: 'col', class: i < 2 ? 'txt' : '', text: h })))]));
    const body = el('tbody'), rows = []; tb.append(body);
    for (const d of A2.decisions) if (d.dir !== 'ninguna') rows.push({ t: d.t, who: 'Campeón', side: d.dir, entry: d.entry, sl: d.sl, tp: d.tp, ev: d.ev, c: d.cierre, open: d.estado === 'abierta' });
    if (e && e.books && e.books.retador) { const B = e.books.retador; for (const h of B.hist.slice(-30)) rows.push({ t: h[0], who: 'Explorador', side: h[1] === 1 ? 'largo' : 'corto', c: { r: h[2], at: h[4] } }); if (B.open) rows.push({ t: B.open.t, who: 'Explorador', side: B.open.side === 1 ? 'largo' : 'corto', entry: B.open.entry, sl: B.open.sl, tp: B.open.tp, ev: B.open.ev, open: true, mfe: B.open.mfe, mae: B.open.mae, rNow: B.open.rNow }); }
    if (e && e.books && e.books.campeon && e.books.campeon.open) { const o = e.books.campeon.open, r = rows.find(x => x.who === 'Campeón' && x.t === o.t); if (r) Object.assign(r, { mfe: o.mfe, mae: o.mae, rNow: o.rNow }); }
    rows.sort((a, b) => b.t - a.t);
    if (!rows.length) { body.append(el('tr', {}, [el('td', { class: 'txt', colspan: '10', text: 'Ninguna operación simulada todavía. Beltrán solo aprueba si el EV neto calibrado supera +0,05R.' })])); return; }
    for (const x of rows.slice(0, 40)) {
      const mm = x.c && x.c.mfe != null ? dec(x.c.mfe) + ' / ' + dec(x.c.mae) : x.mfe != null ? dec(x.mfe) + ' / ' + dec(x.mae) : '–';
      body.append(el('tr', {}, [el('td', { class: 'txt', text: fdt(x.t) }), el('td', { class: 'txt', text: x.who }), el('td', { class: x.side === 'largo' ? 'pos' : 'neg', text: x.side }), el('td', { text: fmt(x.entry) }), el('td', { text: fmt(x.sl) }), el('td', { text: fmt(x.tp) }), el('td', { text: mm }), el('td', { text: sR(x.ev) }),
        el('td', { class: x.c ? (x.c.r > 0 ? 'pos' : 'neg') : '', text: x.c ? sR(x.c.r) : x.open ? 'abierta ' + sR(x.rNow) : '–' }), el('td', { text: x.c ? (x.c.motivo ? x.c.motivo + ' · ' : '') + fdt(typeof x.c.at === 'number' ? x.c.at : x.c.at) : '–' })]));
    }
  }
  function renderComp() {
    const tb = $('#a2Comp'); if (!tb) return; tb.textContent = ''; const e = A2.estado, nowS = Date.now() / 1000;
    const H = ['', 'Ops', 'Ops/sem', 'Acierto', 'Payoff', 'R/op neto', 'R/op antes de costes', 'PF', 'R total o R/año', 'Caída máx.', 'Sharpe'];
    tb.append(el('thead', {}, [el('tr', {}, H.map((h, i) => el('th', { scope: 'col', class: i ? '' : 'txt', text: h })))]));
    const body = el('tbody'); tb.append(body);
    const row = (name, m, extra = {}) => body.append(el('tr', { class: extra.cls || '' }, [el('td', { class: 'txt', text: name }), el('td', { text: m.n != null ? String(m.n) : '–' }), el('td', { text: dec(m.sem) }), el('td', { text: pc(m.win) }), el('td', { text: dec(m.payoff) }),
      el('td', { class: m.rop > 0 ? 'pos' : m.rop < 0 ? 'neg' : '', text: sR(m.rop) }), el('td', { text: sR(m.ropBruto) }), el('td', { text: dec(m.pf) }), el('td', { text: m.ry != null ? sR(m.ry) + '/año' : sR(m.sum) }), el('td', { text: m.dd != null ? dec(m.dd, 1) + 'R' : '–' }), el('td', { text: m.sh != null ? dec(m.sh) : m.n >= 20 ? '–' : 'pocas ops' })]));
    const a1 = ala1Live(); if (a1) row('Ala 1 · v12 en vivo', metrics(a1.list, a1.since < Infinity ? (nowS - a1.since) / 604800 : 0));
    const wk = e && e.goLive ? (nowS - e.goLive) / 604800 : 0, live = B => (B ? B.hist : []).map(h => ({ r: h[2] * h[3], t: h[4] }));
    row('Ala 2 · campeón en simulación', metrics(live(e && e.books && e.books.campeon), wk)); row('Ala 2 · explorador en simulación', metrics(live(e && e.books && e.books.retador), wk));
    row('Ala 1 · v12 backtest 2022–26', { n: null, sem: 2.3, win: 0.441, rop: 0.279, ry: 19.1, dd: 14.3, sh: 0.77 }, { cls: 'a2-bt' });
    if (BT) { row('Ala 2 · campeón backtest 2022–26', BT.campeon.p2226, { cls: 'a2-bt' }); row('Ala 2 · explorador backtest 2022–26', BT.retador.p2226, { cls: 'a2-bt' }); }
    // estabilidad fuera de muestra y régimen
    const y = $('#a2Years'); if (y && BT) { y.textContent = ''; const yrs = Object.keys(BT.campeon['años']);
      y.append(el('thead', {}, [el('tr', {}, [el('th', { class: 'txt', text: 'Campeón (walk-forward)' })].concat(yrs.map(k => el('th', { text: k }))))]));
      const b = el('tbody'); y.append(b);
      for (const [lab, f] of [['Ops', s => s ? String(s.n) : '0'], ['Acierto', s => s ? pc(s.win) : '–'], ['R/op', s => s ? sR(s.rop) : '–'], ['R/año', s => s ? sR(s.ry) : '–']]) b.append(el('tr', {}, [el('td', { class: 'txt', text: lab })].concat(yrs.map(k => el('td', { text: f(BT.campeon['años'][k]) })))));
    }
    const rg = $('#a2Reg'); if (rg && BT) { rg.textContent = ''; rg.append(el('thead', {}, [el('tr', {}, ['Régimen (2022–26)', 'Campeón ops', 'Acierto', 'R/op', 'Explorador ops', 'Acierto', 'R/op'].map((h, i) => el('th', { class: i ? '' : 'txt', text: h })))]));
      const b = el('tbody'); rg.append(b); for (const k of Object.keys(BT.campeon.regimen)) { const c = BT.campeon.regimen[k], x = BT.retador.regimen[k]; b.append(el('tr', {}, [el('td', { class: 'txt', text: k }), el('td', { text: String(c.n) }), el('td', { text: pc(c.win) }), el('td', { text: sR(c.rop) }), el('td', { text: String(x.n) }), el('td', { text: pc(x.win) }), el('td', { text: sR(x.rop) })])); } }
  }
  function renderAll() { renderTop(); renderLog(); renderTrades(); renderComp(); scene3d.update(); }

  // ---------- la sala del ala 2 en 3D ----------
  const scene3d = (() => {
    const stage = $('#stage2'); if (!stage || !window.THREE) return { update() {} };
    const T3 = THREE, reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const R = new T3.WebGLRenderer({ antialias: true }); R.setPixelRatio(Math.min(2, devicePixelRatio || 1)); R.shadowMap.enabled = true; R.outputEncoding = T3.sRGBEncoding; stage.prepend(R.domElement);
    const scene = new T3.Scene(), cam = new T3.PerspectiveCamera(36, 1.6, 0.1, 80);
    const bg = () => { scene.background = new T3.Color(getComputedStyle(document.documentElement).getPropertyValue('--paper').trim() || '#f7f9fb').convertSRGBToLinear(); }; bg(); matchMedia('(prefers-color-scheme: dark)').addEventListener('change', bg);
    scene.add(new T3.HemisphereLight(0xffffff, 0x8899aa, 0.8)); const sun = new T3.DirectionalLight(0xffffff, 0.65); sun.position.set(5, 10, 7); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 7, bottom: -7 }); scene.add(sun);
    const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888';
    const M = {}, mat = (k, c, o = {}) => (M[k] = M[k] || new T3.MeshStandardMaterial(Object.assign({ color: c, roughness: .8 }, o)));
    const box = (w, h, d, m, x, y, z, p = scene) => { const b = new T3.Mesh(new T3.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; p.add(b); return b; };
    const cyl = (r1, r2, h, m, x, y, z, p = scene) => { const c = new T3.Mesh(new T3.CylinderGeometry(r1, r2, h, 14), m); c.position.set(x, y, z); c.castShadow = true; p.add(c); return c; };
    const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const tx = new T3.CanvasTexture(c); tx.encoding = T3.sRGBEncoding; return { c, g: c.getContext('2d'), tx }; };
    // planta: 12 × 8 m, suelo técnico oscuro, pared de fondo con la pantalla de decisiones y cristal en el lateral
    const floor = new T3.Mesh(new T3.PlaneGeometry(12, 8), mat('f2', '#3b4654', { roughness: .55 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    box(12, 3, 0.15, mat('w2', css('--wall')), 0, 1.5, -4); box(0.15, 3, 8, mat('w2'), -6, 1.5, 0);
    const glass = new T3.MeshStandardMaterial({ color: 0xbfd8ee, transparent: true, opacity: .18, depthWrite: false, side: T3.DoubleSide }); { const g = new T3.Mesh(new T3.PlaneGeometry(8, 2.6), glass); g.position.set(6, 1.3, 0); g.rotation.y = Math.PI / 2; scene.add(g); box(0.06, 0.06, 8, mat('fr', '#1f2937'), 6, 2.6, 0); }
    const wall = canvas(1024, 400), wallM = new T3.Mesh(new T3.PlaneGeometry(5.6, 2.2), new T3.MeshBasicMaterial({ map: wall.tx, toneMapped: false })); wallM.position.set(0, 1.75, -3.9); scene.add(wallM); box(5.75, 2.35, 0.06, mat('bz', '#111827'), 0, 1.75, -3.95);
    const sign = canvas(512, 64); sign.g.fillStyle = '#1f2937'; sign.g.fillRect(0, 0, 512, 64); sign.g.fillStyle = '#fff'; sign.g.font = '700 30px sans-serif'; sign.g.textAlign = 'center'; sign.g.fillText('SEGUNDA ALA · ML · SIMULACIÓN', 256, 43); sign.tx.needsUpdate = true;
    { const m = new T3.Mesh(new T3.PlaneGeometry(3.4, 0.42), new T3.MeshBasicMaterial({ map: sign.tx })); m.position.set(-3.4, 2.75, -3.9); scene.add(m); }
    // racks de entrenamiento del modelo (Lagos versiona y reentrena)
    const leds = []; for (let r = 0; r < 3; r++) { const g = new T3.Group(); g.position.set(-5.3, 0, -2.6 + r * 0.75); scene.add(g); box(0.9, 2, 0.65, mat('rk', '#1d2229'), 0, 1, 0, g); for (let u = 0; u < 8; u++) { const l = new T3.Mesh(new T3.BoxGeometry(0.02, 0.03, 0.03), new T3.MeshBasicMaterial({ color: 0x3dff9a, toneMapped: false })); l.position.set(0.46, 0.35 + u * 0.2, -0.2); g.add(l); leds.push(l); } }
    // mesas en U frente a la pantalla
    const DK = { montes: { x: -2.6, z: -0.6, yaw: 0 }, aranda: { x: 0, z: -0.6, yaw: 0 }, beltran: { x: 2.6, z: -0.6, yaw: 0 }, lagos: { x: 0, z: 2.2, yaw: Math.PI } };
    const scr = {};
    for (const [k, d] of Object.entries(DK)) {
      const g = new T3.Group(); g.position.set(d.x, 0, d.z); g.rotation.y = d.yaw; scene.add(g);
      box(1.9, 0.06, 0.85, mat('dk', css('--desk')), 0, 0.74, 0, g); for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(0.05, 0.72, 0.05, mat('mt', '#8a96a3'), sx * 0.88, 0.36, sz * 0.36, g);
      const c = canvas(256, 160); scr[k] = c; const m = new T3.Mesh(new T3.PlaneGeometry(0.8, 0.5), new T3.MeshBasicMaterial({ map: c.tx, toneMapped: false })); m.position.set(0, 1.12, -0.25); g.add(m); box(0.84, 0.54, 0.03, mat('bz'), 0, 1.12, -0.27, g);
      const pl = canvas(256, 64); pl.g.fillStyle = AGENTS[k].color; pl.g.fillRect(0, 0, 256, 64); pl.g.fillStyle = '#fff'; pl.g.font = '600 30px sans-serif'; pl.g.textAlign = 'center'; pl.g.fillText(AGENTS[k].name, 128, 42); pl.tx.needsUpdate = true;
      const p = new T3.Mesh(new T3.PlaneGeometry(0.5, 0.125), new T3.MeshBasicMaterial({ map: pl.tx })); p.position.set(0, 0.8, 0.43); g.add(p);
      const ch = new T3.Group(); ch.position.set(d.x, 0, d.z + (d.yaw ? -0.75 : 0.75)); scene.add(ch); box(0.5, 0.07, 0.5, mat('ch', '#39424d'), 0, 0.46, 0, ch); cyl(0.035, 0.035, 0.36, mat('mt'), 0, 0.26, 0, ch); box(0.5, 0.6, 0.07, mat('ch'), 0, 0.8, d.yaw ? -0.25 : 0.25, ch);
    }
    // pizarra de Beltrán: límites de riesgo
    const rb = canvas(512, 320); { const m = new T3.Mesh(new T3.PlaneGeometry(1.7, 1.06), new T3.MeshBasicMaterial({ map: rb.tx })); m.position.set(5.2, 1.45, -1.5); m.rotation.y = -Math.PI / 2; scene.add(m); box(0.04, 1.12, 1.76, mat('fr'), 5.24, 1.45, -1.5); box(0.05, 1.5, 0.05, mat('mt'), 5.25, 0.45, -2.3); box(0.05, 1.5, 0.05, mat('mt'), 5.25, 0.45, -0.7); }
    // monigotes
    const people = {};
    for (const [k, d] of Object.entries(DK)) {
      const g = new T3.Group(), col = mat('p' + k, AGENTS[k].color), sk = mat('sk' + k, ['#e2b999', '#c99a73', '#efc6a6', '#a8754f'][Object.keys(DK).indexOf(k)]);
      box(0.42, 0.55, 0.26, col, 0, 1.0, 0, g); const head = new T3.Mesh(new T3.SphereGeometry(0.16, 16, 12), sk); head.position.set(0, 1.45, 0); head.castShadow = true; g.add(head);
      const hair = new T3.Mesh(new T3.SphereGeometry(0.165, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('h' + k, ['#2a2420', '#151515', '#6b4a2b', '#c4c4c4'][Object.keys(DK).indexOf(k)])); hair.position.set(0, 1.47, 0); g.add(hair);
      const legs = [-0.1, 0.1].map(x => { const l = box(0.13, 0.55, 0.15, mat('pt', '#2e3640'), x, 0.45, 0, g); return l; });
      scene.add(g); const seat = [d.x, d.z + (d.yaw ? -0.75 : 0.75)]; g.position.set(seat[0], 0, seat[1]); g.rotation.y = d.yaw ? 0 : Math.PI;
      people[k] = { g, legs, seat, yaw: g.rotation.y, path: null, t: 0, sayUntil: 0, say: '', next: 6 + Math.random() * 10 };
    }
    const bub = $('#overlay2');
    const SPOTS = { montes: [-2.6, 1.3], aranda: [0, 1.3], beltran: [2.6, 1.3], lagos: [0, 1.0], board: [4.4, -1.5], screen: [0, -2.8], racks: [-4.4, -1.9] };
    function walk(k, to, back) { const p = people[k]; p.path = { from: [p.g.position.x, p.g.position.z], to, t: 0, back }; }
    let latest = null;
    function lines() {
      const d = latest; if (!d) return null;
      return {
        montes: d.liq ? 'Flujo 1 h ' + n2(d.liq.imb60) + (d.liq.real && d.liq.real.compra1h != null ? ' · compra real ' + pc(d.liq.real.compra1h) : '') + ' · largo ' + n2(d.montes && d.montes.L) + ' / corto ' + n2(d.montes && d.montes.S) : 'Sin datos de liquidez.',
        aranda: d.tec ? 'RSI 1 h ' + dec(d.tec.rsi1h, 0) + ' · rango 24 h ' + pc(d.tec.pos24h) + ' · largo ' + n2(d.aranda && d.aranda.L) + ' / corto ' + n2(d.aranda && d.aranda.S) : 'Sin datos técnicos.',
        beltran: (d.beltran || 'Sin decisión').replace(/^Veto: /, 'Veto: '), lagos: d.hora + ': ' + (d.dir === 'ninguna' ? 'sin operación' : d.dir + ' en ' + fmt(d.entry)) + ' · EV ' + sR(d.ev) + ' · ' + (d.ver || '')
      };
    }
    function drawWall() {
      const g = wall.g, W = 1024, H = 400; g.fillStyle = '#0b1220'; g.fillRect(0, 0, W, H); g.fillStyle = '#7dd3fc'; g.font = '600 26px monospace'; g.fillText('DECISIONES CADA 10 MIN · ' + (A2.estado && A2.estado.champion ? A2.estado.champion.ver : ''), 24, 40);
      const rows = A2.decisions.slice(0, 9); g.font = '22px monospace';
      rows.forEach((d, i) => { const y = 82 + i * 34; g.fillStyle = '#94a3b8'; g.fillText(d.hora || '', 24, y); g.fillStyle = d.dir === 'largo' ? '#3cc49d' : d.dir === 'corto' ? '#f07466' : '#cbd5e1'; g.fillText((d.dir || '').padEnd(8), 120, y); g.fillStyle = '#e2e8f0'; g.fillText('EV ' + sR(d.ev).padStart(7) + '  p ' + pc(d.pw).padStart(4) + '  ' + (d.reg ? d.reg.nombre : '').slice(0, 34), 260, y); });
      if (!rows.length) { g.fillStyle = '#cbd5e1'; g.fillText('Esperando la primera ronda…', 24, 100); }
      wall.tx.needsUpdate = true;
      const b = rb.g; b.fillStyle = '#f8f9f6'; b.fillRect(0, 0, 512, 320); b.fillStyle = '#b45309'; b.font = '700 28px sans-serif'; b.fillText('BELTRÁN · LÍMITES', 20, 42); b.fillStyle = '#334155'; b.font = '21px sans-serif';
      const ch = A2.estado && A2.estado.books && A2.estado.books.campeon;
      ['1 posición a la vez · 1R = 0,5%', 'EV neto calibrado > +0,05R', 'Parada diaria −2R', 'Mitad de riesgo si cae > 8R', 'Suspensión si cae 12R', 'Cartera: ' + (ch ? sR(ch.eq) + ' · máx ' + sR(ch.peak) : '–')].forEach((t, i) => b.fillText(t, 22, 86 + i * 37)); rb.tx.needsUpdate = true;
      for (const k of Object.keys(scr)) { const c = scr[k].g; c.fillStyle = '#0b1220'; c.fillRect(0, 0, 256, 160); c.fillStyle = AGENTS[k].color === '#1f2937' ? '#7dd3fc' : AGENTS[k].color; c.font = '600 18px sans-serif'; c.fillText(AGENTS[k].role, 12, 26); c.strokeStyle = '#3cc49d'; c.lineWidth = 2; c.beginPath();
        const xs = A2.decisions.slice(0, 24).reverse(); xs.forEach((d, i) => { const v = k === 'montes' ? (d.montes ? d.montes.L - d.montes.S : 0) : k === 'aranda' ? (d.aranda ? d.aranda.L - d.aranda.S : 0) : k === 'beltran' ? (d.ev || 0) : (d.lagos ? d.lagos.L - d.lagos.S : 0); const x = 12 + i * 10, y = 100 - v * 60; i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke(); scr[k].tx.needsUpdate = true; }
    }
    const open = () => { const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' }).formatToParts(new Date()), o = {}; p.forEach(x => o[x.type] = x.value); const h = +o.hour; return !['Sat', 'Sun'].includes(o.weekday) && h >= 7 && h < 21; };
    function update() { latest = A2.decisions[0] || null; drawWall(); const L = lines(); if (L) for (const k of Object.keys(L)) { people[k].say = L[k]; } $('#a2Night').hidden = open(); for (const p of Object.values(people)) p.g.visible = open(); }
    let az = 0.35, el_ = 0.72, dist = 15.5, drag = null;
    const place = () => { cam.position.set(Math.sin(az) * Math.cos(el_) * dist, Math.sin(el_) * dist, Math.cos(az) * Math.cos(el_) * dist); cam.lookAt(0, 0.6, 0); };
    stage.addEventListener('pointerdown', e => { drag = [e.clientX, e.clientY, az, el_]; stage.setPointerCapture(e.pointerId); });
    stage.addEventListener('pointermove', e => { if (!drag) return; az = Math.max(-1.1, Math.min(1.1, drag[2] - (e.clientX - drag[0]) * 0.005)); el_ = Math.max(0.35, Math.min(1.2, drag[3] + (e.clientY - drag[1]) * 0.004)); place(); });
    const end = () => { drag = null; }; stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
    function resize() { const r = stage.getBoundingClientRect(); R.setSize(r.width, r.height, false); cam.aspect = r.width / Math.max(1, r.height); dist = cam.aspect < 1.2 ? 21 : 15.5; cam.updateProjectionMatrix(); place(); }
    new ResizeObserver(resize).observe(stage); resize();
    let last = 0, clock = 0, turn = 0; const ORDER = ['lagos', 'montes', 'aranda', 'beltran'];
    function step(dt) {
      clock += dt; leds.forEach((l, i) => { l.visible = reduce || ((clock * 3 + i * 1.7) % 2) > 0.4; });
      for (const [k, p] of Object.entries(people)) {
        if (p.path) { p.path.t += dt / 2.2; const f = Math.min(1, p.path.t), x = p.path.from[0] + (p.path.to[0] - p.path.from[0]) * f, z = p.path.from[1] + (p.path.to[1] - p.path.from[1]) * f; p.g.position.set(x, 0, z); p.g.rotation.y = Math.atan2(p.path.to[0] - p.path.from[0], p.path.to[1] - p.path.from[1]); p.legs[0].rotation.x = Math.sin(clock * 9) * 0.5; p.legs[1].rotation.x = -Math.sin(clock * 9) * 0.5;
          if (f >= 1) { const b = p.path.back; p.path = null; p.legs.forEach(l => l.rotation.x = 0); if (b) setTimeout(() => walk(k, p.seat, false), 4000); else p.g.rotation.y = p.yaw; } }
        else if (!reduce && clock > p.next && open()) { p.next = clock + 14 + Math.random() * 16; const dest = k === 'lagos' ? SPOTS[['screen', 'racks', 'board'][Math.floor(Math.random() * 3)]] : k === 'beltran' && Math.random() < 0.5 ? SPOTS.board : SPOTS.lagos; walk(k, [dest[0] + (Math.random() - .5) * .6, dest[1] + (Math.random() - .5) * .4], true); }
      }
      if (clock > turn) { turn = clock + 6; const k = ORDER.shift(); ORDER.push(k); for (const q of Object.keys(people)) people[q].sayUntil = q === k ? clock + 6 : 0; }
    }
    function overlay() {
      bub.textContent = ''; const r = stage.getBoundingClientRect();
      for (const [k, p] of Object.entries(people)) {
        if (!p.g.visible) continue; const v = new T3.Vector3(p.g.position.x, 2.05, p.g.position.z).project(cam), x = (v.x + 1) / 2 * r.width, y = (1 - v.y) / 2 * r.height;
        bub.append(el('span', { class: 'tag3d a2', style: `left:${x}px;top:${y + 26}px`, text: AGENTS[k].name }));
        if (p.sayUntil > clock && p.say) bub.append(el('span', { class: 'bub a2b', style: `left:${x}px;top:${y - 8}px;border-color:${AGENTS[k].color}`, text: p.say }));
      }
    }
    let vis = true; new IntersectionObserver(es => { vis = es.some(e => e.isIntersecting); }).observe(stage);
    let first = 3; function frame(ts) { requestAnimationFrame(frame); if (!vis && !(first-- > 0)) return; const dt = Math.min(0.05, (ts - last) / 1000 || 0); last = ts; step(dt); R.render(scene, cam); overlay(); }
    requestAnimationFrame(frame); $('#fallback2').hidden = true;
    return { update };
  })();

  // ---------- datos ----------
  if (window.MESA) window.MESA.listeners.push(() => renderComp());
  let tries = 0;
  (function hook() {
    const db = window.MESA && window.MESA.S && window.MESA.S.db;
    if (!db) { if (++tries < 80) setTimeout(hook, 500); else { $('#a2Lagos').textContent = 'Sin conexión con la base de datos del ala 2.'; renderAll(); } return; }
    db.collection('ala2').orderBy('t', 'desc').limit(300).onSnapshot(s => { A2.decisions = s.docs.map(d => d.data()).filter(d => d.t); renderAll(); }, () => {});
    db.collection('ala2').doc('estado').onSnapshot(s => { A2.estado = s.exists ? s.data() : null; renderAll(); }, () => {});
  })();
  renderAll();
})();

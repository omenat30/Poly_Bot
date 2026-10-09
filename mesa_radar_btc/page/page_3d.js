(() => {
  // Oficina 3D: escritorios, pantalla mural con el precio, pizarra con la operativa, ventanas con la luz de Madrid,
  // y cinco monigotes que leen datos en su mesa, se levantan a contar su nota a otro, van a por café o a la pizarra,
  // se reúnen en la mesa central cuando llega una ronda con novedades y corren a la sala de emergencias si BTC da un tirón.
  const stage = document.getElementById('stage'), overlay = document.getElementById('overlay');
  const M = window.MESA;
  if (!window.THREE || !M) { document.getElementById('fallback').textContent = 'La oficina en 3D no se ha podido cargar en esta vista. Las notas de la ronda siguen a la derecha.'; return; }
  document.getElementById('fallback').hidden = true;
  const T3 = THREE, reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888';
  const renderer = new T3.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = T3.PCFSoftShadowMap;
  stage.prepend(renderer.domElement);
  const scene = new T3.Scene(), cam = new T3.PerspectiveCamera(38, 1.6, 0.1, 100);
  const hemi = new T3.HemisphereLight(0xffffff, 0x8899aa, 0.75); scene.add(hemi);
  const sun = new T3.DirectionalLight(0xffffff, 0.7); sun.position.set(6, 12, 8); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 9, bottom: -9 }); scene.add(sun);
  const mats = {}; const mat = (k, c, o = {}) => (mats[k] = mats[k] || new T3.MeshStandardMaterial(Object.assign({ color: c, roughness: .85 }, o)));
  const box = (w, h, d, m, x, y, z, parent = scene) => { const b = new T3.Mesh(new T3.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; parent.add(b); return b; };
  const cyl = (r1, r2, h, m, x, y, z, parent = scene, seg = 14) => { const c = new T3.Mesh(new T3.CylinderGeometry(r1, r2, h, seg), m); c.position.set(x, y, z); c.castShadow = true; parent.add(c); return c; };

  // ---- canvases for screens ----
  const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const tx = new T3.CanvasTexture(c); return { c, g: c.getContext('2d'), tx }; };
  const wallScr = mkCanvas(512, 256), board = mkCanvas(512, 320), deskScr = {};

  // ---- room ----
  const W = 18, D = 12, DX = 16; // DX: la planta llega hasta z = 10 por la sala de emergencias
  const floor = new T3.Mesh(new T3.PlaneGeometry(W, DX), mat('floor', css('--floor'))); floor.rotation.x = -Math.PI / 2; floor.position.z = 2; floor.receiveShadow = true; scene.add(floor);
  const grid = new T3.GridHelper(18, 18, 0x000000, 0x000000); grid.material.opacity = .06; grid.material.transparent = true; grid.position.set(0, 0.002, 2); grid.scale.z = DX / W; scene.add(grid);
  box(W, 3.2, 0.2, mat('wall', css('--wall')), 0, 1.6, -D / 2);
  box(0.2, 3.2, DX, mat('wall'), -W / 2, 1.6, 2);
  // windows (back wall, right) – colour follows Madrid time
  const winMat = new T3.MeshBasicMaterial({ color: 0x9cc3ea });
  for (const x of [4.2, 6.2, 8.0]) { box(1.6, 1.5, 0.05, winMat, x - 0.4, 1.75, -D / 2 + 0.12); box(1.7, 0.08, 0.12, mat('frame', '#7d8894'), x - 0.4, 2.52, -D / 2 + 0.14); box(1.7, 0.08, 0.12, mat('frame'), x - 0.4, 0.98, -D / 2 + 0.14); }
  // wall screen with BTC
  const scr = new T3.Mesh(new T3.PlaneGeometry(3.6, 1.8), new T3.MeshBasicMaterial({ map: wallScr.tx })); scr.position.set(0, 2.05, -D / 2 + 0.13); scene.add(scr);
  box(3.8, 2.0, 0.08, mat('bezel', '#1a1f26'), 0, 2.05, -D / 2 + 0.09);
  // whiteboard
  const wb = new T3.Mesh(new T3.PlaneGeometry(2.6, 1.6), new T3.MeshBasicMaterial({ map: board.tx })); wb.position.set(-3.6, 1.65, -D / 2 + 0.13); scene.add(wb);
  box(2.75, 1.72, 0.06, mat('frame'), -3.6, 1.65, -D / 2 + 0.09);
  // meeting table
  cyl(1.15, 1.15, 0.06, mat('desk', css('--desk')), 0, 0.74, 3.6); cyl(0.12, 0.3, 0.72, mat('metal', css('--metal')), 0, 0.37, 3.6);
  // coffee corner
  box(1.4, 0.9, 0.6, mat('desk'), 7.6, 0.45, 4.9); box(0.45, 0.55, 0.4, mat('coffee', '#2b2f35'), 7.4, 1.18, 4.9); cyl(0.06, 0.05, 0.12, mat('cup', '#f2f2f2'), 7.9, 0.96, 4.85);
  // plants
  const plant = (x, z) => { cyl(0.22, 0.18, 0.45, mat('pot', '#9a7b5f'), x, 0.22, z); const s = new T3.Mesh(new T3.SphereGeometry(0.42, 12, 10), mat('leaf', '#3f8a5a')); s.position.set(x, 0.85, z); s.scale.y = 1.25; s.castShadow = true; scene.add(s); };
  plant(-8.3, -5.3); plant(8.4, -5.2); plant(-8.3, 5.2); plant(3.0, -5.3);
  // sofa
  box(2.2, 0.45, 0.8, mat('sofa', '#5d6b7c'), -6.8, 0.23, 5.3); box(2.2, 0.6, 0.2, mat('sofa'), -6.8, 0.6, 5.65);

  // ---- sala de emergencias (esquina delantera derecha, paredes de cristal) ----
  const ER = { x0: 1.6, x1: 8.9, z0: 6.3, z1: 10, door: [2.3, 6.3], cx: 5.4, cz: 8.3 };
  const erFloor = new T3.Mesh(new T3.PlaneGeometry(ER.x1 - ER.x0, ER.z1 - ER.z0), new T3.MeshStandardMaterial({ color: 0xb5382d, roughness: .9, transparent: true, opacity: .14 }));
  erFloor.rotation.x = -Math.PI / 2; erFloor.position.set((ER.x0 + ER.x1) / 2, 0.004, (ER.z0 + ER.z1) / 2); scene.add(erFloor);
  const glass = new T3.MeshStandardMaterial({ color: 0xbfd8ee, transparent: true, opacity: .22, roughness: .1, metalness: .1, depthWrite: false });
  const erRed = mat('erRed', '#b5382d');
  const pane = (w, x, z, rotY, h = 2.4) => { const m = new T3.Mesh(new T3.PlaneGeometry(w, h), glass); m.position.set(x, h / 2, z); m.rotation.y = rotY; m.material.side = T3.DoubleSide; scene.add(m); box(rotY ? 0.06 : w, 0.08, rotY ? w : 0.06, erRed, x, h, z); };
  pane(ER.x1 - ER.door[0] - 0.55, (ER.door[0] + 0.55 + ER.x1) / 2, ER.z0, 0);           // pared trasera con hueco de puerta
  pane(ER.door[0] - 0.55 - ER.x0, (ER.x0 + ER.door[0] - 0.55) / 2, ER.z0, 0);
  pane(ER.z1 - ER.z0, ER.x0, (ER.z0 + ER.z1) / 2, Math.PI / 2);                         // pared izquierda
  pane(ER.z1 - ER.z0, ER.x1, (ER.z0 + ER.z1) / 2, Math.PI / 2);                         // pared derecha
  pane(ER.x1 - ER.x0, (ER.x0 + ER.x1) / 2, ER.z1, 0, 0.9);                              // antepecho delantero bajo, para ver dentro
  for (const [x, z] of [[ER.x0, ER.z0], [ER.x1, ER.z0], [ER.x0, ER.z1], [ER.x1, ER.z1], [ER.door[0] - 0.55, ER.z0], [ER.door[0] + 0.55, ER.z0]]) box(0.08, 2.4, 0.08, erRed, x, 1.2, z);
  box(2.6, 0.06, 1.2, mat('desk'), ER.cx, 0.74, ER.cz); for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(0.05, 0.72, 0.05, mat('metal'), ER.cx + sx * 1.2, 0.36, ER.cz + sz * 0.52);
  const erScr = mkCanvas(512, 256), erMon = new T3.Mesh(new T3.PlaneGeometry(2.6, 1.3), new T3.MeshBasicMaterial({ map: erScr.tx }));
  erMon.position.set(ER.cx + 0.6, 1.75, ER.z0 + 0.06); scene.add(erMon); box(2.7, 1.4, 0.05, mat('bezel'), ER.cx + 0.6, 1.75, ER.z0 + 0.02);
  const sign = mkCanvas(512, 64); sign.g.fillStyle = '#b5382d'; sign.g.fillRect(0, 0, 512, 64); sign.g.fillStyle = '#fff'; sign.g.font = '700 34px sans-serif'; sign.g.textAlign = 'center'; sign.g.fillText('SALA DE EMERGENCIAS', 256, 44); sign.tx.needsUpdate = true;
  const signM = new T3.Mesh(new T3.PlaneGeometry(2.4, 0.3), new T3.MeshBasicMaterial({ map: sign.tx, side: T3.DoubleSide })); signM.position.set(ER.door[0] + 1.9, 2.62, ER.z0); scene.add(signM);
  const beaconMat = new T3.MeshStandardMaterial({ color: 0x7a1d16, emissive: 0x000000, roughness: .4 });
  const beacon = cyl(0.12, 0.14, 0.2, beaconMat, ER.door[0], 2.55, ER.z0, scene, 16);
  const alarm = new T3.PointLight(0xff3b2f, 0, 9); alarm.position.set(ER.cx, 2.3, ER.cz); scene.add(alarm);


  // ---- desks and seats ----
  const DESKS = {
    vega: { x: 0, z: -3.8, face: 0, seat: [0, -4.75], visit: [1.25, -4.3] },
    ortega: { x: -5.0, z: -1.3, face: 1, seat: [-6.0, -1.3], visit: [-6.0, -0.35] },
    rios: { x: -5.0, z: 2.3, face: 1, seat: [-6.0, 2.3], visit: [-6.0, 1.35] },
    paz: { x: 5.0, z: -1.3, face: -1, seat: [6.0, -1.3], visit: [6.0, -0.35] },
    calvo: { x: 5.0, z: 2.3, face: -1, seat: [6.0, 2.3], visit: [6.0, 1.35] }
  };
  const CORR = 0.55; // pasillo central (z)
  for (const k of M.ORDER) {
    const d = DESKS[k], g = new T3.Group(); g.position.set(d.x, 0, d.z); scene.add(g);
    const along = d.face === 0; // vega: desk along x
    const dw = along ? 2.0 : 0.85, dd = along ? 0.85 : 1.7;
    box(dw, 0.06, dd, mat('desk'), 0, 0.74, 0, g);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(0.05, 0.72, 0.05, mat('metal'), sx * (dw / 2 - 0.06), 0.36, sz * (dd / 2 - 0.06), g);
    // monitors face the seat
    const c = mkCanvas(256, 160); deskScr[k] = c;
    const mon = new T3.Mesh(new T3.PlaneGeometry(0.75, 0.46), new T3.MeshBasicMaterial({ map: c.tx }));
    const stand = cyl(0.03, 0.03, 0.2, mat('metal'), 0, 0.86, 0, g);
    if (along) { mon.position.set(0, 1.18, 0.28); stand.position.set(0, 0.86, 0.3); mon.rotation.y = Math.PI; box(0.8, 0.5, 0.03, mat('bezel'), 0, 1.18, 0.3, g); }
    else { mon.position.set(-d.face * 0.28 * -1 + 0, 1.18, 0); mon.position.x = d.face * 0.26; mon.rotation.y = d.face === 1 ? -Math.PI / 2 : Math.PI / 2; stand.position.set(d.face * 0.3, 0.86, 0); box(0.03, 0.5, 0.8, mat('bezel'), d.face * 0.3, 1.18, 0, g); }
    g.add(mon);
    // chair at the seat
    const cg = new T3.Group(); cg.position.set(d.seat[0], 0, d.seat[1]); scene.add(cg);
    box(0.5, 0.06, 0.5, mat('chair', '#39424d'), 0, 0.46, 0, cg); cyl(0.04, 0.04, 0.42, mat('metal'), 0, 0.23, 0, cg);
    const back = box(0.5, 0.55, 0.06, mat('chair'), 0, 0.78, 0, cg);
    const yaw = along ? 0 : d.face === 1 ? Math.PI / 2 : -Math.PI / 2; cg.rotation.y = yaw; back.position.z = -0.25;
    d.yaw = yaw;
    // name plate
    const plate = mkCanvas(256, 64); plate.g.fillStyle = M.AG[k].color; plate.g.fillRect(0, 0, 256, 64); plate.g.fillStyle = '#fff'; plate.g.font = '600 34px sans-serif'; plate.g.textAlign = 'center'; plate.g.fillText(M.AG[k].name, 128, 44); plate.tx.needsUpdate = true;
    const pl = new T3.Mesh(new T3.PlaneGeometry(0.5, 0.125), new T3.MeshBasicMaterial({ map: plate.tx }));
    if (along) { pl.position.set(0, 0.79, 0.43); } else { pl.position.set(-d.face * 0.43, 0.79, 0); pl.rotation.y = d.face === 1 ? -Math.PI / 2 : Math.PI / 2; }
    g.add(pl);
  }
  const SPOTS = { coffee: [7.2, 4.35], board: [-3.6, -5.0], table: a => [Math.cos(a) * 1.6, 3.6 - Math.abs(Math.sin(a)) * 1.6], sofa: [-6.8, 4.6], er: { vega: [4.1, 7.35], ortega: [5.4, 7.3], paz: [6.7, 7.35], rios: [3.5, 8.6], calvo: [7.3, 8.3] } };

  // ---- people (monigotes) ----
  const skin = mat('skin', '#e2b999'), pants = mat('pants', '#2e3640');
  function person(color) {
    const g = new T3.Group(), shirt = new T3.MeshStandardMaterial({ color, roughness: .7 });
    const hipL = new T3.Group(), hipR = new T3.Group(); hipL.position.set(-0.11, 0.86, 0); hipR.position.set(0.11, 0.86, 0); g.add(hipL, hipR);
    for (const hp of [hipL, hipR]) { const leg = cyl(0.075, 0.065, 0.82, pants, 0, -0.41, 0, hp, 10); const shoe = box(0.13, 0.08, 0.24, mat('shoe', '#1d2228'), 0, -0.82, 0.05, hp); leg.castShadow = shoe.castShadow = true; }
    const torso = cyl(0.2, 0.17, 0.62, shirt, 0, 1.17, 0, g); torso.scale.z = 0.7;
    const head = new T3.Mesh(new T3.SphereGeometry(0.16, 16, 12), skin); head.position.set(0, 1.66, 0); head.castShadow = true; g.add(head);
    const hair = new T3.Mesh(new T3.SphereGeometry(0.165, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.1), mat('hair' + color, '#2a2420')); hair.position.copy(head.position); hair.position.y += 0.01; g.add(hair);
    const shL = new T3.Group(), shR = new T3.Group(); shL.position.set(-0.26, 1.42, 0); shR.position.set(0.26, 1.42, 0); g.add(shL, shR);
    for (const s of [shL, shR]) { cyl(0.06, 0.05, 0.6, shirt, 0, -0.3, 0, s, 10); const hand = new T3.Mesh(new T3.SphereGeometry(0.055, 8, 6), skin); hand.position.y = -0.62; s.add(hand); }
    scene.add(g);
    return { g, hipL, hipR, shL, shR, head, torso };
  }
  const P = {};
  M.ORDER.forEach((k, i) => {
    const d = DESKS[k], p = person(M.AG[k].color); p.g.rotation.y = d.yaw;
    P[k] = { k, ...p, pos: new T3.Vector2(d.seat[0], d.seat[1]), path: [], state: 'sit', until: performance.now() / 1000 + 4 + i * 7, yaw: d.yaw, say: null, sayUntil: 0, phase: Math.random() * 6, after: null, target: null };
  });
  // overlay labels
  const tags = {}, bubs = {};
  for (const k of M.ORDER) { tags[k] = document.createElement('span'); tags[k].className = 'tag3d'; tags[k].textContent = M.AG[k].name; overlay.append(tags[k]); bubs[k] = document.createElement('div'); bubs[k].className = 'bub'; bubs[k].style.opacity = '0'; overlay.append(bubs[k]); }

  // ---- behaviour ----
  const now = () => performance.now() / 1000;
  const corr = ([x, z]) => [x, CORR];
  const door = q => (q[1] < -3.3 && Math.abs(q[0]) < 1.6) ? [1.45, q[1]] : q;
  const inER = q => q[1] > ER.z0 - 0.05 && q[0] > ER.x0;
  const LANE = ER.z0 + 0.65, erIn = q => [[ER.door[0], ER.z0 - 0.9], [ER.door[0], LANE], [q[0], LANE]], erOut = q => erIn(q).reverse();
  function route(from, to) {
    const f = [from.x, from.y], A = inER(f) ? erOut(f) : [door(f)], B = inER(to) ? erIn(to) : [door(to)];
    const pts = (inER(f) && inER(to)) ? [to] : [...A, corr(A[A.length - 1]), corr(B[0]), ...B, to];
    return pts.filter((p, i, arr) => i === 0 ? (p[0] !== from.x || p[1] !== from.y) : (p[0] !== arr[i - 1][0] || p[1] !== arr[i - 1][1]));
  }
  function goTo(p, to, then, faceYaw) { p.path = route(p.pos, to); p.state = 'walk'; p.after = then; p.faceYaw = faceYaw; }
  function say(k, text, level, secs = 7) { const p = P[k]; p.say = { text, level }; p.sayUntil = now() + secs; }
  const short = (t, n = 120) => { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
  const noteOf = k => { const t = M.S.ticks[0]; return t && t.notes && t.notes[k]; };
  const busy = k => P[k].state !== 'sit' || P[k].reserved;
  function backToDesk(k, then) { const d = DESKS[k]; goTo(P[k], d.seat, () => { P[k].state = 'sit'; P[k].yaw = d.yaw; P[k].until = now() + 12 + Math.random() * 20; then && then(); }); }
  const yawTo = (from, to) => Math.atan2(to[0] - from[0], to[1] - from[1]);
  function visit(k, other) {
    const n = noteOf(k), od = DESKS[other]; P[other].reserved = true;
    goTo(P[k], od.visit, () => {
      P[k].state = 'talk'; P[k].yaw = yawTo(od.visit, od.seat);
      say(k, n ? short(n.text) : 'Te cuento lo que he visto en BTC.', n && n.level);
      setTimeout(() => { say(other, other === 'calvo' ? 'Lo apunto en el marcador.' : other === 'vega' ? 'Recibido. Riesgo sin cambios.' : 'Anotado.', 'ok', 4); }, 3500);
      setTimeout(() => { P[other].reserved = false; backToDesk(k); }, 7600);
    });
  }
  function wander(k) {
    const r = Math.random(), p = P[k];
    if (r < 0.5) { const others = M.ORDER.filter(o => o !== k && !busy(o)); if (others.length) return visit(k, others[Math.floor(Math.random() * others.length)]); }
    if (r < 0.72) return goTo(p, SPOTS.coffee, () => { p.state = 'talk'; p.yaw = Math.PI / 2; say(k, 'Café y vuelvo a la pantalla.', 'ok', 3); setTimeout(() => backToDesk(k), 4200); });
    if (r < 0.9) return goTo(p, SPOTS.board, () => { p.state = 'talk'; p.yaw = Math.PI; const n = noteOf(k); say(k, n ? short(n.text, 90) : 'Repasando la operativa en la pizarra.', n && n.level, 5); setTimeout(() => backToDesk(k), 5600); });
    p.until = now() + 10;
  }
  // a new round: everyone back, reading data, then the ones with news present them at the table
  let lastTickAt = null, meeting = false;
  function newRound(t) {
    for (const k of M.ORDER) { if (P[k].state !== 'sit') backToDesk(k); P[k].reading = now() + 9; }
    setTimeout(() => {
      M.ORDER.forEach((k, i) => { const n = t.notes && t.notes[k]; if (n) setTimeout(() => say(k, short(n.text, 110), n.level, 6), i * 3800); });
      const hot = M.ORDER.filter(k => t.notes && t.notes[k] && (t.notes[k].level === 'trade' || t.notes[k].level === 'alerta'));
      if (hot.length && !reduce && !erActive) {
        meeting = true; let i = 0;
        for (const k of M.ORDER) { const a = Math.PI + (i++) * (Math.PI / 4); const spot = SPOTS.table(a); setTimeout(() => goTo(P[k], spot, () => { P[k].state = 'talk'; P[k].yaw = yawTo(spot, [0, 3.6]); }), 19000 + i * 400); }
        setTimeout(() => { hot.forEach((k, j) => setTimeout(() => say(k, short(t.notes[k].text, 130), t.notes[k].level, 8), j * 8500)); }, 27000);
        setTimeout(() => { meeting = false; M.ORDER.forEach(k => backToDesk(k)); }, 27000 + hot.length * 8500 + 4000);
      }
    }, 9500);
  }
  // sala de emergencias: prioridad absoluta, todos dejan lo que hacen
  let erActive = null, erTimers = [];
  const clearER = () => { erTimers.forEach(clearTimeout); erTimers = []; };
  const VOTE = { largo: 'LARGO', corto: 'CORTO', mantener: 'MANTENER', nada: 'NADA' };
  function convene(e) {
    clearER(); meeting = true; erActive = e;
    for (const k of M.ORDER) { const p = P[k], spot = SPOTS.er[k]; p.reserved = false; p.rush = true; goTo(p, spot, () => { p.state = 'talk'; p.rush = false; p.yaw = yawTo(spot, [ER.cx, ER.cz]); }); }
    say('calvo', '¡Todos a la sala! BTC ' + (e.move >= 0 ? '+' : '−') + Math.abs(e.move * 100).toFixed(1).replace('.', ',') + '% en ' + e.hours + ' h.', 'emergencia', 6);
    const loop = () => {
      let d = 9000;
      for (const k of M.TRADERS) { const v = e.votes && e.votes[k]; if (!v) continue; erTimers.push(setTimeout(() => say(k, VOTE[v.vote] + ' · ' + short(v.why, 110), 'emergencia', 7), d)); d += 7200; }
      erTimers.push(setTimeout(() => say('calvo', 'Veredicto: ' + e.verdict + '. ' + short(e.verdictText, 120), 'emergencia', 9), d));
      erTimers.push(setTimeout(() => { if (erActive) loop(); }, d + 14000));
    };
    loop();
  }
  function dismiss() { clearER(); erActive = null; meeting = false; M.ORDER.forEach(k => { P[k].rush = false; backToDesk(k); }); }
  function checkER() {
    const e = M.emergency();
    if (e && (!erActive || erActive.id !== e.id) && !reduce) convene(e);
    else if (e && reduce && !erActive) { erActive = e; say('calvo', 'Sala de emergencias: ' + e.verdict + '.', 'emergencia', 12); }
    else if (!e && erActive) dismiss();
    drawER();
  }
  setInterval(checkER, 20000);
  function onData(S) {
    const t = S.ticks[0];
    checkER();
    if (t && t.at !== lastTickAt && !erActive) { const first = lastTickAt == null; lastTickAt = t.at; if (!first || (Date.now() - new Date(t.at)) < 20 * 60e3) newRound(t); else M.ORDER.forEach((k, i) => { if (t.notes && t.notes[k]) setTimeout(() => say(k, short(t.notes[k].text, 110), t.notes[k].level, 6), 800 + i * 3800); }); }
    drawBoard(S); drawWall(S); drawER(); for (const k of M.ORDER) drawDesk(k, S);
    if (S.sel) { const n = noteOf(S.sel); say(S.sel, n ? short(n.text, 160) : M.AG[S.sel].job, n && n.level, 10); }
  }
  M.listeners.push(onData);

  // ---- screens ----
  function drawWall(S) {
    const { g, c, tx } = wallScr, ink = '#e8eef5';
    g.fillStyle = '#0d141c'; g.fillRect(0, 0, c.width, c.height);
    const pts = S.ticks.slice().reverse().map(t => t.price).filter(Number.isFinite);
    g.fillStyle = ink; g.font = '600 22px monospace'; g.fillText('BTCUSDT · Binance futuros', 18, 34);
    g.font = '700 40px monospace'; g.fillText(pts.length ? Math.round(pts[pts.length - 1]).toLocaleString('es-ES') : '—', 18, 82);
    if (pts.length > 1) {
      const lo = Math.min(...pts), hi = Math.max(...pts), X = i => 18 + i / (pts.length - 1) * (c.width - 36), Y = v => 236 - (v - lo) / (hi - lo || 1) * 120;
      g.strokeStyle = pts[pts.length - 1] >= pts[0] ? '#3cc49d' : '#f07466'; g.lineWidth = 3; g.beginPath(); pts.forEach((v, i) => i ? g.lineTo(X(i), Y(v)) : g.moveTo(X(i), Y(v))); g.stroke();
      g.fillStyle = '#93a3b4'; g.font = '16px monospace'; g.fillText('últimas ' + pts.length + ' rondas', c.width - 190, 34);
    } else { g.fillStyle = '#93a3b4'; g.font = '18px monospace'; g.fillText('El gráfico se llena con cada ronda', 18, 150); }
    tx.needsUpdate = true;
  }
  function drawBoard(S) {
    const { g, c, tx } = board, t = S.ticks[0];
    g.fillStyle = '#f7f8f6'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#1e3a8a'; g.font = '700 30px sans-serif'; g.fillText('OPERATIVA BTC', 20, 42);
    g.font = '20px sans-serif'; const lines = [];
    for (const k of M.TRADERS) { const n = t && t.notes && t.notes[k], p = n && n.pos; lines.push([M.AG[k].name + ': ' + (p ? (p.side === 'short' ? 'CORTO ' : 'LARGO ') + Math.round(p.entry).toLocaleString('es-ES') + ' · stop ' + Math.round(p.stop).toLocaleString('es-ES') : 'fuera'), p ? (p.side === 'short' ? '#b5382d' : '#0b7a57') : '#334155']); }
    lines.push(['Riesgo 0,5% Vega/Ortega · 0,25% Paz/Ríos', '#7c2d12']); lines.push(['Stops en el exchange, solo a favor', '#7c2d12']);
    lines.forEach(([s, col], i) => { g.fillStyle = col; g.fillText(s, 20, 84 + i * 37); });
    tx.needsUpdate = true;
  }
  function drawDesk(k, S) {
    const { g, c, tx } = deskScr[k], n = noteOf(k), col = M.AG[k].color;
    g.fillStyle = '#0d141c'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = col; g.fillRect(0, 0, c.width, 8);
    g.fillStyle = '#e8eef5'; g.font = '600 18px monospace'; g.fillText(M.AG[k].role, 10, 32);
    const pts = S.ticks.slice(0, 40).reverse().map(t => t.price);
    if (pts.length > 1) { const lo = Math.min(...pts), hi = Math.max(...pts); g.strokeStyle = col; g.lineWidth = 2.5; g.beginPath(); pts.forEach((v, i) => { const x = 10 + i / (pts.length - 1) * 236, y = 140 - (v - lo) / (hi - lo || 1) * 80; i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); }
    g.fillStyle = n && n.level === 'trade' ? '#3cc49d' : n && n.level === 'idea' ? '#7d9dff' : '#93a3b4'; g.font = '14px monospace'; g.fillText(n ? (n.level === 'trade' ? 'OPERANDO' : n.level === 'idea' ? 'VIGILANDO' : 'LEYENDO DATOS') : 'ESPERANDO RONDA', 10, 54);
    tx.needsUpdate = true;
  }

  function drawER() {
    const { g, c, tx } = erScr, e = erActive || M.emergency(), last = (M.S.ticks.find(t => t.emergency) || {}).emergency;
    g.fillStyle = e ? '#2a0d0b' : '#0d141c'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#ff6b5e'; g.font = '700 26px monospace'; g.fillText(e ? '⚠ MOVIMIENTO BRUSCO' : 'SIN EMERGENCIAS', 18, 40);
    const x = e || last;
    g.fillStyle = '#e8eef5'; g.font = '600 20px monospace';
    if (x) {
      g.fillText((e ? '' : 'Última: ') + 'BTC ' + (x.move >= 0 ? '+' : '−') + Math.abs(x.move * 100).toFixed(1) + '% en ' + x.hours + ' h · ' + Math.abs(x.z).toFixed(1) + 'σ', 18, 76);
      let y = 108; for (const k of M.TRADERS) { const v = x.votes && x.votes[k]; if (!v) continue; g.fillStyle = M.AG[k].color; g.fillRect(18, y - 15, 12, 12); g.fillStyle = '#e8eef5'; g.fillText(M.AG[k].name + ': ' + VOTE[v.vote], 38, y); y += 28; }
      g.fillStyle = '#ffd36b'; g.font = '700 22px monospace'; g.fillText('VEREDICTO: ' + x.verdict, 18, 236);
    } else { g.fillStyle = '#93a3b4'; g.fillText('Se reúnen con un tirón de 3,5σ en 1–3 h', 18, 90); }
    tx.needsUpdate = true;
  }
  // ---- theme and time of day ----
  function applyTheme() {
    mats.floor.color.set(css('--floor')); mats.wall.color.set(css('--wall')); mats.desk.color.set(css('--desk')); mats.metal.color.set(css('--metal'));
    const m = (() => { const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date()).split(':').map(Number); return p[0] + p[1] / 60; })();
    const day = Math.max(0, Math.min(1, Math.min(m - 6.5, 21 - m) / 1.5));
    winMat.color.set(new T3.Color(0x16233a).lerp(new T3.Color(0xa8cdf0), day));
    scene.background = new T3.Color(css('--bg'));
    const open = m >= 7 && m < 20; document.getElementById('night').hidden = open;
    for (const k of M.ORDER) P[k].g.visible = open, tags[k].hidden = !open, bubs[k].hidden = !open;
    hemi.intensity = open ? 0.75 : 0.35; sun.intensity = open ? 0.7 : 0.15;
    document.getElementById('capR').textContent = open ? 'Rondas cada 15 min · 7:00–20:00' : 'Fuera de horario';
  }
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  setInterval(applyTheme, 60000);

  // ---- camera (drag to orbit) ----
  let az = -0.3, el = 0.92, dist = 23, dragging = null;
  const placeCam = () => { cam.position.set(Math.sin(az) * Math.cos(el) * dist + 0.8, Math.sin(el) * dist, Math.cos(az) * Math.cos(el) * dist + 3.4); cam.lookAt(0.8, 0.4, 3.0); };
  stage.addEventListener('pointerdown', e => { dragging = [e.clientX, e.clientY, az, el]; stage.classList.add('drag'); stage.setPointerCapture(e.pointerId); });
  stage.addEventListener('pointermove', e => { if (!dragging) return; az = dragging[2] - (e.clientX - dragging[0]) * 0.005; el = Math.max(0.35, Math.min(1.25, dragging[3] + (e.clientY - dragging[1]) * 0.004)); az = Math.max(-1.2, Math.min(1.2, az)); placeCam(); });
  const endDrag = () => { dragging = null; stage.classList.remove('drag'); };
  stage.addEventListener('pointerup', endDrag); stage.addEventListener('pointercancel', endDrag);
  function resize() { const r = stage.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); cam.aspect = r.width / Math.max(1, r.height); dist = cam.aspect < 1.2 ? 29 : 23; cam.updateProjectionMatrix(); placeCam(); }
  new ResizeObserver(resize).observe(stage); resize();

  // ---- loop ----
  const v3 = new T3.Vector3();
  function step(dt) {
    const tnow = now();
    const blink = erActive ? (Math.sin(tnow * 6) > 0 ? 1 : 0) : 0; beaconMat.emissive.setHex(blink ? 0xff2a1a : erActive ? 0x400806 : 0x000000); alarm.intensity = erActive ? (reduce ? 0.6 : 0.4 + blink * 1.4) : 0;
    for (const k of M.ORDER) {
      const p = P[k];
      p.phase += dt * (p.state === 'walk' ? (p.rush ? 12 : 7.5) : 2);
      if (p.state === 'walk') {
        const tgt = p.path[0];
        if (!tgt) { p.state = 'stand'; const f = p.after; p.after = null; f ? f() : backToDesk(k); }
        else { const dx = tgt[0] - p.pos.x, dz = tgt[1] - p.pos.y, d = Math.hypot(dx, dz), sp = (p.rush ? 2.6 : 1.25) * dt; if (d <= sp) { p.pos.set(tgt[0], tgt[1]); p.path.shift(); } else { p.pos.x += dx / d * sp; p.pos.y += dz / d * sp; p.yaw = Math.atan2(dx, dz); } }
      } else if (p.state === 'sit' && !meeting && !reduce && tnow > p.until && !p.reserved) wander(k);
      // pose
      const sit = p.state === 'sit', walk = p.state === 'walk', sw = walk ? Math.sin(p.phase) * 0.55 : 0;
      p.g.position.set(p.pos.x, sit ? -0.38 : 0, p.pos.y);
      p.g.rotation.y += ((p.yaw - p.g.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 8);
      p.hipL.rotation.x = sit ? -1.45 : sw; p.hipR.rotation.x = sit ? -1.45 : -sw;
      const typing = sit && (p.reading > tnow || Math.sin(p.phase * 0.7) > 0.2);
      p.shL.rotation.x = sit ? -1.1 + (typing ? Math.sin(p.phase * 9) * 0.08 : 0) : p.state === 'talk' ? -0.35 + Math.sin(p.phase * 2.5) * 0.25 : -sw;
      p.shR.rotation.x = sit ? -1.1 + (typing ? Math.cos(p.phase * 9) * 0.08 : 0) : walk ? sw : -0.15;
      p.head.rotation.x = p.state === 'talk' ? Math.sin(p.phase * 3) * 0.08 : 0;
    }
  }
  function overlayPos() {
    const r = stage.getBoundingClientRect(), tnow = now();
    for (const k of M.ORDER) {
      const p = P[k]; v3.set(p.pos.x, (p.state === 'sit' ? 1.3 : 1.7) + 0.3, p.pos.y).project(cam);
      const x = (v3.x * 0.5 + 0.5) * r.width, y = (-v3.y * 0.5 + 0.5) * r.height;
      tags[k].style.transform = `translate(${x}px, ${y + 34}px) translate(-50%, 0)`;
      const b = bubs[k], on = p.say && p.sayUntil > tnow;
      if (on) { if (b.dataset.t !== p.say.text) { b.dataset.t = p.say.text; b.className = 'bub ' + (p.say.level || ''); b.textContent = ''; const nm = document.createElement('b'); nm.textContent = M.AG[k].name; b.append(nm, p.say.text); } b.style.transform = `translate(${Math.max(120, Math.min(r.width - 120, x))}px, ${y - 8}px) translate(-50%, -100%)`; }
      b.style.opacity = on ? '1' : '0';
    }
  }
  let last = performance.now(), visible = true;
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; last = performance.now(); });
  function frame(ts) { requestAnimationFrame(frame); if (!visible) return; const dt = Math.min(0.05, (ts - last) / 1000); last = ts; step(dt); renderer.render(scene, cam); overlayPos(); }
  applyTheme(); onData(M.S); requestAnimationFrame(frame);
  // demo-free idle: if there is no round yet, each agent introduces their job once
  setTimeout(() => { if (!M.S.ticks.length) M.ORDER.forEach((k, i) => setTimeout(() => say(k, M.AG[k].job, 'ok', 7), i * 2500)); }, 1500);
})();

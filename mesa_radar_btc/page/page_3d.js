(() => {
  // Oficina 3D: escritorios, pantalla mural con el precio, pizarra con la operativa, ventanas con la luz de Madrid,
  // y siete monigotes que leen datos en su mesa, se levantan a contar su nota a otro, van a por café o a la pizarra,
  // se reúnen en la mesa central cuando llega una ronda con novedades y corren a la sala de emergencias si BTC da un tirón.
  const stage = document.getElementById('stage'), overlay = document.getElementById('overlay');
  const M = window.MESA;
  if (!window.THREE || !M) { document.getElementById('fallback').textContent = 'La oficina en 3D no se ha podido cargar en esta vista. Las notas de la ronda siguen a la derecha.'; return; }
  document.getElementById('fallback').hidden = true;
  const T3 = THREE, reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888';
  const renderer = new T3.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = T3.PCFSoftShadowMap;
  renderer.outputEncoding = T3.sRGBEncoding; renderer.toneMapping = T3.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.physicallyCorrectLights = false;
  const lin = c => new T3.Color(c).convertSRGBToLinear();
  stage.prepend(renderer.domElement);
  const scene = new T3.Scene(), cam = new T3.PerspectiveCamera(38, 1.6, 0.1, 100);
  const hemi = new T3.HemisphereLight(0xffffff, 0x8899aa, 0.75); scene.add(hemi);
  const sun = new T3.DirectionalLight(0xffffff, 0.7); sun.position.set(6, 12, 8); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 13, bottom: -13 }); sun.shadow.bias = -0.0004; sun.shadow.radius = 3; scene.add(sun);
  const mats = {}; const mat = (k, c, o = {}) => (mats[k] = mats[k] || new T3.MeshStandardMaterial(Object.assign({ color: c, roughness: .85 }, o)));
  const box = (w, h, d, m, x, y, z, parent = scene) => { const b = new T3.Mesh(new T3.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; parent.add(b); return b; };
  const cyl = (r1, r2, h, m, x, y, z, parent = scene, seg = 14) => { const c = new T3.Mesh(new T3.CylinderGeometry(r1, r2, h, seg), m); c.position.set(x, y, z); c.castShadow = true; parent.add(c); return c; };

  // ---- canvases for screens ----
  const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const tx = new T3.CanvasTexture(c); tx.encoding = T3.sRGBEncoding; tx.anisotropy = 4; return { c, g: c.getContext('2d'), tx }; };
  const wallScr = mkCanvas(512, 256), board = mkCanvas(512, 320), deskScr = {};

  // ---- room (v8: 30 m de ancho, suelo de madera, pared derecha con ventanas) ----
  const W = 30, D = 12, DX = 16, XR = 19, WT = XR + W / 2, XC = (XR - W / 2) / 2; // la planta va de x = -15 a x = 19 y de z = -6 a z = 10
  sun.position.set(6 + XC, 12, 8); sun.target.position.set(XC, 0, 2); scene.add(sun.target);
  const wood = mkCanvas(512, 512); { const g = wood.g; g.fillStyle = 'hsl(32, 30%, 60%)'; g.fillRect(0, 0, 512, 512); for (let r = 0; r < 16; r++) for (let k = 0; k < 6; k++) { const off = (r % 2) * 64; const l = 0.55 + Math.random() * 0.12; g.fillStyle = `hsl(32, 30%, ${Math.round(l * 100)}%)`; g.fillRect(k * 128 + off - 128, r * 32, 128, 32); g.strokeStyle = 'rgba(60,40,20,.25)'; g.strokeRect(k * 128 + off - 128, r * 32, 128, 32); } }
  wood.tx.wrapS = wood.tx.wrapT = T3.RepeatWrapping; wood.tx.repeat.set(8, 4); wood.tx.needsUpdate = true;
  const floorMat = new T3.MeshStandardMaterial({ map: wood.tx, roughness: .8 }); mats.floor = floorMat;
  const floor = new T3.Mesh(new T3.PlaneGeometry(WT, DX), floorMat); floor.rotation.x = -Math.PI / 2; floor.position.set(XC, 0, 2); floor.receiveShadow = true; scene.add(floor);
  box(WT, 3.2, 0.2, mat('wall', css('--wall')), XC, 1.6, -D / 2);
  box(0.2, 3.2, DX, mat('wall'), -W / 2, 1.6, 2);
  box(0.2, 3.2, DX, mat('wall'), XR, 1.6, 2);
  for (const [w_, x_, z_, ry] of [[WT, XC, -D / 2 + 0.11, 0], [DX, -W / 2 + 0.11, 2, Math.PI / 2], [DX, XR - 0.11, 2, Math.PI / 2]]) { const b = box(ry ? 0.03 : w_, 0.12, ry ? w_ : 0.03, mat('base', '#8a7a68'), x_, 0.06, z_); }
  // ventanas con persianas: luz según la hora de Madrid
  const sky = mkCanvas(256, 240), winMat = new T3.MeshBasicMaterial({ map: sky.tx, toneMapped: false });
  const BLD = []; { let x = -4; while (x < 260) { const w = 14 + Math.random() * 30, h = 40 + Math.random() * 120; BLD.push({ x, w, h, tone: 0.55 + Math.random() * 0.3, lit: Array.from({ length: 40 }, () => Math.random() < 0.45) }); x += w + Math.random() * 4; } }
  function drawSky(day) {   // cielo de Madrid según la hora: azul de día, naranja al amanecer y al anochecer, noche con ventanas encendidas
    const { g, c, tx } = sky, dusk = Math.max(0, 1 - Math.abs(day - 0.45) * 4) * (day < 1 ? 1 : 0);
    const gr = g.createLinearGradient(0, 0, 0, c.height);
    gr.addColorStop(0, `rgb(${Math.round(18 + 120 * day)},${Math.round(28 + 160 * day)},${Math.round(58 + 190 * day)})`);
    gr.addColorStop(1, `rgb(${Math.round(40 + 190 * day + 60 * dusk)},${Math.round(50 + 170 * day + 20 * dusk)},${Math.round(80 + 160 * day - 30 * dusk)})`);
    g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
    if (day > 0.3) { g.fillStyle = 'rgba(255,255,255,.55)'; for (const [x, y, r] of [[40, 40, 14], [58, 36, 18], [80, 42, 12], [170, 60, 12], [186, 56, 16]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); } }
    for (const b of BLD) { const v = Math.round((30 + 90 * day) * b.tone); g.fillStyle = `rgb(${v},${v + 4},${v + 12})`; g.fillRect(b.x, c.height - b.h, b.w, b.h);
      let q = 0; for (let yy = c.height - b.h + 6; yy < c.height - 6; yy += 10) for (let xx = b.x + 3; xx < b.x + b.w - 4; xx += 7) { const on = b.lit[q++ % 40]; g.fillStyle = day < 0.5 && on ? 'rgba(255,214,140,.9)' : `rgba(200,220,240,${0.12 + 0.2 * day})`; g.fillRect(xx, yy, 3, 5); } }
    tx.needsUpdate = true;
  }
  drawSky(1);
  const windowAt = (x, z, ry) => { const g = new T3.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g); box(1.6, 1.5, 0.04, winMat, 0, 1.75, 0.02, g); for (const yy of [2.52, 0.98]) box(1.72, 0.08, 0.1, mat('frame', '#7d8894'), 0, yy, 0.04, g); for (const xx of [-0.84, 0, 0.84]) box(0.06, 1.6, 0.1, mat('frame'), xx, 1.75, 0.04, g); for (let k = 0; k < 6; k++) box(1.6, 0.025, 0.05, mat('blind', '#e8e6e0'), 0, 2.4 - k * 0.07, 0.09, g); };
  for (const x of [3.8, 5.8, 7.6]) windowAt(x, -D / 2 + 0.11, 0);
  for (const z of [2.6, 5.0, 7.4]) windowAt(XR - 0.11, z, -Math.PI / 2);
  // pantalla mural con BTC
  const scr = new T3.Mesh(new T3.PlaneGeometry(3.6, 1.8), new T3.MeshBasicMaterial({ map: wallScr.tx })); scr.position.set(0, 2.05, -D / 2 + 0.13); scene.add(scr);
  box(3.8, 2.0, 0.08, mat('bezel', '#1a1f26'), 0, 2.05, -D / 2 + 0.09);
  // pizarra
  const wb = new T3.Mesh(new T3.PlaneGeometry(2.6, 1.6), new T3.MeshBasicMaterial({ map: board.tx })); wb.position.set(-3.6, 1.65, -D / 2 + 0.13); scene.add(wb);
  box(2.75, 1.72, 0.06, mat('frame'), -3.6, 1.65, -D / 2 + 0.09); box(2.6, 0.05, 0.12, mat('frame'), -3.6, 0.83, -D / 2 + 0.16);
  // reloj de pared (hora de Madrid)
  const clock = mkCanvas(128, 128), clockM = new T3.Mesh(new T3.CircleGeometry(0.28, 32), new T3.MeshBasicMaterial({ map: clock.tx })); clockM.position.set(-6.6, 2.35, -D / 2 + 0.12); scene.add(clockM);
  cyl(0.3, 0.3, 0.04, mat('frame'), -6.6, 2.35, -D / 2 + 0.1).rotation.x = Math.PI / 2;
  function drawClock() { const { g, tx } = clock, p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date()).split(':').map(Number); g.fillStyle = '#fbfaf7'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#333'; g.lineWidth = 3; for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; g.beginPath(); g.moveTo(64 + Math.sin(a) * 50, 64 - Math.cos(a) * 50); g.lineTo(64 + Math.sin(a) * 58, 64 - Math.cos(a) * 58); g.stroke(); } const hand = (a, l, w) => { g.lineWidth = w; g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + Math.sin(a) * l, 64 - Math.cos(a) * l); g.stroke(); }; hand(((p[0] % 12) + p[1] / 60) / 12 * Math.PI * 2, 30, 6); hand(p[1] / 60 * Math.PI * 2, 46, 4); tx.needsUpdate = true; }
  drawClock(); setInterval(drawClock, 30000);
  // cuadros
  const poster = (x, txt, col) => { const c = mkCanvas(256, 320); c.g.fillStyle = col; c.g.fillRect(0, 0, 256, 320); c.g.strokeStyle = 'rgba(255,255,255,.8)'; c.g.lineWidth = 6; c.g.beginPath(); let y = 240; c.g.moveTo(20, y); for (let k = 1; k <= 12; k++) { y += (Math.random() - 0.62) * 40; c.g.lineTo(20 + k * 18, Math.max(60, Math.min(280, y))); } c.g.stroke(); c.g.fillStyle = '#fff'; c.g.font = '700 30px sans-serif'; c.g.fillText(txt, 20, 44); c.tx.needsUpdate = true; const m = new T3.Mesh(new T3.PlaneGeometry(0.8, 1.0), new T3.MeshBasicMaterial({ map: c.tx })); m.position.set(x, 1.9, -D / 2 + 0.13); scene.add(m); box(0.88, 1.08, 0.04, mat('frameD', '#2b2b2b'), x, 1.9, -D / 2 + 0.11); };
  poster(-8.6, '2017', '#2a59c9'); poster(-10.2, '2021', '#0b7a57'); poster(-11.8, '2026', '#9b3d8f'); poster(2.55, '2024', '#8f5f00');
  // mesa de reuniones con alfombra y sillas
  const rug = new T3.Mesh(new T3.CircleGeometry(2.6, 40), new T3.MeshStandardMaterial({ color: 0x8e5b4a, roughness: 1 })); rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.006, 3.6); rug.receiveShadow = true; scene.add(rug);
  cyl(1.15, 1.15, 0.06, mat('desk', css('--desk')), 0, 0.74, 3.6); cyl(0.12, 0.3, 0.72, mat('metal', css('--metal')), 0, 0.37, 3.6);
  // rincón del café y fuente de agua
  box(1.4, 0.9, 0.6, mat('desk'), 7.6, 0.45, 4.9); box(0.45, 0.55, 0.4, mat('coffee', '#2b2f35'), 7.4, 1.18, 4.9); cyl(0.06, 0.05, 0.12, mat('cup', '#f2f2f2'), 7.9, 0.96, 4.85);
  box(0.35, 1.0, 0.35, mat('cooler', '#dfe5ea'), 8.8, 0.5, 4.9); cyl(0.14, 0.14, 0.4, new T3.MeshStandardMaterial({ color: 0x8fc4ee, transparent: true, opacity: .7 }), 8.8, 1.2, 4.9);
  box(0.7, 1.85, 0.65, mat('fridge', '#e8ebee'), 10.0, 0.93, 4.95); box(0.03, 0.5, 0.04, mat('metal'), 9.7, 1.25, 5.29);
  for (const x of [7.2, 8.0]) { cyl(0.18, 0.18, 0.05, mat('stool', '#3a3f45'), x, 0.72, 5.55); cyl(0.03, 0.03, 0.7, mat('metal'), x, 0.36, 5.55); }
  // plantas
  const plant = (x, z, big) => { cyl(0.22, 0.18, 0.45, mat('pot', '#9a7b5f'), x, 0.22, z); const s = new T3.Mesh(new T3.SphereGeometry(big ? 0.55 : 0.42, 12, 10), mat('leaf', '#3f8a5a')); s.position.set(x, big ? 1.05 : 0.85, z); s.scale.y = 1.25; s.castShadow = true; scene.add(s); };
  plant(-8.3, -5.3); plant(8.4, -5.2, true); plant(-3.2, 9.3); plant(3.0, -5.3); plant(-14.4, -5.4, true); plant(14.4, 9.4, true); plant(-14.4, 9.5); plant(-7.6, 9.4); plant(18.4, -3.7, true); plant(15.5, 6.8);
  // biblioteca y salita (ala izquierda)
  for (const z of [-4.4, -2.6, -0.8, 1.0]) { const g = new T3.Group(); g.position.set(-14.7, 0, z); scene.add(g); box(0.4, 2.2, 1.7, mat('shelf', '#6b5440'), 0, 1.1, 0, g); for (let r = 0; r < 4; r++) for (let b = 0; b < 9; b++) { const hh = 0.28 + Math.random() * 0.1; box(0.26, hh, 0.13, mat('book' + (b % 5), ['#8b2f2f', '#2f4f8b', '#3f6b3a', '#b08a2e', '#5b3f7a'][b % 5]), 0.05, 0.25 + r * 0.52 + hh / 2, -0.7 + b * 0.17, g); } }
  box(2.2, 0.45, 0.8, mat('sofa', '#5d6b7c'), -12.3, 0.23, 5.3); box(2.2, 0.6, 0.2, mat('sofa'), -12.3, 0.6, 5.65); for (const sx of [-1.15, 1.15]) box(0.2, 0.55, 0.8, mat('sofa'), -12.3 + sx, 0.4, 5.3);
  box(1.0, 0.4, 0.6, mat('desk'), -12.3, 0.2, 4.2);
  for (const x of [-13.1, -11.5]) { box(0.8, 0.4, 0.8, mat('arm', '#7a5c4b'), x, 0.2, 2.6); box(0.8, 0.5, 0.15, mat('arm'), x, 0.55, 2.95); }
  box(0.7, 0.9, 0.55, mat('printer', '#d9dde2'), -14.5, 0.45, 2.6); box(0.6, 0.12, 0.45, mat('bezel'), -14.5, 0.95, 2.6);
  // pizarra compartida de Ríos y Ferrer: liquidez × funding
  const lfb = mkCanvas(512, 256), lfM = new T3.Mesh(new T3.PlaneGeometry(1.8, 0.9), new T3.MeshBasicMaterial({ map: lfb.tx })); lfM.position.set(-6.2, 1.55, 6.25); scene.add(lfM); box(1.9, 0.98, 0.05, mat('frame'), -6.2, 1.55, 6.22); for (const dx of [-0.8, 0.8]) box(0.05, 1.1, 0.05, mat('metal'), -6.2 + dx, 0.55, 6.22);
  // lámparas colgantes
  const lampMat = new T3.MeshStandardMaterial({ color: 0x2c2f33, emissive: 0x000000 }), bulbMat = new T3.MeshBasicMaterial({ color: 0xfff1c9 });
  const pendant = (x, z) => { cyl(0.008, 0.008, 0.6, mat('metal'), x, 3.0, z).castShadow = false; cyl(0.08, 0.3, 0.22, lampMat, x, 2.62, z, scene, 20).castShadow = false; const b = new T3.Mesh(new T3.CircleGeometry(0.26, 20), bulbMat); b.rotation.x = Math.PI / 2; b.position.set(x, 2.505, z); scene.add(b); };
  for (const [x, z] of [[0, -3.6], [-5, -1.3], [-5, 2.3], [-5, 4.4], [5, -1.3], [5, 2.3], [0, 3.6], [-3.6, 7.2], [12.6, -3.3], [-12.3, 4.6], [17.1, 3.2], [17.0, -2.4], [17.0, 7.6]]) pendant(x, z);
  // despacho de Salinas (cristal, esquina derecha del fondo)
  const PMO = { x0: 10.3, x1: 14.9, z0: -5.9, z1: -0.7, door: 11.0 };
  const pmGlass = new T3.MeshStandardMaterial({ color: 0xcfe0ef, transparent: true, opacity: .2, roughness: .1, depthWrite: false, side: T3.DoubleSide });
  const gpane = (w, x, z, ry) => { const m = new T3.Mesh(new T3.PlaneGeometry(w, 2.5), pmGlass); m.position.set(x, 1.25, z); m.rotation.y = ry; scene.add(m); box(ry ? 0.05 : w, 0.06, ry ? w : 0.05, mat('frame'), x, 2.5, z); };
  gpane(PMO.z1 - PMO.z0, PMO.x0, (PMO.z0 + PMO.z1) / 2, Math.PI / 2);
  gpane(PMO.door - 0.5 - PMO.x0, (PMO.x0 + PMO.door - 0.5) / 2, PMO.z1, 0); gpane(PMO.x1 - PMO.door - 0.5, (PMO.door + 0.5 + PMO.x1) / 2, PMO.z1, 0);
  const pmScr = mkCanvas(512, 256), pmMon = new T3.Mesh(new T3.PlaneGeometry(2.2, 1.1), new T3.MeshBasicMaterial({ map: pmScr.tx })); pmMon.position.set(12.6, 1.95, -5.86); scene.add(pmMon); box(2.3, 1.2, 0.05, mat('bezel'), 12.6, 1.95, -5.9);
  const pmSign = mkCanvas(256, 48); pmSign.g.fillStyle = '#1f2a3a'; pmSign.g.fillRect(0, 0, 256, 48); pmSign.g.fillStyle = '#fff'; pmSign.g.font = '600 24px sans-serif'; pmSign.g.textAlign = 'center'; pmSign.g.fillText('SALINAS · CARTERA', 128, 32); pmSign.tx.needsUpdate = true;
  const pmS = new T3.Mesh(new T3.PlaneGeometry(1.4, 0.26), new T3.MeshBasicMaterial({ map: pmSign.tx, side: T3.DoubleSide })); pmS.position.set(12.8, 2.25, PMO.z1); scene.add(pmS);

  // ---- laboratorio de datos de Duarte (ala derecha nueva): servidores, pantalla del modelo y pizarra con la fórmula ----
  const LAB = { x0: 15.0, gap: [-0.25, 1.35] };
  const lpane = (z0, z1) => { const w = z1 - z0, m = new T3.Mesh(new T3.PlaneGeometry(w, 2.5), pmGlass); m.position.set(LAB.x0, 1.25, (z0 + z1) / 2); m.rotation.y = Math.PI / 2; scene.add(m); box(0.05, 0.06, w, mat('frame'), LAB.x0, 2.5, (z0 + z1) / 2); box(0.05, 0.05, w, mat('frame'), LAB.x0, 0.03, (z0 + z1) / 2); };
  lpane(-5.9, LAB.gap[0]); lpane(LAB.gap[1], 9.9);
  for (const z of [-5.9, LAB.gap[0], LAB.gap[1], 9.9]) box(0.08, 2.5, 0.08, mat('frame'), LAB.x0, 1.25, z);
  const labFloor = new T3.Mesh(new T3.PlaneGeometry(XR - LAB.x0, DX), new T3.MeshStandardMaterial({ color: 0x4a5664, roughness: .5, metalness: .1 })); labFloor.rotation.x = -Math.PI / 2; labFloor.position.set((LAB.x0 + XR) / 2, 0.003, 2); labFloor.receiveShadow = true; scene.add(labFloor);
  const labSign = mkCanvas(256, 48); labSign.g.fillStyle = '#0e7490'; labSign.g.fillRect(0, 0, 256, 48); labSign.g.fillStyle = '#fff'; labSign.g.font = '600 22px sans-serif'; labSign.g.textAlign = 'center'; labSign.g.fillText('DUARTE · DATOS', 128, 32); labSign.tx.needsUpdate = true;
  { const m = new T3.Mesh(new T3.PlaneGeometry(1.0, 0.19), new T3.MeshBasicMaterial({ map: labSign.tx, side: T3.DoubleSide })); m.position.set(LAB.x0 - 0.02, 2.66, 0.55); m.rotation.y = -Math.PI / 2; scene.add(m); }
  // armarios de servidores con luces que parpadean
  const leds = [], ledOn = new T3.MeshBasicMaterial({ color: 0x3dff9a, toneMapped: false }), ledAmber = new T3.MeshBasicMaterial({ color: 0xffb020, toneMapped: false }), ledOff = new T3.MeshBasicMaterial({ color: 0x14301f, toneMapped: false });
  for (let r = 0; r < 4; r++) { const g = new T3.Group(); g.position.set(15.75 + r * 0.72, 0, -5.35); scene.add(g);
    box(0.64, 2.05, 0.95, mat('rack', '#1d2229'), 0, 1.025, 0, g); box(0.6, 0.04, 0.9, mat('metal'), 0, 2.07, 0, g);
    for (let u = 0; u < 9; u++) { box(0.56, 0.15, 0.02, mat('rackU', '#2c333d'), 0, 0.3 + u * 0.19, 0.48, g); box(0.3, 0.05, 0.005, mat('vent', '#11151a'), 0.1, 0.3 + u * 0.19, 0.492, g);
      for (let q = 0; q < 3; q++) { const l = new T3.Mesh(new T3.BoxGeometry(0.024, 0.024, 0.01), ledOn); l.position.set(-0.22 + q * 0.045, 0.3 + u * 0.19, 0.495); g.add(l); leds.push(l); } } }
  box(3.0, 0.07, 0.35, mat('metal'), 16.85, 2.45, -5.1); for (let q = 0; q < 6; q++) cyl(0.025, 0.025, 0.5, mat('cable', ['#1f6feb', '#e5534b', '#d29922', '#1a1a1a'][q % 4]), 15.6 + q * 0.5, 2.22, -4.95, scene, 6);
  // pantalla del modelo de calidad (de pie, mirando a la mesa de Duarte)
  const mlScr = mkCanvas(512, 320), mlMon = new T3.Mesh(new T3.PlaneGeometry(2.3, 1.44), new T3.MeshBasicMaterial({ map: mlScr.tx, toneMapped: false })); mlMon.position.set(17.1, 1.6, 6.1); mlMon.rotation.y = Math.PI; scene.add(mlMon);
  box(2.4, 1.54, 0.06, mat('bezel'), 17.1, 1.6, 6.14); for (const dx of [-0.8, 0.8]) { box(0.06, 0.85, 0.06, mat('metal'), 17.1 + dx, 0.43, 6.16); box(0.5, 0.04, 0.4, mat('metal'), 17.1 + dx, 0.02, 6.16); }
  // pizarra móvil con la fórmula y la curva de calibración
  const fb = mkCanvas(512, 320); { const g = fb.g; g.fillStyle = '#f8f9f6'; g.fillRect(0, 0, 512, 320); g.fillStyle = '#0e7490'; g.font = '700 30px serif'; g.fillText('p = σ(β₀ + β·x)', 24, 50); g.font = '20px serif'; g.fillStyle = '#334155';
    g.fillText('L2 · vida media 2 años · solo cerradas', 24, 84); g.fillText('veto si ΔR(Q1) ≥ 0,25R con t ≥ 2', 24, 112);
    g.strokeStyle = '#64748b'; g.lineWidth = 2; g.beginPath(); g.moveTo(40, 290); g.lineTo(480, 290); g.moveTo(40, 290); g.lineTo(40, 140); g.stroke(); g.setLineDash([6, 6]); g.beginPath(); g.moveTo(40, 290); g.lineTo(240, 140); g.stroke(); g.setLineDash([]);
    g.strokeStyle = '#e5534b'; g.lineWidth = 3; g.beginPath(); [[40, 262], [100, 250], [160, 212], [220, 236], [280, 228], [340, 200], [400, 222], [470, 205]].forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
    g.fillStyle = '#e5534b'; g.font = '18px serif'; g.fillText('ruido: aún sin señal', 300, 170); fb.tx.needsUpdate = true; }
  { const g = new T3.Group(); g.position.set(18.45, 0, -1.9); g.rotation.y = -Math.PI / 2; scene.add(g); const m = new T3.Mesh(new T3.PlaneGeometry(1.6, 1.0), new T3.MeshBasicMaterial({ map: fb.tx })); m.position.set(0, 1.45, 0.03); g.add(m);
    box(1.68, 1.08, 0.04, mat('frame'), 0, 1.45, 0, g); for (const dx of [-0.78, 0.78]) { box(0.04, 1.85, 0.04, mat('metal'), dx, 0.93, 0, g); box(0.04, 0.04, 0.5, mat('metal'), dx, 0.06, 0, g); } }
  // butacas de trabajo y un pequeño archivo
  box(0.9, 0.45, 0.6, mat('sofaLab', '#0e5566'), 18.3, 0.23, 8.4); box(0.9, 0.5, 0.15, mat('sofaLab'), 18.3, 0.55, 8.72); box(0.5, 0.75, 0.55, mat('cab', '#9aa4ae'), 15.6, 0.38, 9.4);

  // ---- puerta de la calle (pared izquierda): entran a las 7:00 y se van a casa a las 21:00, de lunes a viernes ----
  const DOOR = { x: -W / 2 + 0.11, z: 8.0, w: 1.1, in: [-W / 2 + 0.55, 8.0] };
  box(0.12, 2.35, 0.1, mat('frame'), DOOR.x + 0.02, 1.17, DOOR.z - DOOR.w / 2 - 0.05); box(0.12, 2.35, 0.1, mat('frame'), DOOR.x + 0.02, 1.17, DOOR.z + DOOR.w / 2 + 0.05); box(0.12, 0.1, DOOR.w + 0.2, mat('frame'), DOOR.x + 0.02, 2.36, DOOR.z);
  const hinge = new T3.Group(); hinge.position.set(DOOR.x + 0.06, 0, DOOR.z - DOOR.w / 2); scene.add(hinge);
  box(0.06, 2.25, DOOR.w, mat('doorLeaf', '#7b5b3e'), 0, 1.13, DOOR.w / 2, hinge); cyl(0.03, 0.03, 0.04, mat('metal'), 0.07, 1.05, DOOR.w - 0.12, hinge, 8).rotation.z = Math.PI / 2;
  const exitSign = mkCanvas(256, 64); exitSign.g.fillStyle = '#0b7a57'; exitSign.g.fillRect(0, 0, 256, 64); exitSign.g.fillStyle = '#fff'; exitSign.g.font = '700 30px sans-serif'; exitSign.g.textAlign = 'center'; exitSign.g.fillText('SALIDA · CASA', 128, 43); exitSign.tx.needsUpdate = true;
  const exM = new T3.Mesh(new T3.PlaneGeometry(1.1, 0.27), new T3.MeshBasicMaterial({ map: exitSign.tx })); exM.position.set(DOOR.x + 0.08, 2.62, DOOR.z); exM.rotation.y = Math.PI / 2; scene.add(exM);
  let doorAngle = 0;

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
    ferrer: { x: -5.0, z: 2.3, face: 1, seat: [-6.0, 2.3], visit: [-6.0, 1.35] },
    rios: { x: -5.0, z: 4.4, face: -1, seat: [-4.0, 4.4], visit: [-3.1, 4.4] },
    paz: { x: 5.0, z: -1.3, face: -1, seat: [6.0, -1.3], visit: [6.0, -0.35] },
    calvo: { x: 5.0, z: 2.3, face: -1, seat: [6.0, 2.3], visit: [6.0, 1.35] },
    nubarrones: { x: -3.6, z: 7.4, face: 0, seat: [-3.6, 6.45], visit: [-2.35, 6.9] },
    salinas: { x: 12.6, z: -3.3, face: 0, seat: [12.6, -4.25], visit: [11.0, -3.0] },
    duarte: { x: 17.1, z: 3.2, face: 0, seat: [17.1, 2.25], visit: [18.45, 2.7] },
    iturbe: { x: 17.1, z: -3.2, face: 0, seat: [17.1, -4.15], visit: [15.6, -3.2] }
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
    // detalles de la mesa: teclado, ratón, taza, flexo, segundo monitor y papeles (orientados hacia la silla)
    const dg = new T3.Group(); dg.rotation.y = along ? 0 : d.face === 1 ? Math.PI / 2 : -Math.PI / 2; g.add(dg);
    box(0.46, 0.02, 0.15, mat('kb', '#2a2d31'), 0, 0.78, -0.12, dg); box(0.06, 0.02, 0.1, mat('kb'), 0.34, 0.78, -0.12, dg);
    cyl(0.04, 0.035, 0.09, mat('mug' + k, M.AG[k].color), -0.45, 0.815, -0.18, dg, 12);
    for (let q = 0; q < 3; q++) box(0.21, 0.004, 0.29, mat('paper', '#f4f2ec'), 0.5, 0.775 + q * 0.004, -0.05 + q * 0.01, dg).rotation.y = q * 0.15;
    { const lamp = new T3.Group(); lamp.position.set(-0.62, 0.77, 0.15); dg.add(lamp); cyl(0.07, 0.08, 0.02, mat('metal'), 0, 0.01, 0, lamp); const arm = cyl(0.012, 0.012, 0.42, mat('metal'), 0, 0.2, 0, lamp); arm.rotation.z = 0.3; const sh = cyl(0.03, 0.07, 0.09, mat('lampShade', '#c9a227'), 0.07, 0.4, 0, lamp); sh.rotation.z = -0.9; }
    if (k !== 'nubarrones') { const m2 = new T3.Mesh(new T3.PlaneGeometry(0.5, 0.32), new T3.MeshBasicMaterial({ map: c.tx })); m2.position.set(-0.55, 1.12, 0.22); m2.rotation.y = Math.PI + 0.45; dg.add(m2); box(0.53, 0.35, 0.02, mat('bezel'), -0.555, 1.12, 0.23, dg).rotation.y = 0.45; cyl(0.02, 0.02, 0.2, mat('metal'), -0.56, 0.87, 0.24, dg); }
    // silla de oficina con base de ruedas y reposabrazos
    const cg = new T3.Group(); cg.position.set(d.seat[0], 0, d.seat[1]); scene.add(cg);
    box(0.5, 0.07, 0.5, mat('chair', '#39424d'), 0, 0.46, 0, cg); cyl(0.035, 0.035, 0.36, mat('metal'), 0, 0.26, 0, cg);
    for (let q = 0; q < 5; q++) { const a = q / 5 * Math.PI * 2, leg = box(0.3, 0.03, 0.04, mat('metal'), Math.cos(a) * 0.15, 0.06, Math.sin(a) * 0.15, cg); leg.rotation.y = -a; const wh = new T3.Mesh(new T3.SphereGeometry(0.03, 8, 6), mat('kb')); wh.position.set(Math.cos(a) * 0.29, 0.03, Math.sin(a) * 0.29); cg.add(wh); }
    for (const sx of [-0.26, 0.26]) { box(0.04, 0.2, 0.04, mat('chair'), sx, 0.58, 0, cg); box(0.06, 0.03, 0.32, mat('chair'), sx, 0.69, 0.02, cg); }
    const back = box(0.5, 0.6, 0.07, mat('chair'), 0, 0.8, 0, cg);
    const yaw = along ? 0 : d.face === 1 ? Math.PI / 2 : -Math.PI / 2; cg.rotation.y = yaw; back.position.z = -0.25;
    d.yaw = yaw;
    // name plate
    const plate = mkCanvas(256, 64); plate.g.fillStyle = M.AG[k].color; plate.g.fillRect(0, 0, 256, 64); plate.g.fillStyle = '#fff'; plate.g.font = '600 34px sans-serif'; plate.g.textAlign = 'center'; plate.g.fillText(M.AG[k].name, 128, 44); plate.tx.needsUpdate = true;
    const pl = new T3.Mesh(new T3.PlaneGeometry(0.5, 0.125), new T3.MeshBasicMaterial({ map: plate.tx }));
    if (along) { pl.position.set(0, 0.79, 0.43); } else { pl.position.set(-d.face * 0.43, 0.79, 0); pl.rotation.y = d.face === 1 ? -Math.PI / 2 : Math.PI / 2; }
    g.add(pl);
  }
  // la nube de Nubarrones: gris claro en alcista, oscura y con relámpago cuando hay fase bajista
  const cloudMat = new T3.MeshStandardMaterial({ color: 0xc9d1dc, roughness: 1, transparent: true, opacity: 0.92 }), cloud = new T3.Group();
  for (const [x, y, z, r] of [[0, 0, 0, 0.32], [0.3, 0.05, 0.05, 0.26], [-0.3, 0.02, 0, 0.24], [0.12, 0.2, -0.05, 0.24], [-0.14, 0.16, 0.08, 0.2]]) { const m = new T3.Mesh(new T3.SphereGeometry(r, 14, 10), cloudMat); m.position.set(x, y, z); cloud.add(m); }
  cloud.position.set(DESKS.nubarrones.x, 2.35, DESKS.nubarrones.z); scene.add(cloud);
  const bolt = new T3.Mesh(new T3.ConeGeometry(0.05, 0.4, 4), new T3.MeshBasicMaterial({ color: 0xffd23f })); bolt.position.set(0.05, -0.3, 0); bolt.rotation.z = 0.35; bolt.visible = false; cloud.add(bolt);
  let bearPhase = 'bull';
  const SPOTS = { coffee: [7.2, 4.35], board: [-3.6, -5.0], table: a => [Math.cos(a) * 1.6, 3.6 - Math.abs(Math.sin(a)) * 1.6], lab: [16.2, 4.2], sofa: [-12.3, 4.6], er: { vega: [4.1, 7.35], ortega: [5.4, 7.3], paz: [6.7, 7.35], ferrer: [3.5, 8.6], rios: [2.4, 7.8], calvo: [7.3, 8.3], nubarrones: [8.1, 9.3], salinas: [2.5, 9.3], duarte: [5.4, 9.45], iturbe: [3.9, 9.45] } };

  // ---- people (monigotes) ----
  const skin = mat('skin', '#e2b999'), pants = mat('pants', '#2e3640');
  // estilo de cada uno: pelo, gafas, barba, traje
  const LOOK = {
    vega: { hair: 'short', hc: '#2a2420', skin: '#e2b999' }, rios: { hair: 'curly', hc: '#7a4a24', skin: '#d8a982' }, ortega: { hair: 'curly', hc: '#3b2a1e', skin: '#c99a73' },
    paz: { hair: 'pony', hc: '#5a3a22', skin: '#efc6a6' }, ferrer: { hair: 'short', hc: '#151515', skin: '#a8754f', glasses: true },
    nubarrones: { hair: 'grey', hc: '#c4c4c4', skin: '#e8c3a3', beard: true, glasses: true, pants: '#3a3f47' },
    salinas: { hair: 'slick', hc: '#222', skin: '#dcb08c', suit: true, glasses: true, pants: '#1f2530' }, duarte: { hair: 'bob', hc: '#231d2b', skin: '#c58c66', phones: true, pants: '#2b3a44' }, iturbe: { hair: 'short', hc: '#6b4a2b', skin: '#e8b996', glasses: true, pants: '#3b3226' }, calvo: { hair: 'bald', hc: '#e0b493', skin: '#e0b493' }
  };
  function person(color, k) {
    const L = LOOK[k] || { hair: 'short', hc: '#2a2420', skin: '#e2b999' };
    const g = new T3.Group(), shirt = new T3.MeshStandardMaterial({ color: L.suit ? '#2c3442' : color, roughness: .7 }), sk = mat('skin' + k, L.skin), pm = mat('pants' + k, L.pants || '#2e3640'), shoe = mat('shoe', '#1d2228');
    // piernas con rodilla
    const hipL = new T3.Group(), hipR = new T3.Group(); hipL.position.set(-0.11, 0.86, 0); hipR.position.set(0.11, 0.86, 0); g.add(hipL, hipR);
    const knees = [];
    for (const hp of [hipL, hipR]) { cyl(0.08, 0.07, 0.43, pm, 0, -0.215, 0, hp, 10); const kn = new T3.Group(); kn.position.y = -0.43; hp.add(kn); cyl(0.068, 0.058, 0.41, pm, 0, -0.205, 0, kn, 10); box(0.12, 0.08, 0.25, shoe, 0, -0.42, 0.05, kn); knees.push(kn); }
    box(0.36, 0.06, 0.25, mat('belt', '#1b1b1b'), 0, 0.88, 0, g);
    const torso = cyl(0.2, 0.17, 0.6, shirt, 0, 1.18, 0, g); torso.scale.z = 0.7;
    if (L.suit) { box(0.06, 0.34, 0.02, mat('tie' + k, color), 0, 1.3, 0.13, g); box(0.16, 0.08, 0.03, mat('collar', '#f2f2f2'), 0, 1.45, 0.11, g); }
    else box(0.18, 0.06, 0.05, mat('collar' + k, color), 0, 1.47, 0.1, g);
    cyl(0.06, 0.065, 0.09, sk, 0, 1.52, 0, g, 10);
    const head = new T3.Mesh(new T3.SphereGeometry(0.155, 18, 14), sk); head.position.set(0, 1.68, 0); head.scale.set(0.95, 1.05, 1); head.castShadow = true; g.add(head);
    const nose = new T3.Mesh(new T3.SphereGeometry(0.03, 8, 6), sk); nose.position.set(0, -0.01, 0.15); head.add(nose);
    for (const sx of [-0.05, 0.05]) { const e = new T3.Mesh(new T3.SphereGeometry(0.018, 8, 6), mat('eye', '#1b1b1b')); e.position.set(sx, 0.03, 0.135); head.add(e); }
    for (const sx of [-0.155, 0.155]) { const ear = new T3.Mesh(new T3.SphereGeometry(0.035, 8, 6), sk); ear.position.set(sx, 0, 0); ear.scale.x = 0.5; head.add(ear); }
    const hm = mat('hair' + k, L.hc);
    if (L.hair !== 'bald') { const cap = new T3.Mesh(new T3.SphereGeometry(0.162, 18, 10, 0, Math.PI * 2, 0, L.hair === 'grey' ? Math.PI / 2.6 : Math.PI / 2.05), hm); cap.position.y = 0.012; cap.rotation.x = -0.18; head.add(cap); }
    else { const shine = new T3.Mesh(new T3.SphereGeometry(0.03, 8, 6), new T3.MeshBasicMaterial({ color: 0xfff3e6 })); shine.position.set(0.04, 0.13, 0.04); head.add(shine); }
    if (L.hair === 'curly') for (let q = 0; q < 9; q++) { const b = new T3.Mesh(new T3.SphereGeometry(0.05, 8, 6), hm); const a = q / 9 * Math.PI * 2; b.position.set(Math.cos(a) * 0.11, 0.11, Math.sin(a) * 0.11 - 0.02); head.add(b); }
    if (L.hair === 'bob') { const b = new T3.Mesh(new T3.SphereGeometry(0.178, 18, 12, Math.PI, Math.PI, 0, Math.PI * 0.64), hm); b.material.side = T3.DoubleSide; b.position.set(0, 0.0, -0.005); head.add(b); for (const sx of [-0.15, 0.15]) { const sd = new T3.Mesh(new T3.SphereGeometry(0.06, 8, 8), hm); sd.position.set(sx, -0.05, -0.02); sd.scale.y = 1.6; head.add(sd); } }
    if (L.phones) { const ph = mat('phones', '#16181b'), arc = new T3.Mesh(new T3.TorusGeometry(0.175, 0.016, 6, 18, Math.PI), ph); arc.position.set(0, 0.02, -0.01); head.add(arc); for (const sx of [-0.175, 0.175]) { const cup = cyl(0.055, 0.055, 0.05, ph, sx, 0.0, -0.01, head, 14); cup.rotation.z = Math.PI / 2; } }
    if (L.hair === 'pony') { const t = cyl(0.045, 0.02, 0.26, hm, 0, -0.02, -0.17, head, 8); t.rotation.x = 0.45; }
    if (L.hair === 'grey') for (const sx of [-0.13, 0.13]) { const side = new T3.Mesh(new T3.SphereGeometry(0.05, 8, 6), hm); side.position.set(sx, 0.02, -0.04); head.add(side); }
    if (L.beard) { const b = new T3.Mesh(new T3.SphereGeometry(0.11, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), hm); b.position.set(0, -0.03, 0.04); head.add(b); }
    if (L.glasses) { const gm = mat('glass', '#111'); for (const sx of [-0.055, 0.055]) { const r = new T3.Mesh(new T3.TorusGeometry(0.032, 0.006, 6, 14), gm); r.position.set(sx, 0.03, 0.145); head.add(r); } box(0.04, 0.006, 0.006, gm, 0, 0.03, 0.15, head); }
    // brazos con codo
    const shL = new T3.Group(), shR = new T3.Group(); shL.position.set(-0.26, 1.43, 0); shR.position.set(0.26, 1.43, 0); g.add(shL, shR);
    const elbows = [];
    for (const sh of [shL, shR]) { cyl(0.06, 0.055, 0.3, shirt, 0, -0.15, 0, sh, 10); const el = new T3.Group(); el.position.y = -0.3; sh.add(el); cyl(0.052, 0.045, 0.28, shirt, 0, -0.14, 0, el, 10); const hand = new T3.Mesh(new T3.SphereGeometry(0.05, 8, 6), sk); hand.position.y = -0.3; el.add(hand); elbows.push(el); }
    scene.add(g);
    return { g, hipL, hipR, shL, shR, head, torso, knL: knees[0], knR: knees[1], elL: elbows[0], elR: elbows[1] };
  }
  const P = {};
  M.ORDER.forEach((k, i) => {
    const d = DESKS[k], p = person(M.AG[k].color, k); p.g.rotation.y = d.yaw;
    P[k] = { k, ...p, pos: new T3.Vector2(d.seat[0], d.seat[1]), path: [], state: 'sit', until: performance.now() / 1000 + 4 + i * 7, yaw: d.yaw, say: null, sayUntil: 0, phase: Math.random() * 6, after: null, target: null };
  });
  // overlay labels
  const tags = {}, bubs = {};
  for (const k of M.ORDER) { tags[k] = document.createElement('span'); tags[k].className = 'tag3d'; tags[k].textContent = M.AG[k].name; overlay.append(tags[k]); bubs[k] = document.createElement('div'); bubs[k].className = 'bub'; bubs[k].style.opacity = '0'; overlay.append(bubs[k]); }

  // ---- behaviour ----
  const now = () => performance.now() / 1000;
  const corr = ([x, z]) => [x, CORR];
  const door = q => (q[1] < -3.3 && Math.abs(q[0]) < 1.6) ? [1.45, q[1]] : (q[0] > LAB.x0 && q[1] < -0.7) ? [15.6, q[1]] : (q[0] > PMO.x0 && q[1] < PMO.z1) ? [PMO.door, q[1]] : q;
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
      setTimeout(() => { say(other, other === 'calvo' ? 'Lo apunto en el marcador.' : other === 'nubarrones' ? (bearPhase === 'mature' ? 'Bajista maduro: nada de cortos de Paz y Ríos.' : bearPhase === 'bull' ? 'Fondo alcista. Nada que vetar.' : 'Ojo a la fase; no te fíes de los rebotes.') : other === 'vega' ? 'Recibido. Riesgo sin cambios.' : other === 'duarte' ? 'Lo meto en el modelo: cada operación cerrada le enseña algo.' : other === 'salinas' ? 'Entendido; el tamaño lo marco yo.' : 'Anotado.', 'ok', 4); }, 3500);
      setTimeout(() => { P[other].reserved = false; backToDesk(k); }, 7600);
    });
  }
  function wander(k) {
    const r = Math.random(), p = P[k];
    if (r < 0.5) { const others = M.ORDER.filter(o => o !== k && !busy(o)); if (others.length) return visit(k, others[Math.floor(Math.random() * others.length)]); }
    if (r < 0.72) return goTo(p, SPOTS.coffee, () => { p.state = 'talk'; p.yaw = Math.PI / 2; say(k, 'Café y vuelvo a la pantalla.', 'ok', 3); setTimeout(() => backToDesk(k), 4200); });
    if (r < 0.9 && k === 'duarte') return goTo(p, [15.9, 4.9], () => { p.state = 'talk'; p.yaw = 0.35; say(k, 'Reviso la calibración: ¿el cuartil bajo ya rinde peor?', 'ok', 4); setTimeout(() => backToDesk(k), 5200); });
    if (r < 0.9) return goTo(p, SPOTS.board, () => { p.state = 'talk'; p.yaw = Math.PI; const n = noteOf(k); say(k, n ? short(n.text, 90) : 'Repasando la operativa en la pizarra.', n && n.level, 5); setTimeout(() => backToDesk(k), 5600); });
    p.until = now() + 10;
  }
  // a new round: everyone back, reading data, then the ones with news present them at the table
  let lastTickAt = null, meeting = false;
  const AUDIT_MEET = Date.now() < Date.UTC(2026, 9, 18) && !reduce;   // la primera vez que se abre la oficina esta semana, reunión de la auditoría
  function newRound(t) {
    if (!officeOn) return;
    for (const k of M.ORDER) { if (P[k].state !== 'sit') backToDesk(k); P[k].reading = now() + 9; }
    setTimeout(() => {
      M.ORDER.forEach((k, i) => { const n = t.notes && t.notes[k]; if (n) setTimeout(() => say(k, short(n.text, 110), n.level, 6), i * 3800); });
      const hot = M.ORDER.filter(k => t.notes && t.notes[k] && (t.notes[k].level === 'trade' || t.notes[k].level === 'alerta'));
      if (hot.length && !reduce && !erActive) {
        meeting = true; let i = 0;
        for (const k of M.ORDER) { const a = Math.PI + (i++) * (Math.PI / 9); const spot = SPOTS.table(a); setTimeout(() => goTo(P[k], spot, () => { P[k].state = 'talk'; P[k].yaw = yawTo(spot, [0, 3.6]); }), 19000 + i * 400); }
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
    if (!officeOn) { drawER(); return; }
    const e = M.emergency();
    if (e && (!erActive || erActive.id !== e.id) && !reduce) convene(e);
    else if (e && reduce && !erActive) { erActive = e; say('calvo', 'Sala de emergencias: ' + e.verdict + '.', 'emergencia', 12); }
    else if (!e && erActive) dismiss();
    drawER();
  }
  setInterval(checkER, 20000);
  function onData(S) {
    const t = S.ticks[0];
    { const nn = noteOf('nubarrones'); bearPhase = nn && nn.phase || 'bull'; cloudMat.color.copy(lin(bearPhase === 'mature' ? 0x4a5160 : bearPhase === 'early' || bearPhase === 'top' ? 0x7d8796 : 0xc9d1dc)); }
    checkER();
    if (t && t.at !== lastTickAt && !erActive) { const first = lastTickAt == null; lastTickAt = t.at; if (!first || (Date.now() - new Date(t.at)) < 20 * 60e3) { if (!(first && AUDIT_MEET)) newRound(t); } else if (!AUDIT_MEET) M.ORDER.forEach((k, i) => { if (t.notes && t.notes[k]) setTimeout(() => say(k, short(t.notes[k].text, 110), t.notes[k].level, 6), 800 + i * 3800); }); }
    drawBoard(S); drawWall(S); drawER(); drawPM(S); drawLF(S); drawML(S); for (const k of M.ORDER) drawDesk(k, S);
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
  function drawLF(S) {
    const { g, c, tx } = lfb, t = S.ticks[0], nr = t && t.notes && t.notes.rios, nf = t && t.notes && t.notes.ferrer;
    g.fillStyle = '#f7f8f6'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#8f5f00'; g.font = '700 26px sans-serif'; g.fillText('LIQUIDEZ', 18, 36); g.fillStyle = '#b0479a'; g.fillText('× FUNDING', 160, 36);
    g.font = '17px sans-serif'; g.fillStyle = '#334155';
    const wrap = (txt, y) => { const words = String(txt || '—').split(' '); let line = ''; for (const w of words) { if (g.measureText(line + w).width > 470) { g.fillText(line, 18, y); y += 22; line = ''; } line += w + ' '; if (y > 240) break; } g.fillText(line, 18, y); return y + 26; };
    let y = wrap('Ríos: ' + (nr ? nr.text.split('. ').slice(0, 2).join('. ') : 'esperando ronda'), 68);
    wrap('Ferrer: ' + (nf ? nf.text.split('. ').slice(0, 2).join('. ') : 'esperando ronda'), y);
    tx.needsUpdate = true;
  }
  function drawPM(S) {
    const { g, c, tx } = pmScr, t = S.ticks[0], sc = t && t.score && t.score.mesa;
    g.fillStyle = '#0d141c'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#e8eef5'; g.font = '700 24px monospace'; g.fillText('CARTERA · SALINAS', 18, 36);
    let open = 0; for (const k of M.TRADERS) { const n = t && t.notes && t.notes[k]; if (n && n.pos && n.pos.live) open += ({ vega: 0.75, ortega: 1, paz: 0.5 })[k] || 0; }
    g.font = '18px monospace'; g.fillStyle = '#93a3b4'; g.fillText('Riesgo abierto', 18, 76);
    g.fillStyle = '#1f2a37'; g.fillRect(18, 86, 476, 26); g.fillStyle = open >= 2 ? '#f07466' : '#3cc49d'; g.fillRect(18, 86, 476 * Math.min(1, open / 2), 26);
    g.fillStyle = '#e8eef5'; g.fillText(open.toFixed(2).replace('.', ',') + 'R de 2R', 24, 106);
    g.fillStyle = '#93a3b4'; g.fillText('En vivo: ' + (sc && sc.n ? sc.n + ' cerradas · ' + (sc.sumW >= 0 ? '+' : '') + sc.sumW.toFixed(1).replace('.', ',') + 'R' : 'sin cerradas todavía'), 18, 146);
    g.fillText('Freno: riesgo a la mitad si cae > 8R', 18, 176);
    [['Ortega', 1], ['Vega', 0.75], ['Paz', 0.5], ['Ríos', 0], ['Ferrer', 0]].forEach(([n, w], i) => { g.fillStyle = '#7d9dff'; g.fillRect(18 + i * 98, 236 - w * 40, 76, w * 40); g.fillStyle = '#e8eef5'; g.font = '13px monospace'; g.fillText(n + ' ' + String(w).replace('.', ','), 18 + i * 98, 252); });
    tx.needsUpdate = true;
  }
  function drawML(S) {
    const { g, c, tx } = mlScr, t = S.ticks[0], n = t && t.notes && t.notes.duarte, ml = n && n.ml;
    g.fillStyle = '#071a20'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#0e7490'; g.fillRect(0, 0, c.width, 8);
    g.fillStyle = '#e8eef5'; g.font = '700 24px monospace'; g.fillText('MODELO DE CALIDAD', 18, 42);
    if (!ml) { g.fillStyle = '#93a3b4'; g.font = '18px monospace'; g.fillText('Esperando la primera ronda con modelo', 18, 90); tx.needsUpdate = true; return; }
    g.fillStyle = ml.active ? '#ffd36b' : '#7dd3fc'; g.font = '700 20px monospace'; g.fillText(ml.active ? 'FILTRO ACTIVO' : 'EN SOMBRA · aprende, no veta', 18, 76);
    g.fillStyle = '#93a3b4'; g.font = '16px monospace'; g.fillText(ml.n + ' operaciones de entrenamiento' + (ml.live ? ' · ' + ml.live + ' en vivo' : ''), 18, 104);
    g.fillText('R medio por cuartil de calidad (últimas 200)', 18, 136);
    const bars = [['Q1 (peor)', ml.lowR, '#f07466'], ['Q2–Q4', ml.restR, '#3cc49d']], Y0 = 230, sc = 60;
    g.strokeStyle = '#3a4a55'; g.beginPath(); g.moveTo(18, Y0); g.lineTo(494, Y0); g.stroke();
    bars.forEach(([lab, v, col], i) => { const x = 40 + i * 220, h = Math.max(-1.5, Math.min(1.5, v)) * sc; g.fillStyle = col; g.fillRect(x, h >= 0 ? Y0 - h : Y0, 120, Math.abs(h)); g.fillStyle = '#e8eef5'; g.font = '16px monospace'; g.fillText(lab + ' ' + (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2).replace('.', ',') + 'R', x, h >= 0 ? Y0 - h - 8 : Y0 + Math.abs(h) + 20); });
    const sc2 = Object.entries(ml.scores || {}); g.fillStyle = '#e8eef5'; g.font = '16px monospace';
    g.fillText(sc2.length ? 'Ahora: ' + sc2.map(([k, q]) => M.AG[k].name + ' p' + Math.round(q.q * 100) + (q.veto ? ' VETO' : '')).join(' · ') : 'Ninguna señal que puntuar en esta ronda', 18, 304);
    tx.needsUpdate = true;
  }
  function drawBoard(S) {
    const { g, c, tx } = board, t = S.ticks[0];
    g.fillStyle = '#f7f8f6'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#1e3a8a'; g.font = '700 30px sans-serif'; g.fillText('OPERATIVA BTC', 20, 42);
    g.font = '20px sans-serif'; const lines = [];
    for (const k of M.TRADERS) { const n = t && t.notes && t.notes[k], p = n && n.pos; lines.push([M.AG[k].name + ': ' + (p ? (p.side === 'short' ? 'CORTO ' : 'LARGO ') + Math.round(p.entry).toLocaleString('es-ES') + ' · stop ' + Math.round(p.stop).toLocaleString('es-ES') : 'fuera'), p ? (p.side === 'short' ? '#b5382d' : '#0b7a57') : '#334155']); }
    lines.push(['Ríos y Ferrer: en sombra', '#7c2d12']); lines.push(['Riesgo (Salinas): tope 2R abierto', '#7c2d12']); lines.push(['Stops en el exchange, solo a favor', '#7c2d12']);
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
    if (k === 'rios' || k === 'ferrer') { g.fillStyle = '#e2b44a'; g.font = '600 15px monospace'; g.fillText('EN SOMBRA · NO OPERA', 10, 154); tx.needsUpdate = true; return; }
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
  // ---- llegada y salida de la oficina ----
  let officeOn = true, firstTheme = true;
  const showP = (k, v) => { P[k].g.visible = v; tags[k].hidden = !v; bubs[k].hidden = !v; };
  function updateNight() { document.getElementById('night').hidden = officeOn || !M.ORDER.every(k => P[k].home); }
  function sendHome(k, instant) {
    const p = P[k]; if (p.home || p.leaving) return;
    if (erActive) dismiss();
    const gone = () => { p.home = true; p.leaving = false; p.state = 'home'; p.reserved = false; showP(k, false); updateNight(); };
    if (instant || reduce) return gone();
    p.leaving = true; p.reserved = true; say(k, k === 'calvo' ? 'Cierro la oficina. Los stops siguen en el exchange.' : 'Hasta mañana, me voy a casa.', 'ok', 4);
    goTo(p, DOOR.in, () => { p.yaw = -Math.PI / 2; setTimeout(gone, 700); });
  }
  function comeBack(k) {
    const p = P[k]; if (!p.home && !p.leaving) return;
    p.home = false; p.leaving = false; p.reserved = false; showP(k, true);
    if (reduce) { const d = DESKS[k]; p.pos.set(d.seat[0], d.seat[1]); p.state = 'sit'; p.yaw = d.yaw; return; }
    p.pos.set(DOOR.in[0], DOOR.in[1]); p.state = 'stand'; backToDesk(k);
  }
  // ---- theme and time of day ----
  function applyTheme() {
    mats.floor.color.copy(lin(css('--floor'))); mats.wall.color.copy(lin(css('--wall'))); mats.desk.color.copy(lin(css('--desk'))); mats.metal.color.copy(lin(css('--metal')));
    const m = (() => { const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date()).split(':').map(Number); return p[0] + p[1] / 60; })();
    const day = Math.max(0, Math.min(1, Math.min(m - 6.5, 21 - m) / 1.5));
    drawSky(day);
    scene.background = lin(css('--bg')); { const hsl = {}; new T3.Color(css('--bg')).getHSL(hsl); renderer.toneMappingExposure = hsl.l < 0.3 ? 1.7 : 1.05; }
    const open = window.MESA_OPEN ? window.MESA_OPEN() : true;
    if (open !== officeOn || firstTheme) { officeOn = open; M.ORDER.forEach((k, i) => open ? setTimeout(() => comeBack(k), firstTheme ? 0 : i * 2500) : sendHome(k, firstTheme)); }
    firstTheme = false; updateNight();
    hemi.intensity = open ? 0.95 : 0.4; sun.intensity = open ? 0.85 : 0.18;
    document.getElementById('capR').textContent = open ? 'Rondas cada 15 min · L–V 7:00–21:00' : 'Fuera de horario · en casa';
  }
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  setInterval(applyTheme, 60000);

  // ---- camera (drag to orbit) ----
  let az = -0.25, el = 0.88, dist = 34, dragging = null;
  const DBG = window.MESA_CAM; const placeCam = () => { if (DBG) { cam.position.set(DBG[0], DBG[1], DBG[2]); cam.lookAt(DBG[3], DBG[4], DBG[5]); return; } cam.position.set(XC + Math.sin(az) * Math.cos(el) * dist, Math.sin(el) * dist, Math.cos(az) * Math.cos(el) * dist + 2.6); cam.lookAt(XC, 0.4, 2.2); };
  stage.addEventListener('pointerdown', e => { dragging = [e.clientX, e.clientY, az, el]; stage.classList.add('drag'); stage.setPointerCapture(e.pointerId); });
  stage.addEventListener('pointermove', e => { if (!dragging) return; az = dragging[2] - (e.clientX - dragging[0]) * 0.005; el = Math.max(0.35, Math.min(1.25, dragging[3] + (e.clientY - dragging[1]) * 0.004)); az = Math.max(-1.2, Math.min(1.2, az)); placeCam(); });
  const endDrag = () => { dragging = null; stage.classList.remove('drag'); };
  stage.addEventListener('pointerup', endDrag); stage.addEventListener('pointercancel', endDrag);
  function resize() { const r = stage.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); cam.aspect = r.width / Math.max(1, r.height); dist = cam.aspect < 1.2 ? 45 : 34; cam.updateProjectionMatrix(); placeCam(); }
  new ResizeObserver(resize).observe(stage); resize();

  // ---- loop ----
  const v3 = new T3.Vector3();
  function step(dt) {
    const tnow = now();
    cloud.position.y = 2.35 + Math.sin(tnow * 0.8) * 0.05; cloud.rotation.y = Math.sin(tnow * 0.3) * 0.2; bolt.visible = bearPhase === 'mature' && !reduce && (tnow % 4) < 0.18;
    if (!reduce && Math.random() < dt * 25) { const l = leds[Math.floor(Math.random() * leds.length)]; l.material = Math.random() < 0.7 ? ledOn : Math.random() < 0.5 ? ledAmber : ledOff; }
    const blink = erActive ? (Math.sin(tnow * 6) > 0 ? 1 : 0) : 0; beaconMat.emissive.setHex(blink ? 0xff2a1a : erActive ? 0x400806 : 0x000000); alarm.intensity = erActive ? (reduce ? 0.6 : 0.4 + blink * 1.4) : 0;
    const near = M.ORDER.some(k => !P[k].home && Math.hypot(P[k].pos.x - DOOR.in[0], P[k].pos.y - DOOR.in[1]) < 1.6);
    doorAngle += ((near ? -1.35 : 0) - doorAngle) * Math.min(1, dt * 4); hinge.rotation.y = doorAngle;
    for (const k of M.ORDER) {
      const p = P[k];
      if (p.home) continue;
      p.phase += dt * (p.state === 'walk' ? (p.rush ? 12 : 7.5) : 2);
      if (p.state === 'walk') {
        const tgt = p.path[0];
        if (!tgt) { p.state = 'stand'; const f = p.after; p.after = null; f ? f() : backToDesk(k); }
        else { const dx = tgt[0] - p.pos.x, dz = tgt[1] - p.pos.y, d = Math.hypot(dx, dz), sp = (p.rush ? 2.6 : 1.25) * dt; if (d <= sp) { p.pos.set(tgt[0], tgt[1]); p.path.shift(); } else { p.pos.x += dx / d * sp; p.pos.y += dz / d * sp; p.yaw = Math.atan2(dx, dz); } }
      } else if (p.state === 'sit' && officeOn && !meeting && !reduce && tnow > p.until && !p.reserved) wander(k);
      // pose
      const sit = p.state === 'sit', walk = p.state === 'walk', sw = walk ? Math.sin(p.phase) * 0.55 : 0;
      p.g.position.set(p.pos.x, sit ? -0.38 : 0, p.pos.y);
      p.g.rotation.y += ((p.yaw - p.g.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 8);
      p.hipL.rotation.x = sit ? -1.45 : sw; p.hipR.rotation.x = sit ? -1.45 : -sw;
      const typing = sit && (p.reading > tnow || Math.sin(p.phase * 0.7) > 0.2);
      p.shL.rotation.x = sit ? -0.6 + (typing ? Math.sin(p.phase * 9) * 0.08 : 0) : p.state === 'talk' ? -0.35 + Math.sin(p.phase * 2.5) * 0.25 : -sw;
      p.shR.rotation.x = sit ? -0.6 + (typing ? Math.cos(p.phase * 9) * 0.08 : 0) : walk ? sw : -0.15;
      p.head.rotation.x = p.state === 'talk' ? Math.sin(p.phase * 3) * 0.08 : sit ? 0.12 : 0;
      p.knL.rotation.x = sit ? 1.45 : walk ? Math.max(0, -sw) * 1.1 : 0; p.knR.rotation.x = sit ? 1.45 : walk ? Math.max(0, sw) * 1.1 : 0;
      p.elL.rotation.x = sit ? -0.55 + (typing ? Math.sin(p.phase * 9) * 0.1 : 0) : walk ? -0.35 : p.state === 'talk' ? -0.9 + Math.sin(p.phase * 2.5) * 0.3 : -0.2;
      p.elR.rotation.x = sit ? -0.55 + (typing ? Math.cos(p.phase * 9) * 0.1 : 0) : walk ? -0.35 : -0.25;
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
  const seen = new Set(); scene.traverse(o => { const ms = o.material ? [].concat(o.material) : []; for (const m of ms) { if (seen.has(m) || [ledOn, ledAmber, ledOff].includes(m)) continue; seen.add(m); if (m.color && !m.map) m.color.convertSRGBToLinear(); if (m.emissive) m.emissive.convertSRGBToLinear(); if (m.isMeshBasicMaterial && m.map) m.toneMapped = false; } });
  applyTheme(); onData(M.S); requestAnimationFrame(frame);
  // reunión de la auditoría externa (semana del 11 de octubre de 2026): todos a la mesa central
  setTimeout(() => {
    if (!AUDIT_MEET || !officeOn) return;
    meeting = true; let i = 0;
    for (const k of M.ORDER) { const a = Math.PI + (i++) * (Math.PI / 9), spot = SPOTS.table(a); setTimeout(() => goTo(P[k], spot, () => { P[k].state = 'talk'; P[k].yaw = yawTo(spot, [0, 3.6]); }), i * 500); }
    const L = [['calvo', 'Ha llegado la auditoría externa. Va en serio: nuestra ventaja no está demostrada.', 'alerta'],
      ['iturbe', 'Soy Iturbe, validación. Con 2.700 variantes probadas, el Deflated Sharpe es 0,035: los +29R pueden ser suerte.', 'alerta'],
      ['calvo', 'Y el backtest no cobraba el funding: −1,9R al año. Ya se descuenta.', 'idea'],
      ['salinas', 'Desde hoy: Ortega 1R, Vega 0,75R, Paz 0,5R. −3R en 7 días, una semana fuera; −10R, todo parado hasta revisión.', 'idea'],
      ['paz', 'Lo acepto: sin mis 10 mejores operaciones, pierdo. Y 2026 va en −0,25R por operación.', 'ok'],
      ['rios', 'Paso a sombra. Mi variante ganaba, pero se eligió viendo los datos.', 'ok'],
      ['ferrer', 'Sin ventaja demostrada: a sombra yo también.', 'ok'],
      ['duarte', 'Sin veto. Puntúo y comparo en sombra: hoy vetar empeoraría.', 'ok'],
      ['nubarrones', 'Mi veto a los cortos de Ríos aguanta en los dos periodos; el de Paz, a validar.', 'ok'],
      ['calvo', 'Riesgo mínimo hasta 100 operaciones reales. Cada aviso se apunta en el registro.', 'idea']];
    L.forEach(([k, txt, lv], j) => setTimeout(() => say(k, txt, lv, 8), 19000 + j * 8200));
    setTimeout(() => { meeting = false; M.ORDER.forEach(k => backToDesk(k)); }, 19000 + L.length * 8200 + 3000);
  }, 5000);
  // demo-free idle: if there is no round yet, each agent introduces their job once
  setTimeout(() => { if (!M.S.ticks.length) M.ORDER.forEach((k, i) => setTimeout(() => say(k, M.AG[k].job, 'ok', 7), i * 2500)); }, 1500);
})();

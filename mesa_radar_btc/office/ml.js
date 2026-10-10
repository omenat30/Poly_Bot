// Duarte · modelo de calidad (meta-etiquetado). Regresión logística con L2 que estima la probabilidad de que una señal acabe en ganancia.
// Aprende operación a operación: se reentrena en cada ronda con el histórico 2020-26 (ml_hist.json) más cada operación cerrada en vivo,
// pesando más lo reciente (vida media de 2 años) y usando solo operaciones ya cerradas antes de la señal (sin mirar el futuro).
// El filtro solo se activa si se lo gana: en las últimas 200 operaciones puntuadas fuera de muestra, las del cuartil bajo deben rendir
// al menos 0,25R menos que el resto con t ≥ 2. Mientras no, Duarte puntúa en sombra y no veta nada.
(function (root) {
  const AGS = ['vega', 'ortega', 'paz', 'rios', 'ferrer'];
  const ema = (x, n) => { const a = 2 / (n + 1), o = new Array(x.length); let s = x[0]; for (let i = 0; i < x.length; i++) { s = i ? a * x[i] + (1 - a) * s : x[i]; o[i] = s; } return o; };
  const sma = (x, n) => { const o = new Array(x.length).fill(NaN); let s = 0; for (let i = 0; i < x.length; i++) { s += x[i]; if (i >= n) s -= x[i - n]; if (i >= n - 1) o[i] = s / n; } return o; };
  function market(H, FUND) {
    const { c, h, l, t } = H, N = c.length, tr = new Array(N);
    for (let i = 0; i < N; i++) { const pc = i ? c[i - 1] : c[0]; tr[i] = Math.max(h[i] - l[i], Math.abs(h[i] - pc), Math.abs(l[i] - pc)); }
    const A14 = ema(tr, 14), A720 = sma(A14, 720), d = c.map((v, i) => i ? v - c[i - 1] : 0);
    const up = ema(d.map(v => Math.max(v, 0)), 14), dn = ema(d.map(v => Math.max(-v, 0)), 14), RSI = up.map((u, i) => 100 - 100 / (1 + u / Math.max(dn[i], 1e-9)));
    const S200 = sma(c, 4800), S50 = sma(c, 1200);
    // funding conocido al cierre de cada vela: media de las últimas 9 liquidaciones (3 días) y de las últimas 90 (30 días; en vivo, las disponibles)
    const ft = FUND.map(x => x[0]), fr = FUND.map(x => x[1]);
    const fAt = (i, n, partial) => { const te = t[i] + 3600; let j = -1, lo = 0, hi = ft.length - 1; while (lo <= hi) { const m = (lo + hi) >> 1; if (ft[m] <= te) { j = m; lo = m + 1; } else hi = m - 1; }
      if (j < 0 || te > ft[ft.length - 1] + 8 * 3600) return 0; const k = Math.min(n, j + 1); if (k < n && !(partial && k >= 9)) return 0; let s = 0; for (let q = j - k + 1; q <= j; q++) s += fr[q]; return s / k; };
    return { H, A14, A720, RSI, S200, S50, fAt };
  }
  const fin = x => Number.isFinite(x) ? x : 0, sign = x => x > 0 ? 1 : x < 0 ? -1 : 0, mean = a => a.reduce((p, x) => p + x, 0) / a.length;
  function features(M, sigT, a, s, histA, histAll, live) {
    const { c, h, l, t } = M.H; let i = -1, lo = 0, hi = t.length - 1; while (lo <= hi) { const m = (lo + hi) >> 1; if (t[m] < sigT) { i = m; lo = m + 1; } else hi = m - 1; }
    if (i < 480) return null;
    const vol = M.A14[i] / c[i]; let mx = -Infinity, mn = Infinity; for (let q = i - 480; q < i; q++) { mx = Math.max(mx, h[q]); mn = Math.min(mn, l[q]); }
    const f3 = M.fAt(i, 9), f30 = M.fAt(i, 90, live);
    const f = [s, fin(sign(c[i] - M.S200[i]) * s), fin(sign(M.S50[i] - M.S200[i]) * s), fin((c[i] / c[i - 24] - 1) / vol / 5 * s), fin((c[i] / c[i - 168] - 1) / vol / 12 * s),
      fin(Math.log(M.A14[i] / M.A720[i])), fin((M.RSI[i] - 50) / 50 * s), fin(f3 * 1e4 * s), fin((f3 - f30) * 1e4 * s), fin(((c[i] - mn) / (mx - mn + 1e-9) * 2 - 1)) * s,
      histA.length >= 3 ? mean(histA.slice(-10)) : 0, histAll.length >= 3 ? mean(histAll.slice(-10)) : 0, ...AGS.map(x => x === a ? 1 : 0)];
    return f.map(v => Math.max(-4, Math.min(4, v)));
  }
  function solve(A, b) { const n = b.length, M = A.map((r, i) => [...r, b[i]]); for (let p = 0; p < n; p++) { let mx = p; for (let r = p + 1; r < n; r++) if (Math.abs(M[r][p]) > Math.abs(M[mx][p])) mx = r; [M[p], M[mx]] = [M[mx], M[p]];
      for (let r = 0; r < n; r++) if (r !== p) { const f = M[r][p] / M[p][p]; for (let q = p; q <= n; q++) M[r][q] -= f * M[p][q]; } } return M.map((r, i) => r[n] / r[i]); }
  function fit(X, y, w, lam = 3, it = 30) {
    const n = X.length, k = X[0].length, mu = new Array(k).fill(0), sd = new Array(k).fill(0);
    for (const x of X) x.forEach((v, j) => mu[j] += v / n); for (const x of X) x.forEach((v, j) => sd[j] += (v - mu[j]) ** 2 / n); for (let j = 0; j < k; j++) sd[j] = Math.sqrt(sd[j]) + 1e-9;
    const Z = X.map(x => [1, ...x.map((v, j) => (v - mu[j]) / sd[j])]); let b = new Array(k + 1).fill(0);
    for (let r = 0; r < it; r++) {
      const g = new Array(k + 1).fill(0), Hm = Array.from({ length: k + 1 }, () => new Array(k + 1).fill(0));
      for (let i = 0; i < n; i++) { const z = Z[i]; let e = 0; for (let j = 0; j <= k; j++) e += z[j] * b[j]; const p = 1 / (1 + Math.exp(-e)), q = w[i] * p * (1 - p), d = w[i] * (p - y[i]);
        for (let j = 0; j <= k; j++) { g[j] += z[j] * d; for (let m = j; m <= k; m++) Hm[j][m] += z[j] * z[m] * q; } }
      for (let j = 0; j <= k; j++) { for (let m = 0; m < j; m++) Hm[j][m] = Hm[m][j]; if (j) { g[j] += lam * b[j]; Hm[j][j] += lam; } }
      const st = solve(Hm, g); b = b.map((v, j) => v - st[j]); if (Math.max(...st.map(Math.abs)) < 1e-8) break;
    }
    return { b, mu, sd, pred: x => { let e = b[0]; for (let j = 0; j < x.length; j++) e += b[j + 1] * (x[j] - mu[j]) / sd[j]; return 1 / (1 + Math.exp(-e)); } };
  }
  const HL = 2 * 31557600, MINN = 60;
  function train(T, upTo) { const tr = T.filter(x => x.t1 <= upTo); if (tr.length < MINN) return null; const m = fit(tr.map(x => x.x), tr.map(x => x.r > 0 ? 1 : 0), tr.map(x => 0.5 ** ((upTo - x.t0) / HL))); const ps = tr.map(x => m.pred(x.x)); m.q = p => ps.filter(v => v < p).length / ps.length; m.n = tr.length; return m; }
  // hist: ml_hist.json; H/FUND: datos en vivo; R: resultados del motor por agente; pend: [{agent, sigT, side}] señales a puntuar
  function run(hist, H, FUND, R, pend) {
    const M = market(H, FUND), T = hist.rows.map(r => ({ t0: r[0], t1: r[1], a: r[2], s: r[3], r: r[4], x: r[5], q: r[6], src: 'hist' }));
    const fresh = AGS.flatMap(a => (R[a] ? R[a].trades : []).filter(x => x.sigT > hist.cutoff).map(x => ({ t0: x.sigT, t1: x.exitT, a, s: x.side, r: x.r, src: 'vivo' }))).sort((p, q) => p.t0 - q.t0);
    const histOf = (t0, a) => { const c = T.filter(x => x.t1 <= t0).sort((p, q) => p.t1 - q.t1); return [c.filter(x => x.a === a).map(x => x.r), c.map(x => x.r)]; };
    for (const x of fresh) { const [ha, hall] = histOf(x.t0, x.a); x.x = features(M, x.t0, x.a, x.s, ha, hall, true); if (!x.x) continue; const m = train(T, x.t0); x.q = m ? m.q(m.pred(x.x)) : null; T.push(x); }
    const scored = T.filter(x => x.q != null).slice(-200), lo = scored.filter(x => x.q < 0.25).map(x => x.r), hi = scored.filter(x => x.q >= 0.25).map(x => x.r);
    const v = a => { const m = mean(a); return a.reduce((p, x) => p + (x - m) ** 2, 0) / (a.length - 1); };
    const diff = mean(hi) - mean(lo), tt = diff / Math.sqrt(v(hi) / hi.length + v(lo) / lo.length), active = lo.length >= 30 && diff >= 0.25 && tt >= 2;
    const now = Math.max(...H.t) + 3600, m = train(T, now), out = {};
    for (const p of pend || []) { const [ha, hall] = histOf(p.sigT, p.agent), x = features(M, p.sigT, p.agent, p.side, ha, hall, true); if (!x || !m) continue; const pr = m.pred(x), q = m.q(pr); out[p.agent] = { p: +pr.toFixed(3), q: +q.toFixed(2), veto: active && q < 0.25 }; }
    const coef = m ? Object.fromEntries(hist.names.map((n, j) => [n, +m.b[j + 1].toFixed(2)])) : {};
    return { n: m ? m.n : 0, live: fresh.length, active, diff: +diff.toFixed(2), t: +tt.toFixed(2), lowR: +mean(lo).toFixed(2), restR: +mean(hi).toFixed(2), scores: out, coef, M, features, fit };
  }
  const api = { run, features, market, fit, AGS };
  if (typeof module !== 'undefined') module.exports = api; else root.MesaML = api;
})(this);

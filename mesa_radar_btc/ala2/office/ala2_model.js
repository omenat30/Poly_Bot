// Ala 2 · evaluación de los modelos (árboles de LightGBM exportados a JSON compacto) y de la calibración de Beltrán (isotónica).
// Formato de cada árbol: { f:[variable], th:[umbral], dl:[1 si el valor ausente va a la izquierda], mt:[0 None, 1 Zero, 2 NaN], lc:[hijo izq], rc:[hijo der], lv:[hojas] }
// Hijo >= 0: otro nodo; hijo < 0: hoja ~hijo. Reproduce la regla de LightGBM para valores ausentes.
'use strict';
function tree(T, x) {
  if (!T.f.length) return T.lv[0];
  let n = 0;
  for (;;) {
    let v = x[T.f[n]], left;
    if (T.mt[n] === 2 && Number.isNaN(v)) left = T.dl[n] === 1;
    else { if (Number.isNaN(v)) v = 0; left = T.mt[n] === 1 && Math.abs(v) <= 1e-35 ? T.dl[n] === 1 : v <= T.th[n]; }
    const c = left ? T.lc[n] : T.rc[n];
    if (c < 0) return T.lv[~c];
    n = c;
  }
}
const predict = (M, x) => { let s = 0; for (const T of M.trees) s += tree(T, x); return s; };
// isotónica: interpolación lineal entre umbrales y recorte fuera de rango (igual que sklearn)
function iso(C, p) {
  const X = C.x, Y = C.y, n = X.length;
  if (!n || !Number.isFinite(p)) return NaN;
  if (p <= X[0]) return Y[0]; if (p >= X[n - 1]) return Y[n - 1];
  let lo = 0, hi = n - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (X[m] <= p) lo = m; else hi = m; }
  return X[hi] === X[lo] ? Y[hi] : Y[lo] + (Y[hi] - Y[lo]) * (p - X[lo]) / (X[hi] - X[lo]);
}
// Una decisión completa de una versión V: predicciones de Montes, Aranda y Lagos, y EV / probabilidad calibrados para el agregador `agg`.
function decide(V, x, names) {
  const pick = cols => cols.map(k => x[names.indexOf(k)]);
  const xl = pick(V.cols.liq), xt = pick(V.cols.tec);
  const p = { liqL: predict(V.models.liqL, xl), liqS: predict(V.models.liqS, xl), tecL: predict(V.models.tecL, xt), tecS: predict(V.models.tecS, xt) };
  const xd = [p.liqL, p.liqS, p.tecL, p.tecS].concat(pick(V.cols.dir));
  p.dirL = predict(V.models.dirL, xd); p.dirS = predict(V.models.dirS, xd);
  p.avgL = (p.liqL + p.tecL) / 2; p.avgS = (p.liqS + p.tecS) / 2;
  const out = {};
  for (const agg of ['dir', 'avg']) {
    const evL = iso(V.cal[agg + 'Lev'], p[agg + 'L']), evS = iso(V.cal[agg + 'Sev'], p[agg + 'S']);
    const pwL = iso(V.cal[agg + 'Lpw'], p[agg + 'L']), pwS = iso(V.cal[agg + 'Spw'], p[agg + 'S']);
    out[agg] = evL >= evS ? { side: 1, ev: evL, pw: pwL, evOther: evS } : { side: -1, ev: evS, pw: pwS, evOther: evL };
  }
  return { p, out };
}
module.exports = { tree, predict, iso, decide };

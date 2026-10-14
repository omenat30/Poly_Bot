"""Medición: ¿las alertas rinden más que tokens elegidos al azar con la misma capitalización?

Reglas fijadas antes de ver datos (ver HIPOTESIS.md):
  - Cohorte = primera observación con puntuación >= track_score de cada token.
  - Las 12 variantes de variants.json son filtros sobre esa cohorte.
  - Se ordena la cohorte por hora; primera mitad = elegir variante; segunda = probar.
    Solo la variante elegida se mira en la segunda mitad.
  - Retorno NETO: retraso de entrada, comisión, deslizamiento y comisión de red.
  - Control: tokens sin alerta con capitalización similar (±25 %), seguidos igual.
  - Falta de precio de salida se cuenta como pérdida total (conservador) y se informa.
"""
from . import costs, stats
from .util import median
from .variants import load_variants, passes

HNAME = {300: "5m", 3600: "1h", 86400: "24h"}


def _first_at_or_after(series, t, tol):
    for s in series:
        if s["ts"] >= t:
            return s if s["ts"] - t <= tol else None
    return None


def compute_rets(series, t_obs, cfg, now, horizons=None):
    """Retornos netos desde una observación en t_obs. Devuelve {h: {ret, rug, status}}."""
    horizons = horizons or cfg["analysis"]["horizons_s"]
    lat = cfg["costs"]["latency_s"]
    out = {}
    entry = _first_at_or_after(series, t_obs + lat, 150)
    if entry is None:
        st = "pendiente" if now < t_obs + lat + 150 else "sin_entrada"
        return {h: {"ret": None, "rug": None, "status": st} for h in horizons}
    for h in horizons:
        tol = max(150, 0.05 * h)
        due = entry["ts"] + h
        ex = _first_at_or_after(series, due, tol)
        if ex is None:
            out[h] = {"ret": None, "rug": None, "status": "pendiente" if now < due + tol else "falta"}
        else:
            r, rug = costs.net_return(entry, ex, cfg)
            out[h] = {"ret": r, "rug": rug, "status": "ok"}
    return out


def value(o):
    """Valor para estadísticas: retorno, -100 % si falta (conservador) o None si pendiente."""
    if o["status"] == "ok":
        return o["ret"]
    if o["status"] in ("falta", "sin_entrada"):
        return -1.0
    return None


def alert_outcomes(store, cfg, now):
    out = {}
    for a in store.alerts():
        ser = store.series(a["mint"])
        r = compute_rets(ser, a["ts"], cfg, now)
        out[a["mint"]] = {HNAME[h]: {"ret": v["ret"], "rug": v["rug"], "status": v["status"]} for h, v in r.items()}
    return out


def _first_pass(obs, variant):
    for o in obs:
        if passes(variant, o["features"]):
            return o
    return None


def collect(store, cfg, now):
    """Entradas por variante + controles, con retornos al horizonte principal."""
    ph = cfg["analysis"]["primary_horizon_s"]
    variants = load_variants()
    base = {"min_score": cfg["track_score"]}
    by_mint = {}
    for o in store.observations():
        by_mint.setdefault(o["mint"], []).append(o)
    series_cache = {}

    def ser(m):
        if m not in series_cache:
            series_cache[m] = store.series(m)
        return series_cache[m]

    control_mints = {t["mint"] for t in store.all_tracked("control")}

    def entry_of(variant):
        res = []
        for m, obs in by_mint.items():
            if m in control_mints:  # un control nunca cuenta también como candidato
                continue
            o = _first_pass(obs, variant)
            if not o:
                continue
            r = compute_rets(ser(m), o["ts"], cfg, now, [ph])[ph]
            res.append({"mint": m, "ts": o["ts"], "mcap": o["mcap"], "score": o["features"]["score"],
                        "features": o["features"],
                        "ret": value(r), "rug": r["rug"], "status": r["status"]})
        return sorted(res, key=lambda e: e["ts"])

    cohort = entry_of(base)
    per_variant = {v["id"]: entry_of(v) for v in variants}
    controls = []
    for t in store.all_tracked("control"):
        r = compute_rets(ser(t["mint"]), t["start_ts"], cfg, now, [ph])[ph]
        controls.append({"mint": t["mint"], "ts": t["start_ts"], "mcap": t["mcap0"], "ret": value(r),
                         "rug": r["rug"], "status": r["status"]})
    return variants, cohort, per_variant, controls


def paired_diffs(entries, controls, band, ts_lo=None, ts_hi=None):
    """Para cada entrada con retorno conocido: su retorno menos la media de controles de mcap parecido."""
    ds, rets, dropped = [], [], 0
    cs = [c for c in controls if c["ret"] is not None and (ts_lo is None or c["ts"] > ts_lo)
          and (ts_hi is None or c["ts"] <= ts_hi)]
    for e in entries:
        if e["ret"] is None:
            continue
        near = [c["ret"] for c in cs if e["mcap"] and abs(c["mcap"] - e["mcap"]) / e["mcap"] <= band]
        if not near:
            dropped += 1
            continue
        ds.append(e["ret"] - stats.mean(near))
        rets.append(e["ret"])
    return ds, rets, dropped


def _summary(rets, ds, dropped, entries, cfg):
    a = cfg["analysis"]
    rugs = [e for e in entries if e["rug"]]
    pend = sum(1 for e in entries if e["status"] == "pendiente")
    out = {"n": len(rets), "pendientes": pend, "sin_control": dropped,
           "rug_pct": (len(rugs) / len(entries) * 100) if entries else None,
           "faltan_precio": sum(1 for e in entries if e["status"] in ("falta", "sin_entrada"))}
    if rets:
        out.update({"mean_ret": stats.mean(rets), "median_ret": median(rets),
                    "win_pct": sum(1 for r in rets if r > 0) / len(rets) * 100,
                    "ci90_mean": stats.bootstrap_ci(rets, seed=a["seed"])})
    if ds:
        out.update({"mean_excess": stats.mean(ds), "median_excess": median(ds),
                    "p_excess": stats.signflip_test(ds, a["perm"], a["seed"])})
    return out


def exploratory(cohort, a, min_n=20):
    """Correlación de cada dato extra de GMGN (gx_*) con el retorno neto. SOLO DESCRIPTIVO:
    son muchas pruebas sin corrección y no se usa para decidir nada. Si alguno parece útil se
    pre-registra en HIPOTESIS_v3 y se prueba con datos nuevos."""
    keys = sorted({k for e in cohort for k in e.get("features", {}) if k.startswith("gx_")})
    out = []
    for k in keys:
        pairs = [(e["features"][k], e["ret"]) for e in cohort
                 if e["ret"] is not None and isinstance(e["features"].get(k), (int, float))]
        if len(pairs) < min_n:
            continue
        rho, p = stats.spearman_perm_p([x for x, _ in pairs], [y for _, y in pairs], n=1000, seed=a["seed"])
        if rho is not None:
            out.append({"feature": k[3:], "n": len(pairs), "spearman": rho, "p": p})
    return sorted(out, key=lambda r: -abs(r["spearman"]))


def build_report(store, cfg, now):
    a = cfg["analysis"]
    band = 0.25
    variants, cohort, per_variant, controls = collect(store, cfg, now)
    ph = HNAME.get(a["primary_horizon_s"], "1h")
    rep = {"generated_at": now, "horizon": ph, "n_cohort": len(cohort),
           "n_controls": sum(1 for c in controls if c["ret"] is not None),
           "n_variants": len(variants), "verdict": None, "detail": ""}
    if len(cohort) < 2 * a["min_n_select"]:
        rep["verdict"] = "SIN DATOS SUFICIENTES"
        rep["detail"] = (f"Hay {len(cohort)} candidatos en la cohorte y se necesitan al menos "
                         f"{2 * a['min_n_select']} para partirla en dos mitades. Sigue midiendo.")
        return rep
    cut = cohort[len(cohort) // 2 - 1]["ts"]
    rep["cut_ts"] = cut
    table, best, best_v = [], None, None
    for v in variants:
        es = [e for e in per_variant[v["id"]] if e["ts"] <= cut]
        ds, rets, dropped = paired_diffs(es, controls, band, None, cut)
        row = {"id": v["id"], "desc": v["desc"], "n_select": len(ds),
               "mean_excess": stats.mean(ds) if ds else None, "mean_ret": stats.mean(rets) if rets else None}
        table.append(row)
        if len(ds) >= a["min_n_select"] and (best is None or row["mean_excess"] > best):
            best, best_v = row["mean_excess"], v
    rep["selection_table"] = table
    if best_v is None:
        rep["verdict"] = "SIN DATOS SUFICIENTES"
        rep["detail"] = f"Ninguna variante llega a {a['min_n_select']} alertas con control en la primera mitad."
        return rep
    rep["chosen"] = {"id": best_v["id"], "desc": best_v["desc"], "select_excess": best}
    et = [e for e in per_variant[best_v["id"]] if e["ts"] > cut]
    ds, rets, dropped = paired_diffs(et, controls, band, cut, None)
    rep["test"] = _summary(rets, ds, dropped, et, cfg)
    # ¿puntúa mejor = rinde más? Toda la cohorte
    xs = [e["score"] for e in cohort if e["ret"] is not None]
    ys = [e["ret"] for e in cohort if e["ret"] is not None]
    rho, p_rho = stats.spearman_perm_p(xs, ys, seed=a["seed"])
    rep["score_vs_return"] = {"n": len(xs), "spearman": rho, "p": p_rho}
    rep["exploratory"] = exploratory(cohort, a)
    t = rep["test"]
    if len(ds) < a["min_n_test"]:
        rep["verdict"] = "SIN DATOS SUFICIENTES"
        rep["detail"] = (f"La variante elegida ({best_v['id']}) tiene {len(ds)} alertas con control en la segunda mitad; "
                         f"se necesitan {a['min_n_test']}. No se concluye nada todavía.")
    elif t.get("mean_excess", 0) > 0 and t.get("median_ret", -1) > 0 and (t.get("p_excess") or 1) < a["alpha"]:
        rep["verdict"] = "SUPERA AL AZAR (provisional)"
        rep["detail"] = ("En la segunda mitad la variante elegida rinde más que el azar con la misma capitalización, "
                         "con retorno neto de costes y mediana positiva. Aun así: repite con más semanas antes de usar dinero.")
    else:
        rep["verdict"] = "DESCARTAR"
        rep["detail"] = ("En la segunda mitad la variante elegida no supera con claridad al azar con la misma capitalización "
                         "(exceso medio, mediana o significación insuficientes). Se documenta como idea descartada.")
    return rep

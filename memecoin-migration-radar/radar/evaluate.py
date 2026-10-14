"""Puntuación de un token. Función pura: recibe datos ya descargados, no hace red.

Criterios (puntúan 0-100, pesos en config):
  curve · volume · wallets · history · manipulation
Puertas duras (descartan el token): capitalización mínima, tramo de curva,
filtros de seguridad y umbrales de manipulación.
"""
from collections import defaultdict

from . import clusters as cl
from . import costs, manipulation, security
from .util import clamp, median

LABELS = {
    "curve": "Curva y capitalización",
    "volume": "Volumen real",
    "wallets": "Wallets independientes",
    "history": "Historial de wallets",
    "manipulation": "Sin manipulación",
}


def curve_progress(coin, cfg):
    """% de la curva completado = tokens vendidos / 793,1 M, que es lo que muestra pump.fun.
    VERIFICADO con datos reales: medirlo en SOL (real_sol / 85) subestima hasta 20 puntos porque la
    curva no es lineal (un token con 74 SOL reales está al 96 % de tokens, no al 87 %)."""
    if coin.get("complete") or coin.get("pool"):
        return 100.0  # ya migrado (o con pool): llegamos tarde
    rt = coin.get("real_tokens")
    if rt is not None:
        return clamp(1 - rt / cfg["curve_tokens_initial"], 0, 1.0) * 100
    real = coin.get("real_sol")
    if real is not None and cfg["curve_target_sol"] > 0:
        return clamp(real / cfg["curve_target_sol"], 0, 1.0) * 100  # solo como último recurso
    return 0.0


def score_curve(progress, mcap, cfg):
    g = cfg["gates"]
    ok, notes = True, []
    if mcap < g["min_mcap_usd"]:
        ok = False
        notes.append(f"capitalización {mcap:,.0f} < {g['min_mcap_usd']:,} USD")
    if progress < g["min_curve_pct"]:
        ok = False
        notes.append(f"curva {progress:.0f}% < {g['min_curve_pct']}%")
    if progress >= g["max_curve_pct"]:
        ok = False
        notes.append("ya migrado o migrando: tarde")
    span = max(g["max_curve_pct"] - g["min_curve_pct"], 1)
    score = 100 * clamp((progress - g["min_curve_pct"]) / span)
    if not notes:
        notes.append(f"curva {progress:.0f}% · {mcap:,.0f} USD")
    return {"score": round(score, 1), "ok": ok, "note": " · ".join(notes)}


def score_volume(trades, now, cfg):
    v = cfg["volume"]
    w = v["window_s"]
    rec = [t for t in trades if now - w <= t["ts"] <= now]
    prev = [t for t in trades if now - 2 * w <= t["ts"] < now - w]
    ub = len({t["wallet"] for t in rec if t["is_buy"]})
    ubp = len({t["wallet"] for t in prev if t["is_buy"]})
    buy = sum(t["sol"] for t in rec if t["is_buy"])
    sell = sum(t["sol"] for t in rec if not t["is_buy"])
    growth = (ub / ubp) if ubp else (min(ub, 3.0) if ub else 0.0)
    ratio = buy / sell if sell > 0.01 else (3.0 if buy > 0 else 0.0)
    buckets = defaultdict(float)
    for t in rec:
        buckets[int(t["ts"] // 60)] += t["sol"]
    tot = sum(buckets.values())
    spike = (max(buckets.values()) / tot) if tot else 1.0
    covered = bool(trades) and min(t["ts"] for t in trades) <= now - 2 * w
    s_ub = 40 * clamp(ub / v["min_unique_buyers"])
    s_gr = 25 * clamp((growth - 1) / 1.0)
    s_ra = 25 * clamp((ratio - 1) / (v["min_buy_sell_ratio"] * 2 - 1 - 0.0) if v["min_buy_sell_ratio"] else 0)
    s_sp = 10 * (1 - clamp((spike - 0.3) / (v["max_spike_share"] - 0.3)))
    score = s_ub + s_gr + s_ra + s_sp
    return {
        "score": round(score, 1), "ok": True,
        "note": (f"{ub} compradores únicos (prev {ubp}) · compra/venta {ratio:.1f} · "
                 f"mayor minuto {spike*100:.0f}%" + ("" if covered else " · cobertura parcial")),
        "metrics": {"unique_buyers": ub, "unique_buyers_prev": ubp, "growth": round(growth, 2),
                    "buy_sol": round(buy, 2), "sell_sol": round(sell, 2), "ratio": round(ratio, 2),
                    "spike_share": round(spike, 2), "covered": covered, "vol_sol": round(buy + sell, 2)},
    }


def select_wallets(trades, holders, cfg):
    """Primeros compradores + mayores holders (sin curva ni pool)."""
    wc = cfg["wallets"]
    first, seen = [], set()
    for t in sorted(trades, key=lambda t: t["ts"]):
        if t["is_buy"] and t["wallet"] not in seen:
            seen.add(t["wallet"])
            first.append(t["wallet"])
        if len(first) >= wc["first_buyers"]:
            break
    top = [h["owner"] for h in holders[: wc["top_holders"]]]
    out = []
    for w in top + first:
        if w not in out:
            out.append(w)
    return out


def evaluate_token(coin, trades, holders, mint_info, creator_coins, wallet_data, cfg, now, excluded=0.0, extras=None):
    """coin: normalizado. trades: lista normalizada. holders: [{owner, amount}] sin curva/pool
    ordenados de mayor a menor. mint_info: {mint_authority, freeze_authority, supply} o None.
    wallet_data: {wallet: {"parsed": ..., "summary": ...}}. excluded: tokens en la curva y el pool.
    Circulante = suministro - excluded (nunca menos que la suma de holders conocidos).
    extras: datos adicionales de GMGN que SE REGISTRAN pero NO puntúan (ver HIPOTESIS_v2.md).
    Devuelve el resultado completo."""
    mcap = coin.get("mcap_usd") or 0.0
    progress = curve_progress(coin, cfg)
    crit = {"curve": score_curve(progress, mcap, cfg), "volume": score_volume(trades, now, cfg)}

    known = sum(h["amount"] for h in holders)
    supply = (mint_info or {}).get("supply") or cfg["total_supply"]
    circ = max(supply - excluded, known)
    balances = {h["owner"]: h["amount"] for h in holders}
    wallets = select_wallets(trades, holders, cfg)
    funders = {w: (d["parsed"]["funder"], d["parsed"]["funded_ts"]) for w, d in wallet_data.items()
               if d.get("parsed") and d["parsed"].get("funder")}
    wset = set(wallets)
    transfers = [(w, c) for w, d in wallet_data.items() if d.get("parsed")
                 for c in d["parsed"]["counterparties"] if c in wset and w in wset]
    slot_buys = defaultdict(list)
    for t in trades:
        if t["is_buy"] and t.get("slot") and t["wallet"] in wset:
            slot_buys[t["slot"]].append(t["wallet"])
    clusters, links = cl.build_clusters(wallets, funders, transfers, slot_buys, cfg)
    ind = cl.independence(clusters, balances)

    wc = cfg["wallets"]
    if not holders:
        crit["wallets"] = {"score": 0.0, "ok": True, "note": "sin datos de holders"}
    else:
        s_eff = 70 * clamp(ind["effective"] / wc["target_independent"])
        s_dom = 30 * (1 - clamp(ind["largest_pct"] / wc["max_cluster_pct"]))
        crit["wallets"] = {
            "score": round(s_eff + s_dom, 1), "ok": True,
            "note": (f"{ind['effective']:.1f} holders independientes efectivos · {ind['n_clusters']} entidades · "
                     f"{ind['multi']} clústeres multi-wallet · mayor {ind['largest_pct']:.0f}%"),
        }

    sums = [wallet_data[w]["summary"] for w in wallets if w in wallet_data and wallet_data[w].get("summary")]
    with_data = [s for s in sums if s["has_data"]]
    n_expected = max(len(wallets), 1)
    coverage = min(1.0, len(with_data) / n_expected)
    q = sum(1 for s in with_data if s["quality"])
    q_share = q / len(with_data) if with_data else 0.0
    crit["history"] = {
        "score": round(100 * q_share * clamp(coverage / 0.5), 1), "ok": True,
        "note": (f"{q}/{len(with_data)} wallets con historial rentable que no sale al entrar · "
                 f"cobertura {coverage*100:.0f}%" + (" · SIN DATOS" if not with_data else "")),
        "metrics": {"quality": q, "with_data": len(with_data), "coverage": round(coverage, 2),
                    "bots": sum(1 for s in with_data if s["bot"]),
                    "median_hold_s": median([s["median_hold_s"] for s in with_data if s["median_hold_s"] is not None]),
                    "pnl_sol_total": round(sum(s["pnl_sol"] for s in with_data), 2)},
    }

    wc_map = {}
    for i, c in enumerate(clusters):
        for w in c:
            wc_map[w] = i
    wash = manipulation.wash_stats(trades, wc_map, cfg)
    creator = coin.get("creator")
    creator_pct = (balances.get(creator, 0.0) / circ * 100) if circ and creator else 0.0
    crit["manipulation"] = manipulation.score_manipulation(wash, creator_pct, ind["largest_pct"], cfg)

    top10 = (sum(h["amount"] for h in holders[:10]) / circ * 100) if circ else None
    prev_rugs = None
    if creator_coins is not None:
        prev_rugs, _unk = security.count_prev_rugs(creator_coins, cfg["security"], coin.get("mint"))
    sec = security.evaluate({
        "mint_known": mint_info is not None,
        "mint_authority": (mint_info or {}).get("mint_authority"),
        "freeze_authority": (mint_info or {}).get("freeze_authority"),
        "top10_pct": top10, "prev_rugs": prev_rugs,
        "honeypot": security.honeypot_from_trades(trades, creator, cfg["security"]["min_sells_for_sellable"]),
    }, cfg)

    wts = cfg["weights"]
    raw = sum(wts[k] * crit[k]["score"] for k in wts) / sum(wts.values())
    hard = [f"{LABELS[k]}: {crit[k]['note']}" for k in ("curve", "manipulation") if not crit[k]["ok"]]
    discarded = bool(hard) or not sec["ok"]
    reasons = hard + sec["fails"]
    slip = costs.entry_slippage(coin, cfg)
    return {
        "mint": coin.get("mint"), "ts": now, "progress": round(progress, 2), "mcap": mcap,
        "price": coin.get("price_usd"), "raw_score": round(raw, 1),
        "score": 0.0 if discarded else round(raw, 1), "discarded": discarded, "reasons": reasons,
        "criteria": {k: {"label": LABELS[k], "weight": wts[k], **crit[k]} for k in wts},
        "security": sec, "links": links[:20], "extras": extras or {},
        "features": {
            "progress": round(progress, 2), "mcap": mcap, "score": 0.0 if discarded else round(raw, 1),
            "unique_buyers": crit["volume"]["metrics"]["unique_buyers"],
            "eff_independent": round(ind["effective"], 2), "largest_cluster_pct": round(ind["largest_pct"], 1),
            "quality_share": round(q_share, 2), "coverage": round(coverage, 2),
            "wash_share": round(max(wash["wash_share"], wash["circular_share"]), 3),
            "top10_pct": None if top10 is None else round(top10, 1), "creator_pct": round(creator_pct, 1),
            "prev_rugs": prev_rugs, "sec_ok": sec["ok"], "discarded": discarded,
            "slip_buy_pct": slip, "vsol": coin.get("virtual_sol"), "vtok": coin.get("virtual_tokens"),
            "sol_usd": coin.get("sol_usd"),
            **{f"gx_{k}": v for k, v in (extras or {}).items() if isinstance(v, (int, float)) and not isinstance(v, bool)},
        },
    }

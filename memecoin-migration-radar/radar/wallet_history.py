"""Historial de una wallet a partir de transacciones enriquecidas de Helius.

FORMATO SIN VERIFICAR: se asume `events.swap` con nativeInput/nativeOutput y
tokenInputs/tokenOutputs, y `nativeTransfers`. `python -m radar check` comprueba
con una wallet real si el formato coincide. Si no coincide, la wallet sale como
«sin datos» y el criterio de historial se penaliza por baja cobertura; nunca se
inventa un resultado.

Sesgo conocido: solo se mide ganancia REALIZADA. Las posiciones abiertas que
nunca se vendieron (los «bags» perdedores) no restan; se cuentan aparte.
"""
from .util import median

LAMPORTS = 1e9


def _tok(raw):
    try:
        return int(raw["tokenAmount"]) / (10 ** int(raw.get("decimals", 0)))
    except Exception:
        try:
            return float(raw.get("tokenAmount", 0))
        except Exception:
            return 0.0


def parse_wallet_txs(wallet, txs, limit=100, min_fund_sol=0.02):
    """Devuelve dict con posiciones por mint, fondeador (si fiable) y contrapartes."""
    positions = {}
    counter = set()
    funder = None
    funded_ts = None
    n_trades = 0
    ts_all = []
    for tx in txs or []:
        ts = tx.get("timestamp") or 0
        ts_all.append(ts)
        for nt in tx.get("nativeTransfers") or []:
            fr, to, amt = nt.get("fromUserAccount"), nt.get("toUserAccount"), nt.get("amount", 0)
            if fr == wallet and to:
                counter.add(to)
            elif to == wallet and fr:
                counter.add(fr)
                if amt / LAMPORTS >= min_fund_sol and (funded_ts is None or ts < funded_ts):
                    funder, funded_ts = fr, ts
        for tt in tx.get("tokenTransfers") or []:
            fr, to = tt.get("fromUserAccount"), tt.get("toUserAccount")
            if fr == wallet and to:
                counter.add(to)
            elif to == wallet and fr:
                counter.add(fr)
        sw = (tx.get("events") or {}).get("swap")
        if not sw:
            continue
        ni, no = sw.get("nativeInput"), sw.get("nativeOutput")
        tin, tout = sw.get("tokenInputs") or [], sw.get("tokenOutputs") or []
        if ni and tout and ni.get("account") == wallet:
            mint, sol, tokens, side = tout[0].get("mint"), int(ni["amount"]) / LAMPORTS, _tok(tout[0].get("rawTokenAmount") or {}), "buy"
        elif no and tin and no.get("account") == wallet:
            mint, sol, tokens, side = tin[0].get("mint"), int(no["amount"]) / LAMPORTS, _tok(tin[0].get("rawTokenAmount") or {}), "sell"
        else:
            continue
        if not mint:
            continue
        n_trades += 1
        p = positions.setdefault(mint, {"buy_sol": 0.0, "buy_tok": 0.0, "sell_sol": 0.0, "sell_tok": 0.0,
                                        "first_buy": None, "first_sell": None, "last_sell": None})
        if side == "buy":
            p["buy_sol"] += sol
            p["buy_tok"] += tokens
            p["first_buy"] = ts if p["first_buy"] is None else min(p["first_buy"], ts)
        else:
            p["sell_sol"] += sol
            p["sell_tok"] += tokens
            p["first_sell"] = ts if p["first_sell"] is None else min(p["first_sell"], ts)
            p["last_sell"] = ts if p["last_sell"] is None else max(p["last_sell"], ts)
    span = (max(ts_all) - min(ts_all)) if len(ts_all) > 1 else 0
    reliable = len(txs or []) < limit  # vimos todo su historial, el primer fondeo es de verdad
    return {
        "wallet": wallet,
        "positions": positions,
        "funder": funder if reliable else None,
        "funded_ts": funded_ts if reliable else None,
        "counterparties": sorted(counter),
        "n_trades": n_trades,
        "n_txs": len(txs or []),
        "span_s": span,
    }


def summarize(parsed, cfg):
    """Resumen de calidad de una wallet. `quality` solo si hay datos suficientes."""
    h = cfg["history"]
    pos = parsed["positions"]
    sold = [p for p in pos.values() if p["buy_tok"] > 0 and p["first_sell"] is not None and p["first_buy"] is not None]
    closed = [p for p in sold if p["sell_tok"] >= 0.9 * p["buy_tok"]]
    holds = [max(p["first_sell"] - p["first_buy"], 0) for p in sold]
    pnl = sum(p["sell_sol"] - p["buy_sol"] for p in closed)
    wins = sum(1 for p in closed if p["sell_sol"] > p["buy_sol"])
    quick = sum(1 for hd in holds if hd < h["quick_exit_s"])
    open_unsold = sum(1 for p in pos.values() if p["buy_tok"] > 0 and p["first_sell"] is None)
    days = max(parsed["span_s"] / 86400, 0.05)
    bot = parsed["n_trades"] / days > h["bot_trades_per_day"]
    has_data = len(sold) >= 1
    med_hold = median(holds)
    quick_ratio = quick / len(holds) if holds else None
    quality = bool(
        len(closed) >= h["min_closed"] and pnl > 0 and med_hold is not None and med_hold >= h["min_hold_s"]
        and quick_ratio is not None and quick_ratio <= h["max_quick_exit_ratio"] and not bot
    )
    if bot:
        reason = "probable bot (demasiadas operaciones por día)"
    elif len(closed) < h["min_closed"]:
        reason = f"pocas posiciones cerradas ({len(closed)})"
    elif pnl <= 0:
        reason = "ganancia realizada no positiva"
    elif med_hold < h["min_hold_s"] or (quick_ratio or 0) > h["max_quick_exit_ratio"]:
        reason = "sale demasiado rápido"
    else:
        reason = "ok"
    return {
        "wallet": parsed["wallet"], "has_data": has_data, "closed": len(closed), "sold": len(sold),
        "pnl_sol": round(pnl, 3), "win_rate": (wins / len(closed)) if closed else None,
        "median_hold_s": med_hold, "quick_exit_ratio": quick_ratio, "open_unsold": open_unsold,
        "bot": bot, "quality": quality, "reason": reason,
    }


def parse_gmgn_activity(wallet, rows, funder=None, funder_ts=None, usd_per_sol=150.0):
    """Mismo resultado que parse_wallet_txs, a partir de /v1/user/wallet_activity de GMGN.
    Los importes llegan en USD; se pasan a SOL con `usd_per_sol` para que `summarize` sea igual.
    Las transferencias (transferIn/Out) NO son operaciones: se ignoran. Formato SIN VERIFICAR."""
    positions, ts_all, n_trades = {}, [], 0
    for r in rows or []:
        kind = r.get("event_type") or r.get("type")
        ts = r.get("timestamp") or 0
        ts_all.append(ts)
        if kind not in ("buy", "sell"):
            continue
        mint = (r.get("token") or {}).get("address")
        try:
            usd, tok = float(r.get("cost_usd") or 0), float(r.get("token_amount") or 0)
        except (TypeError, ValueError):
            continue
        if not mint:
            continue
        n_trades += 1
        p = positions.setdefault(mint, {"buy_sol": 0.0, "buy_tok": 0.0, "sell_sol": 0.0, "sell_tok": 0.0,
                                        "first_buy": None, "first_sell": None, "last_sell": None})
        if kind == "buy":
            p["buy_sol"] += usd / usd_per_sol
            p["buy_tok"] += tok
            p["first_buy"] = ts if p["first_buy"] is None else min(p["first_buy"], ts)
        else:
            p["sell_sol"] += usd / usd_per_sol
            p["sell_tok"] += tok
            p["first_sell"] = ts if p["first_sell"] is None else min(p["first_sell"], ts)
            p["last_sell"] = ts if p["last_sell"] is None else max(p["last_sell"], ts)
    span = (max(ts_all) - min(ts_all)) if len(ts_all) > 1 else 0
    return {"wallet": wallet, "positions": positions, "funder": funder, "funded_ts": funder_ts,
            "counterparties": [], "n_trades": n_trades, "n_txs": len(rows or []), "span_s": span}

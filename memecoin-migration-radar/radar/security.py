"""Filtros de seguridad. Cualquier fallo descarta el token.

Lo que no se puede verificar cuenta como fallo (`unknown_is_fail`), salvo los dos
puntos que en pump.fun son seguros por diseño del programa y se anotan como tales.
"""


def honeypot_from_trades(trades, creator, min_sells):
    """True = parece honeypot; False = hay ventas reales de terceros; None = sin base."""
    others = [t for t in trades if t["wallet"] != creator]
    buys = [t for t in others if t["is_buy"]]
    sells = {t["wallet"] for t in others if not t["is_buy"]}
    if len(sells) >= min_sells:
        return False
    if len(buys) >= 30 and not sells:
        return True
    return None


def count_prev_rugs(creator_coins, sec_cfg, exclude_mint=None):
    """Un token anterior del creador cuenta como rug si llegó a >= rug_ath_min_usd
    y ahora vale <= (100 - rug_drop_pct)% de su máximo. Heurística: necesita `ath_mcap`."""
    rugs, unknown = 0, 0
    for c in creator_coins or []:
        if c.get("mint") == exclude_mint:
            continue
        ath, mc = c.get("ath_mcap"), c.get("mcap_usd")
        if not ath or mc is None:
            unknown += 1
            continue
        if ath >= sec_cfg["rug_ath_min_usd"] and mc <= ath * (1 - sec_cfg["rug_drop_pct"] / 100):
            rugs += 1
    return rugs, unknown


def evaluate(info, cfg):
    """info: mint_authority, freeze_authority, mint_known(bool), top10_pct (o None),
    prev_rugs (o None), honeypot (True/False/None), creator_known(bool)."""
    s = cfg["security"]
    strict = s["unknown_is_fail"]
    checks, fails, warns = {}, [], []

    def add(name, ok, note):
        checks[name] = {"ok": ok, "note": note}
        if ok is False:
            fails.append(f"{name}: {note}")
        elif ok is None:
            (fails if strict else warns).append(f"{name}: no verificable ({note})")

    if not info.get("mint_known"):
        add("mint_authority", None, "sin datos del mint")
        add("freeze_authority", None, "sin datos del mint")
    else:
        add("mint_authority", info.get("mint_authority") is None,
            "sin renunciar" if info.get("mint_authority") else "renunciada")
        add("freeze_authority", info.get("freeze_authority") is None,
            "sin renunciar" if info.get("freeze_authority") else "renunciada")
    t10 = info.get("top10_pct")
    add("top10", None if t10 is None else t10 <= s["max_top10_pct"],
        "sin datos de holders" if t10 is None else f"{t10:.1f}% del circulante (máx {s['max_top10_pct']}%)")
    pr = info.get("prev_rugs")
    add("creador", None if pr is None else pr <= s["max_prev_rugs"],
        "sin historial del creador" if pr is None else f"{pr} rugs previos (máx {s['max_prev_rugs']})")
    hp = info.get("honeypot")
    add("honeypot", None if hp is None else (not hp),
        "sin ventas de terceros suficientes para juzgar" if hp is None else ("no se puede vender" if hp else "hay ventas de terceros"))
    # Por diseño de pump.fun la liquidez vive en la curva y la migración la hace el programa.
    # NO verificado on-chain por este panel: se anota y se contrasta tras migrar con DexScreener.
    checks["liquidez_retirable"] = {"ok": True, "note": "por diseño pump.fun (sin verificar on-chain)"}
    return {"ok": not fails, "fails": fails, "warnings": warns, "checks": checks}

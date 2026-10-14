"""Costes reales de entrada y salida: comisión, deslizamiento y retraso.

Modelo de la curva de pump.fun: producto constante sobre reservas virtuales
(SOL, tokens). Tras migrar se usa liquidez de pool: slip ≈ x / (R + x), con R la
mitad de la liquidez en USD. Las comisiones (1% por lado) son un valor de
configuración SIN VERIFICAR contra la tarifa actual de pump.fun.
"""


def curve_buy_slip(vs, vt, sol_in, fee_pct):
    if not vs or not vt or vs <= 0 or vt <= 0:
        return None
    k = vs * vt
    net = sol_in * (1 - fee_pct / 100)
    out = vt - k / (vs + net)
    if out <= 0:
        return None
    return max(0.0, (net / out) / (vs / vt) - 1)


def curve_sell_slip(vs, vt, tokens_in):
    if not vs or not vt or vs <= 0 or vt <= 0 or tokens_in <= 0:
        return None
    k = vs * vt
    sol_out = vs - k / (vt + tokens_in)
    if sol_out <= 0:
        return None
    return max(0.0, 1 - (sol_out / tokens_in) / (vs / vt))


def amm_slip(pos_usd, liq_usd):
    if not liq_usd or liq_usd <= 0:
        return None
    return pos_usd / (liq_usd / 2 + pos_usd)


def entry_slippage(coin, cfg):
    """Deslizamiento de compra (en %) para el tamaño de posición, al evaluar."""
    c = cfg["costs"]
    s = curve_buy_slip(coin.get("virtual_sol"), coin.get("virtual_tokens"), c["position_sol"], c["fee_pct"])
    return None if s is None else round(s * 100, 2)


def _slip_buy(sample, cfg):
    c = cfg["costs"]
    s = None
    if not sample.get("complete"):
        s = curve_buy_slip(sample.get("vsol"), sample.get("vtok"), c["position_sol"], c["fee_pct"])
    if s is None and sample.get("liq") and sample.get("sol_usd"):
        s = amm_slip(c["position_sol"] * sample["sol_usd"], sample["liq"])
    return s if s is not None else c["exit_slippage_pct"] / 100


def _slip_sell(sample, tokens, cfg):
    c = cfg["costs"]
    floor = 0.0
    s = None
    if not sample.get("complete") and sample.get("vsol") and sample.get("vtok"):
        s = curve_sell_slip(sample["vsol"], sample["vtok"], tokens)
    elif sample.get("liq"):
        s = amm_slip(tokens * sample["price"], sample["liq"])
    if s is None:
        return c["exit_slippage_pct"] / 100
    return max(s, floor)


def net_return(entry, exit_, cfg):
    """Rentabilidad neta de una posición hipotética entre dos muestras de precio.
    entry/exit_: dicts con price (USD), vsol, vtok, liq, complete, sol_usd.
    Devuelve (retorno_neto, rug). 0.10 = +10 %."""
    c = cfg["costs"]
    fee = c["fee_pct"] / 100
    sb = min(_slip_buy(entry, cfg), 0.9)
    sol_usd = entry.get("sol_usd") or 150.0
    pos_usd = c["position_sol"] * sol_usd
    tokens = pos_usd * (1 - fee) / (entry["price"] * (1 + sb))
    ss = min(_slip_sell(exit_, tokens, cfg), 0.95)
    gross = exit_["price"] / entry["price"]
    # gasto pos_usd (con comisión) -> tokens; al vender: precio * (1-deslizamiento) * (1-comisión)
    ret = gross * (1 - ss) * (1 - fee) ** 2 / (1 + sb) - 1
    ret -= 2 * c["priority_fee_sol"] / c["position_sol"]
    rug = gross <= 1 - c["rug_drop_pct"] / 100 or (
        exit_.get("liq") is not None and exit_.get("complete") and exit_["liq"] < c["rug_liquidity_usd"])
    return ret, bool(rug)

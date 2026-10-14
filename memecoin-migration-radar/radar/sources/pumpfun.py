"""API pública de pump.fun (sin clave).

TODAS las rutas y nombres de campo son SIN VERIFICAR: se escribieron de memoria y
desde el entorno de desarrollo no hay acceso de red. `python -m radar check` los
prueba. Si pump.fun cambió algo, el fallo será visible ahí (campo ausente), no
silencioso. Las rutas se pueden cambiar en config.json → endpoints.
"""
from ..util import http_json, sanitize_text


def _sol(v):
    return float(v or 0) / 1e9  # la API devuelve lamports (verificado con datos reales)


def _tok(v):
    return float(v or 0) / 1e6  # unidades crudas con 6 decimales (verificado con datos reales)


def _ts(v):
    v = float(v or 0)
    return v / 1000 if v > 1e11 else v


def normalize_coin(raw, total_supply=1_000_000_000, sol_usd=None):
    mcap = raw.get("usd_market_cap")
    if mcap is None and raw.get("market_cap") is not None and sol_usd:
        mcap = float(raw["market_cap"]) * sol_usd
    mcap = float(mcap or 0)
    ath = raw.get("ath_market_cap")
    return {
        "mint": raw.get("mint"),
        "name": sanitize_text(raw.get("name")),
        "symbol": sanitize_text(raw.get("symbol"), 16),
        "creator": raw.get("creator"),
        "bonding_curve": raw.get("bonding_curve"),
        "assoc_curve": raw.get("associated_bonding_curve"),
        "pool": raw.get("pump_swap_pool") or raw.get("raydium_pool"),  # pool_address viene relleno en todos los tokens: NO indica migración
        "mcap_usd": mcap,
        "price_usd": mcap / total_supply if mcap else None,
        "real_sol": _sol(raw["real_sol_reserves"]) if raw.get("real_sol_reserves") is not None else None,
        "real_tokens": _tok(raw["real_token_reserves"]) if raw.get("real_token_reserves") is not None else None,
        "virtual_sol": _sol(raw.get("virtual_sol_reserves")) or None,
        "virtual_tokens": _tok(raw.get("virtual_token_reserves")) or None,
        "complete": bool(raw.get("complete")),
        "created_ts": _ts(raw.get("created_timestamp")),
        "ath_mcap": float(ath) if ath else None,
        "sol_usd": sol_usd,
    }


def normalize_trade(raw):
    sol = _sol(raw.get("sol_amount"))
    return {
        "sig": raw.get("signature"), "ts": _ts(raw.get("timestamp")), "wallet": raw.get("user"),
        "is_buy": bool(raw.get("is_buy")), "sol": sol, "tokens": _tok(raw.get("token_amount")),
        "slot": raw.get("slot"),
    }


class PumpFun:
    def __init__(self, cfg, limiter=None):
        self.cfg = cfg
        self.base = cfg["endpoints"]["pumpfun_api"].rstrip("/")
        self.limiter = limiter
        self.supply = cfg["total_supply"]

    def _get(self, path):
        return http_json(self.base + path, limiter=self.limiter)

    def list_live(self, sol_usd=None):
        raw = self._get(self.cfg["endpoints"]["pumpfun_list_path"])
        raw = raw if isinstance(raw, list) else raw.get("coins", [])
        return [normalize_coin(r, self.supply, sol_usd) for r in raw if r.get("mint")]

    def coin(self, mint, sol_usd=None):
        return normalize_coin(self._get(f"/coins/{mint}"), self.supply, sol_usd)

    def trades(self, mint, max_pages=4, page=200):
        out = []
        for i in range(max_pages):
            chunk = self._get(f"/trades/all/{mint}?limit={page}&offset={i * page}")
            if not isinstance(chunk, list):
                break
            out.extend(normalize_trade(t) for t in chunk if t.get("user"))
            if len(chunk) < page:
                break
        return out

    def creator_coins(self, creator, sol_usd=None):
        # Ruta VERIFICADA el 14 oct 2026. La anterior (/coins/user-created-coins/...) da 404.
        raw = self._get(f"/coins?creator={creator}&offset=0&limit=50&sort=created_timestamp&order=DESC&includeNsfw=true")
        raw = raw if isinstance(raw, list) else raw.get("coins", [])
        return [normalize_coin(r, self.supply, sol_usd) for r in raw if r.get("mint")]

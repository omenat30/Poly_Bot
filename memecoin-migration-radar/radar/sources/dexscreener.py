"""DexScreener (sin clave): precio y liquidez tras migrar, y precio del SOL."""
from ..util import http_json

SOL_MINT = "So11111111111111111111111111111111111111112"


class DexScreener:
    def __init__(self, cfg, limiter=None):
        self.base = cfg["endpoints"]["dexscreener_api"].rstrip("/")
        self.limiter = limiter

    def best_pair(self, mint):
        r = http_json(f"{self.base}/latest/dex/tokens/{mint}", limiter=self.limiter)
        pairs = [p for p in (r.get("pairs") or []) if p.get("chainId") == "solana"]
        if not pairs:
            return None
        p = max(pairs, key=lambda p: ((p.get("liquidity") or {}).get("usd") or 0))
        return {
            "price": float(p["priceUsd"]) if p.get("priceUsd") else None,
            "liq": (p.get("liquidity") or {}).get("usd"),
            "mcap": p.get("marketCap") or p.get("fdv"),
            "pair": p.get("pairAddress"),
        }

    def sol_usd(self):
        p = self.best_pair(SOL_MINT)
        return p["price"] if p else None

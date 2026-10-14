"""Trades de la curva de pump.fun reconstruidos desde transacciones enriquecidas de Helius.

FORMA REAL VERIFICADA (14 oct 2026, con transacciones de un token activo):
  - type=SWAP, source=PUMP_FUN; `events` viene VACÍO.
  - `tokenTransfers`: el token pasa entre el usuario y la cuenta de la curva (`bonding_curve`).
        usuario -> curva  = VENTA        curva -> usuario = COMPRA
  - `nativeTransfers` NO trae los SOL de la operación (la curva se mueve dentro del programa).
    Los SOL salen del cambio de saldo de la cuenta de la curva en `accountData`:
        Δ curva > 0 = compra · Δ curva < 0 = venta   (magnitud ≈ SOL netos de la operación)
  - Muchas firmas de la curva son transacciones FALLIDAS (bots): ~47 % en un token activo.
    Se descartan por `err` al listar firmas y por `transactionError` al parsear.

Límites conocidos: el importe es el movimiento neto de la curva (≈ SOL del usuario menos comisión del
protocolo, hasta ~13 % por debajo del precio spot en operaciones grandes); si una transacción trae varias
operaciones sobre la misma curva solo se cuenta la primera.
"""
from collections import defaultdict


def trades_from_enhanced(txs, mint, curve):
    """Devuelve (trades, omitidas). trade: {sig, ts, wallet, is_buy, sol, tokens, slot}."""
    out, skipped = [], 0
    for t in txs or []:
        if t.get("transactionError"):
            continue
        tt = [x for x in (t.get("tokenTransfers") or [])
              if x.get("mint") == mint and curve in (x.get("fromUserAccount"), x.get("toUserAccount"))]
        if not tt:
            skipped += 1
            continue
        x = tt[0]
        is_buy = x.get("fromUserAccount") == curve
        wallet = x.get("toUserAccount") if is_buy else x.get("fromUserAccount")
        delta = sum(a.get("nativeBalanceChange", 0) for a in (t.get("accountData") or []) if a.get("account") == curve)
        sol = abs(delta) / 1e9
        if not wallet or sol <= 0:
            skipped += 1
            continue
        if (delta > 0) != is_buy:  # el saldo de la curva debe moverse en el sentido de la operación
            skipped += 1
            continue
        out.append({"sig": t.get("signature"), "ts": t.get("timestamp") or 0, "wallet": wallet, "is_buy": is_buy,
                    "sol": sol, "tokens": float(x.get("tokenAmount") or 0), "slot": t.get("slot")})
    return out, skipped


class CurveTrades:
    """Trae trades de la curva de forma INCREMENTAL: solo firmas nuevas desde la última vista,
    con un tope de transacciones parseadas por token para cuidar los créditos de Helius."""

    def __init__(self, helius, store, cfg):
        self.h, self.store = helius, store
        c = cfg["helius_trades"]
        self.window = 2 * cfg["volume"]["window_s"] + 60
        self.budget, self.sig_limit = c["parse_budget"], c["sig_limit"]
        self.errors = 0

    def refresh(self, mint, curve, now):
        """Actualiza la base con trades nuevos y devuelve todos los guardados del token."""
        last = self.store.last_trade_sig(mint)
        sigs = self.h.curve_signatures(curve, until=last, limit=self.sig_limit)
        fresh = [s for s in sigs if not s.get("err") and (s.get("blockTime") or 0) >= now - self.window]
        fresh = fresh[: self.budget]  # las más recientes primero; el tope protege el presupuesto
        got, skipped = [], 0
        for i in range(0, len(fresh), 100):
            txs = self.h.parse_transactions([s["signature"] for s in fresh[i:i + 100]])
            tr, sk = trades_from_enhanced(txs, mint, curve)
            got.extend(tr)
            skipped += sk
        if got:
            self.store.add_trades(mint, got)
        if sigs:
            self.store.set_last_trade_sig(mint, sigs[0]["signature"])
        meta = {"listed": len(sigs), "parsed": len(fresh), "trades": len(got), "skipped": skipped,
                "capped": len(fresh) >= self.budget}
        # Todo lo guardado del token, no solo la ventana: así los «primeros compradores» no se desplazan
        # en cada ciclo. Los criterios de volumen ya filtran por ventana temporal dentro de score_volume.
        return self.store.trades_since(mint, 0), meta

"""Datos SINTÉTICOS para probar el panel y las pruebas. Nada de esto es real.

Los tokens, las wallets y los precios se generan al azar, sin ninguna relación
entre puntuación y rendimiento. Por eso el análisis de medición debe concluir
«descartar» o «sin datos»: es la prueba de que el análisis no se inventa ventajas.
"""
import json
import math
import random
import string

from . import evaluate, wallet_history
from .variants import load_variants

SOL_USD = 150.0


def _addr(rng):
    return "".join(rng.choice(string.ascii_letters + string.digits) for _ in range(44))


def synth_inputs(rng, kind, cfg, now, progress=0.88):
    """kind: good | cluster | wash | unsafe. Devuelve los argumentos de evaluate_token."""
    mint, creator = _addr(rng), _addr(rng)
    real = cfg["curve_target_sol"] * progress
    vs = 30 + real
    vt = 1.073e9 * 30 / vs
    mcap = vs / vt * 1e9 * SOL_USD
    coin = {"mint": mint, "name": "Demo " + kind, "symbol": kind[:4].upper() + str(rng.randint(10, 99)),
            "creator": creator, "bonding_curve": _addr(rng), "pool": None, "mcap_usd": mcap,
            "price_usd": mcap / 1e9, "real_sol": real, "real_tokens": None, "virtual_sol": vs,
            "virtual_tokens": vt, "complete": False, "sol_usd": SOL_USD}
    wallets = [_addr(rng) for _ in range(30)]
    holders = [{"owner": w, "amount": a} for w, a in zip(wallets[:14], sorted((rng.uniform(1, 9) * 1e6 for _ in range(14)), reverse=True))]
    trades = []
    for i in range(260):
        age = rng.uniform(0, 780)
        buy = rng.random() < (0.62 if kind != "unsafe" else 0.7)
        trades.append({"sig": f"s{i}", "ts": now - age, "wallet": rng.choice(wallets), "is_buy": buy,
                       "sol": rng.uniform(0.2, 2.0), "tokens": 1.0, "slot": 300_000_000 + int((now - age) // 0.4)})
    funders = {}
    if kind == "cluster":
        shared = _addr(rng)
        for w in wallets[:9]:
            funders[w] = (shared, now - 86400 + rng.randint(0, 600))
    if kind == "wash":
        w0 = wallets[0]
        for j in range(12):
            t = now - 60 * j - 400
            trades.append({"sig": f"w{j}", "ts": t, "wallet": w0, "is_buy": True, "sol": 3.0, "tokens": 1, "slot": 1000 + j})
            trades.append({"sig": f"x{j}", "ts": t + 20, "wallet": w0, "is_buy": False, "sol": 3.0, "tokens": 1, "slot": 2000 + j})
    wd = {}
    for k, w in enumerate(wallets[:24]):
        good = (k % 3 != 0) if kind in ("good", "unsafe") else (k % 5 == 0)
        pos = {}
        for p in range(5):
            m = _addr(rng)
            buy_t = now - 86400 * (p + 1)
            hold = rng.randint(900, 5000) if good else rng.randint(10, 80)
            win = 1.5 if good else 0.7
            pos[m] = {"buy_sol": 1.0, "buy_tok": 100.0, "sell_sol": win, "sell_tok": 100.0,
                      "first_buy": buy_t, "first_sell": buy_t + hold, "last_sell": buy_t + hold}
        f = funders.get(w)
        parsed = {"wallet": w, "positions": pos, "funder": f[0] if f else _addr(rng), "funded_ts": f[1] if f else now - rng.randint(86400, 86400 * 90),
                  "counterparties": [], "n_trades": 10, "n_txs": 30, "span_s": 86400 * 5}
        wd[w] = {"parsed": parsed, "summary": wallet_history.summarize(parsed, cfg)}
    minfo = {"mint_authority": _addr(rng) if kind == "unsafe" else None, "freeze_authority": None,
             "supply": 1e9, "decimals": 6}
    ccoins = [{"mint": _addr(rng), "mcap_usd": 900.0, "ath_mcap": 40000.0}] * (3 if kind == "unsafe" else 0)
    return coin, trades, holders, minfo, ccoins, wd


def evaluate_synth(rng, kind, cfg, now, progress=0.88):
    coin, trades, holders, minfo, ccoins, wd = synth_inputs(rng, kind, cfg, now, progress)
    excluded = 1e9 - 793.1e6 * progress  # lo que aún queda en la curva
    extras = {"data_source": "demo (sintético)", "smart_wallets": rng.randint(0, 6), "rug_ratio": round(rng.random() * 0.4, 2),
              "bundler_rate": round(rng.random() * 0.3, 2), "creator_status": "creator_close"}
    return coin, evaluate.evaluate_token(coin, trades, holders, minfo, ccoins, wd, cfg, now, excluded, extras)


def _path(rng, p0, n_fast, n_slow):
    """Serie de precios al azar con deriva negativa y rug ocasional. Sin ventaja alguna."""
    rug_at = rng.randint(5, n_fast + n_slow) if rng.random() < 0.18 else None
    price, out = p0, []
    for i in range(n_fast + n_slow):
        step = rng.gauss(-0.0006 if i < n_fast else -0.004, 0.012 if i < n_fast else 0.05)
        price *= math.exp(step)
        if rug_at is not None and i == rug_at:
            price *= 0.04
        out.append(price)
    return out


def populate(store, cfg, rng, now, n_cand=45, n_ctrl=90):
    """Rellena la base con tokens y series sintéticos (14 días) + candidatos actuales."""
    sc = cfg["series"]
    n_fast = sc["fast_until_s"] // sc["fast_every_s"]
    n_slow = (sc["tail_s"] - sc["fast_until_s"]) // sc["slow_every_s"]

    def add_series(mint, t0, p0, vs0):
        path = _path(rng, p0, n_fast, n_slow)
        for i, p in enumerate(path):
            t = t0 + (i + 1) * sc["fast_every_s"] if i < n_fast else t0 + sc["fast_until_s"] + (i - n_fast + 1) * sc["slow_every_s"]
            store.db.execute("INSERT OR REPLACE INTO series VALUES(?,?,?,?,?,?,?,?,?)",
                             (mint, int(t), p, p * 1e9, vs0, vs0 * SOL_USD / p, None, 0, SOL_USD))

    for i in range(n_cand + n_ctrl):
        is_c = i < n_cand
        t0 = now - rng.randint(2 * 86400, 14 * 86400)
        mint = _addr(rng)
        mcap = rng.uniform(31000, 66000)
        p0 = mcap / 1e9
        add_series(mint, t0, p0, 100.0)
        until = t0 + sc["tail_s"]
        store.db.execute("INSERT OR IGNORE INTO tracked VALUES(?,?,?,?,?,?,?,?)",
                         (mint, "candidate" if is_c else "control", t0, until, until + 1, mcap, "Demo", "DEMO"))
        if is_c:
            f = {"progress": rng.uniform(60, 98), "mcap": mcap, "score": rng.uniform(55, 90),
                 "unique_buyers": rng.randint(8, 40), "eff_independent": rng.uniform(2, 11),
                 "largest_cluster_pct": rng.uniform(3, 30), "quality_share": rng.uniform(0, 0.8),
                 "coverage": 0.8, "wash_share": 0.05, "top10_pct": 28.0, "creator_pct": 2.0,
                 "prev_rugs": 0, "sec_ok": True, "discarded": False, "slip_buy_pct": 3.0,
                 "vsol": 100.0, "vtok": 100 * SOL_USD / p0, "sol_usd": SOL_USD,
                 "gx_smart_wallets": rng.randint(0, 6), "gx_rug_ratio": rng.random() * 0.4,
                 "gx_bundler_rate": rng.random() * 0.3, "gx_insider_hold_rate": rng.random() * 0.2}
            store.db.execute(
                "INSERT INTO observations(mint,ts,price,mcap,progress,score,discarded,features) VALUES(?,?,?,?,?,?,?,?)",
                (mint, t0, p0, mcap, f["progress"], f["score"], 0, json.dumps(f)))
    # alertas recientes (una por cada candidato reciente con score alto) para el registro
    store.db.commit()
    from .alerts import explain
    shown = 0
    for kind in ["good", "good", "cluster", "wash", "unsafe", "good", "cluster", "good"]:
        coin, res = evaluate_synth(rng, kind, cfg, now - 20, rng.uniform(0.84, 0.96))
        store.add_observation(res)
        store.set_latest(res, coin["name"], coin["symbol"])
        if not res["discarded"] and res["score"] >= 60 and shown < 3:  # demo: umbral relajado para ver avisos
            t0 = now - rng.randint(3600 * 3, 86400 * 2)
            res = dict(res, ts=t0)
            store.add_alert(res, coin["name"], coin["symbol"], explain(res, coin["name"], coin["symbol"]))
            store.mark_emailed(coin["mint"], True, "enviado (demo)")
            add_series(coin["mint"], t0, res["price"], 100.0)
            store.db.commit()
            shown += 1
    store.set_meta("last_cycle", {"ts": now, "listed": 50})
    store.set_meta("sol_usd", {"ts": now, "v": SOL_USD})
    store.db.commit()

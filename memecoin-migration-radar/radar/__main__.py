"""Línea de comandos:  python -m radar <run|serve|demo|check|calibrate|analyze|export>"""
import argparse
import json
import os
import random
import statistics
import sys
import threading
import time

from . import analysis
from .config import load_config
from .store import Store


def _store(cfg, path=None):
    return Store(path or cfg["db_path"])


def cmd_run(cfg, a):
    from .engine import Engine
    from .server import serve
    st = _store(cfg)
    if not cfg["keys"]["helius"]:
        print("Falta HELIUS_API_KEY (ver README, paso 2). El panel arrancará, pero sin ella no hay análisis.")
    eng = Engine(cfg, st)
    threading.Thread(target=serve, args=(st, cfg, "live"), daemon=True).start()
    eng.run_forever()


def cmd_serve(cfg, a):
    from .server import serve
    serve(_store(cfg), cfg, "live")


def cmd_demo(cfg, a):
    from .demo import populate
    from .server import serve
    path = "data/demo.sqlite"
    if os.path.exists(path):
        os.remove(path)
    st = _store(cfg, path)
    now = int(time.time())
    populate(st, cfg, random.Random(12), now)
    rep = analysis.build_report(st, cfg, now)
    st.set_meta("report", rep)
    print("DATOS SINTÉTICOS. Veredicto del análisis sobre datos al azar:", rep["verdict"])
    serve(st, cfg, "demo")


def cmd_analyze(cfg, a):
    st = _store(cfg)
    rep = analysis.build_report(st, cfg, int(time.time()))
    st.set_meta("report", rep)
    print(json.dumps(rep, indent=2, ensure_ascii=False, default=str))


def cmd_export(cfg, a):
    from .state import build_state
    st = _store(cfg, a.db)
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump(build_state(st, cfg, mode="demo" if a.db and "demo" in a.db else "live"), f, ensure_ascii=False)
    print("escrito", a.out)


def _row(name, ok, note):
    print(f"[{'OK ' if ok else 'FALLA'}] {name}: {note}")
    return ok


def cmd_check(cfg, a):
    """Prueba cada fuente y la FORMA de sus datos. No envía correos."""
    from .sources.dexscreener import DexScreener
    from .sources.helius import Helius
    from .sources.pumpfun import PumpFun
    from .util import RateLimiter, redact
    pump, dex = PumpFun(cfg, RateLimiter(5)), DexScreener(cfg, RateLimiter(3))
    hel = Helius(cfg, RateLimiter(3))
    coins = []
    t = time.time()
    try:
        sol = dex.sol_usd()
        _row("DexScreener (precio SOL)", bool(sol), f"{sol} USD")
    except Exception as e:
        sol = None
        _row("DexScreener", False, redact(e))
    try:
        coins = pump.list_live(sol)
        need = ("mint", "mcap_usd", "real_sol", "virtual_sol", "virtual_tokens", "creator", "bonding_curve")
        miss = [k for k in need if coins[0].get(k) is None] if coins else list(need)
        _row("pump.fun lista", bool(coins) and not miss, f"{len(coins)} tokens en {time.time()-t:.1f}s; campos que faltan: {miss or 'ninguno'}")
    except Exception as e:
        _row("pump.fun lista", False, redact(e))
    if coins:
        c = coins[0]
        try:
            tr = pump.trades(c["mint"], max_pages=1)
            miss = [k for k in ("wallet", "ts", "sol", "slot") if tr and not tr[0].get(k)]
            _row("pump.fun trades", bool(tr) and not miss, f"{len(tr)} trades; campos que faltan: {miss or 'ninguno'}")
        except Exception as e:
            _row("pump.fun trades", False, redact(e))
        try:
            cc = pump.creator_coins(c["creator"], sol)
            _row("pump.fun monedas del creador", True, f"{len(cc)} monedas; con ath_mcap: {sum(1 for x in cc if x['ath_mcap'])}")
        except Exception as e:
            _row("pump.fun monedas del creador", False, redact(e))
    from .sources.gmgn import Gmgn, GmgnError, GmgnRateLimited
    gm = Gmgn(cfg)
    if not gm.available:
        print("[ -- ] GMGN sin clave (GMGN_API_KEY en .env): se usará Helius")
    elif coins:
        c = coins[0]
        try:
            sec = gm.security(c["mint"])
            miss = [k for k in ("renounced_mint", "renounced_freeze", "top10_rate", "rug_ratio") if sec.get(k) is None]
            _row("GMGN seguridad", not miss, f"campos que faltan: {miss or 'ninguno'}")
            inf = gm.info(c["mint"])
            miss = [k for k in ("progress", "total_supply", "smart_wallets", "creator") if inf.get(k) is None]
            _row("GMGN info", not miss, f"progreso {inf.get('progress')}; campos que faltan: {miss or 'ninguno'}")
            hl = gm.holders(c["mint"])
            ex = [h for h in hl if h["excluded"]]
            with_f = [h for h in hl if h["funder"]]
            _row("GMGN holders", bool(hl), f"{len(hl)} holders ({len(ex)} curva/pool), {len(with_f)} con fondeador conocido")
            if hl:
                rows = gm.activity(next(h["owner"] for h in hl if not h["excluded"]))
                from . import wallet_history as wh
                p = wh.parse_gmgn_activity("x", rows)
                _row("GMGN actividad de wallet", p["n_trades"] > 0, f"{len(rows)} filas, {p['n_trades']} operaciones reconocidas (0 → formato distinto)")
            cr = c.get("creator")
            if cr:
                cc = gm.created_tokens(cr)
                _row("GMGN monedas del creador", True, f"{len(cc)} monedas; con ath: {sum(1 for x in cc if x['ath_mcap'])}")
        except GmgnRateLimited as e:
            _row("GMGN", False, f"límite de uso: {e}")
        except GmgnError as e:
            _row("GMGN", False, str(e))
    if not hel.available:
        print("[ -- ] Helius sin clave: opcional si GMGN funciona (se usa solo para contrastar mint/freeze)")
    elif coins:
        c = coins[0]
        try:
            mi = hel.mint_info(c["mint"])
            _row("Helius mint", mi is not None, str(mi))
            hs, _exc = hel.holders(c["mint"], {c.get("bonding_curve"), c.get("pool")} - {None})
            _row("Helius holders", bool(hs), f"{len(hs)} holders")
            if hs:
                from . import wallet_history as wh
                txs = hel.wallet_txs(hs[0]["owner"])
                p = wh.parse_wallet_txs(hs[0]["owner"], txs)
                _row("Helius historial de wallet", p["n_trades"] > 0,
                     f"{p['n_txs']} txs, {p['n_trades']} swaps reconocidos (0 → el formato no coincide; revisa wallet_history.py)")
        except Exception as e:
            _row("Helius", False, redact(e))
    if cfg["email"]["enabled"]:
        import smtplib
        import ssl
        try:
            with smtplib.SMTP_SSL(cfg["email"]["smtp_host"], cfg["email"]["smtp_port"], context=ssl.create_default_context(), timeout=15) as s:
                s.login(cfg["keys"]["smtp_user"], cfg["keys"]["smtp_password"])
            _row("Correo (solo inicio de sesión, no se envía nada)", True, "credenciales válidas")
        except Exception as e:
            _row("Correo", False, redact(e))
    else:
        print("[ -- ] Correo desactivado (email.enabled=false en config.json)")


def cmd_calibrate(cfg, a):
    """Mide cuántos SOL tenía la curva al completarse en tokens ya migrados."""
    from .sources.pumpfun import PumpFun
    from .util import RateLimiter
    cfg["endpoints"]["pumpfun_list_path"] = cfg["endpoints"]["pumpfun_list_path"].replace("complete=false", "complete=true")
    coins = PumpFun(cfg, RateLimiter(5)).list_live()
    vals = [c["real_sol"] for c in coins if c.get("real_sol")]
    if not vals:
        print("No se pudo medir (¿ruta de la API distinta? ver `check`).")
        return
    print(f"{len(vals)} tokens migrados. SOL reales en la curva al migrar: mín {min(vals):.1f} · mediana {statistics.median(vals):.1f} · máx {max(vals):.1f}")
    print(f'Pon en config.json:  "curve_target_sol": {round(statistics.median(vals), 1)}')


def main():
    ap = argparse.ArgumentParser(prog="radar")
    ap.add_argument("--config", default="config.json")
    sub = ap.add_subparsers(dest="cmd", required=True)
    for n in ("run", "serve", "demo", "check", "calibrate", "analyze"):
        sub.add_parser(n)
    ex = sub.add_parser("export")
    ex.add_argument("out")
    ex.add_argument("--db", default=None)
    a = ap.parse_args()
    cfg = load_config(a.config)
    {"run": cmd_run, "serve": cmd_serve, "demo": cmd_demo, "check": cmd_check, "calibrate": cmd_calibrate,
     "analyze": cmd_analyze, "export": cmd_export}[a.cmd](cfg, a)


if __name__ == "__main__":
    sys.exit(main())

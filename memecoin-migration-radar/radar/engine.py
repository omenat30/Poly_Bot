"""Bucle de detección: lista tokens, puntúa, avisa y mide. No opera nunca."""
import random
import time

from . import alerts as alerts_mod
from . import evaluate, wallet_history
from .sources.dexscreener import DexScreener
from .sources.gmgn import Gmgn, GmgnError, GmgnRateLimited
from .sources.helius import Helius
from .sources.pumpfun import PumpFun
from .util import RateLimiter, redact
from .variants import load_variants, passes


class Engine:
    def __init__(self, cfg, store, pump=None, helius=None, dex=None, log=print, rng=None, gmgn=None):
        self.cfg, self.store, self.log = cfg, store, log
        self.pump = pump or PumpFun(cfg, RateLimiter(8))
        self.helius = helius or Helius(cfg, RateLimiter(cfg["helius_rps"]))
        self.dex = dex or DexScreener(cfg, RateLimiter(4))
        self.gmgn = gmgn or Gmgn(cfg)
        self.rng = rng or random.Random()
        variants = {v["id"]: v for v in load_variants()}
        self.alert_variant = variants[cfg["alert_variant"]]
        self.errors = []

    # ---------- utilidades
    def err(self, msg):
        msg = redact(msg)
        self.errors = (self.errors + [{"ts": int(time.time()), "msg": msg}])[-20:]
        self.store.set_meta("errors", self.errors)
        self.log("! " + msg)

    def sol_usd(self, now):
        c = self.store.get_meta("sol_usd")
        if c and now - c["ts"] < 300:
            return c["v"]
        try:
            v = self.dex.sol_usd()
            if v:
                self.store.set_meta("sol_usd", {"ts": now, "v": v})
                return v
        except Exception as e:
            self.err(f"precio SOL: {e}")
        return c["v"] if c else None

    def price_sample(self, mint, now):
        sol = self.sol_usd(now)
        c = None
        try:
            c = self.pump.coin(mint, sol)
        except Exception:
            pass
        if c and not c["complete"] and c["price_usd"]:
            return {"ts": now, "price": c["price_usd"], "mcap": c["mcap_usd"], "vsol": c["virtual_sol"],
                    "vtok": c["virtual_tokens"], "liq": None, "complete": False, "sol_usd": sol}
        try:
            d = self.dex.best_pair(mint)
        except Exception:
            d = None
        if d and d["price"]:
            return {"ts": now, "price": d["price"], "mcap": d["mcap"], "vsol": None, "vtok": None,
                    "liq": d["liq"], "complete": True, "sol_usd": sol}
        return None

    # ---------- análisis profundo de un token
    def deep(self, coin, now):
        """Descarga todo lo necesario y puntúa. GMGN si hay clave (1 llamada de holders trae
        también el fondeador de cada wallet); si no, Helius. Los trades siempre vienen de pump.fun."""
        trades = self.pump.trades(coin["mint"])
        if self.gmgn.available:
            return self.deep_gmgn(coin, trades, now)
        if self.helius.available:
            return self.deep_helius(coin, trades, now)
        return None

    def deep_gmgn(self, coin, trades, now):
        cfg, mint = self.cfg, coin["mint"]
        sec = self.gmgn.security(mint)
        info = self.gmgn.info(mint)
        hl = self.gmgn.holders(mint)
        supply = info.get("total_supply") or cfg["total_supply"]
        holders = sorted(({"owner": h["owner"], "amount": h["pct"] * supply} for h in hl
                          if not h["excluded"] and h["pct"] > 0), key=lambda h: -h["amount"])
        excluded = sum(h["pct"] for h in hl if h["excluded"]) * supply
        if sec["renounced_mint"] is None or sec["renounced_freeze"] is None:
            minfo = None  # sin dato no se asume renunciado: la seguridad lo trata como no verificable
        else:
            minfo = {"mint_authority": None if sec["renounced_mint"] else "no renunciada (GMGN)",
                     "freeze_authority": None if sec["renounced_freeze"] else "no renunciada (GMGN)",
                     "supply": supply}
        if self.helius.available:  # contraste on-chain: si Helius ve una autoridad, manda Helius
            try:
                hm = self.helius.mint_info(mint)
                if hm and (hm["mint_authority"] or hm["freeze_authority"]):
                    minfo = hm
            except Exception as e:
                self.err(f"Helius mint {coin.get('symbol')}: {e}")
        creator = coin.get("creator") or info.get("creator")
        try:
            ccoins = self.gmgn.created_tokens(creator) if creator else None
        except GmgnRateLimited:
            raise
        except GmgnError as e:
            self.err(f"GMGN monedas del creador {coin.get('symbol')}: {e}")
            ccoins = None
        wallets = evaluate.select_wallets(trades, holders, cfg)
        hmap = {h["owner"]: h for h in hl}
        sol = coin.get("sol_usd") or 150.0
        budget, wd = cfg["gmgn"]["history_wallets"], {}
        for w in wallets:
            cached = self.store.get_wallet("g:" + w, cfg["wallets"]["wallet_cache_s"], now)
            if cached is None:
                h = hmap.get(w)
                funder = h["funder"] if h and not h["funder_label"] else None  # un fondeador con nombre es un exchange o protocolo
                fts = h["funder_ts"] if h else None
                if budget > 0:
                    try:
                        parsed = wallet_history.parse_gmgn_activity(w, self.gmgn.activity(w), funder, fts, sol)
                        budget -= 1
                        cached = {"parsed": parsed, "summary": wallet_history.summarize(parsed, cfg)}
                        self.store.put_wallet("g:" + w, cached, now)
                    except GmgnRateLimited:
                        raise
                    except GmgnError as e:
                        self.err(f"GMGN wallet {w[:6]}…: {e}")
                if cached is None:  # sin historial este ciclo: solo el fondeador, sin guardar en caché
                    parsed = wallet_history.parse_gmgn_activity(w, [], funder, fts, sol)
                    cached = {"parsed": parsed, "summary": wallet_history.summarize(parsed, cfg)}
            wd[w] = cached
        tags = lambda t: sum(1 for h in hl if t in h["tags"] or t in h["maker_tags"])
        extras = {"data_source": "gmgn", "smart_wallets": info["smart_wallets"], "renowned_wallets": info["renowned_wallets"],
                  "sniper_wallets": info["sniper_wallets"], "bundler_wallets": info["bundler_wallets"],
                  "rat_trader_wallets": info["rat_trader_wallets"], "bot_degen_rate": info["bot_degen_rate"],
                  "fresh_wallet_rate": info["fresh_wallet_rate"], "rug_ratio": sec["rug_ratio"],
                  "bundler_rate": sec["bundler_rate"], "rat_rate": sec["rat_rate"],
                  "insider_hold_rate": sec["insider_hold_rate"], "top10_rate_gmgn": sec["top10_rate"],
                  "smart_in_holders": tags("smart_degen"), "bundler_in_holders": tags("bundler"),
                  "creator_status": sec["creator_status"], "burn_status": sec["burn_status"]}
        return evaluate.evaluate_token(coin, trades, holders, minfo, ccoins, wd, cfg, now, excluded, extras)

    def deep_helius(self, coin, trades, now):
        mint = coin["mint"]
        exclude = {x for x in (coin.get("bonding_curve"), coin.get("pool")) if x}
        holders, excluded = self.helius.holders(mint, exclude)
        minfo = self.helius.mint_info(mint)
        try:
            ccoins = self.pump.creator_coins(coin["creator"], coin.get("sol_usd")) if coin.get("creator") else None
        except Exception as e:
            self.err(f"monedas del creador {coin.get('symbol')}: {e}")
            ccoins = None
        wallets = evaluate.select_wallets(trades, holders, self.cfg)
        wd = {}
        for w in wallets:
            cached = self.store.get_wallet(w, self.cfg["wallets"]["wallet_cache_s"], now)
            if cached is None:
                try:
                    txs = self.helius.wallet_txs(w)
                    parsed = wallet_history.parse_wallet_txs(w, txs, 100, self.cfg["wallets"]["min_fund_sol"])
                    cached = {"parsed": parsed, "summary": wallet_history.summarize(parsed, self.cfg)}
                    self.store.put_wallet(w, cached, now)
                except Exception as e:
                    self.err(f"wallet {w[:6]}…: {e}")
                    continue
            wd[w] = cached
        return evaluate.evaluate_token(coin, trades, holders, minfo, ccoins, wd, self.cfg, now, excluded,
                                       {"data_source": "helius"})

    # ---------- un ciclo
    def cycle(self, now=None):
        now = int(now or time.time())
        cfg, st = self.cfg, self.store
        if not (self.gmgn.available or self.helius.available):
            self.err("sin fuente de holders: falta GMGN_API_KEY o HELIUS_API_KEY (o GMGN está en pausa por límite de uso)")
            return
        sol = self.sol_usd(now)
        try:
            coins = self.pump.list_live(sol)
        except Exception as e:
            self.err(f"lista pump.fun: {e}")
            return
        st.set_meta("last_cycle", {"ts": now, "listed": len(coins)})
        g = cfg["gates"]
        eligible = []
        for c in coins:
            p = evaluate.curve_progress(c, cfg)
            if c["mcap_usd"] >= g["min_mcap_usd"] and g["min_curve_pct"] <= p < g["max_curve_pct"]:
                eligible.append(c)
        due = [c for c in eligible if now - st.last_eval_ts(c["mint"]) >= cfg["deep_cache_seconds"]]
        due.sort(key=lambda c: st.last_eval_ts(c["mint"]))
        for c in due[: cfg["max_deep_per_cycle"]]:
            try:
                res = self.deep(c, now)
            except GmgnRateLimited as e:
                self.err(f"GMGN límite de uso, pausa hasta {e.reset_at and time.strftime('%H:%M:%S', time.localtime(e.reset_at))}: {e}")
                self.store.set_meta("gmgn_blocked_until", e.reset_at)
                break
            except Exception as e:
                self.err(f"análisis {c.get('symbol')}: {e}")
                continue
            if res is None:
                continue
            st.add_observation(res)
            st.set_latest(res, c["name"], c["symbol"])
            self.after_eval(c, res, now)
        self.maybe_control(eligible, now)
        self.sample_due(now)

    def after_eval(self, coin, res, now):
        cfg, st = self.cfg, self.store
        mint = coin["mint"]
        tail = cfg["series"]["tail_s"]
        if res["score"] >= cfg["track_score"] and not res["discarded"]:
            if st.get_tracked(mint) is None:
                st.track(mint, "candidate", now, now + tail, res["mcap"], coin["name"], coin["symbol"])
            else:
                st.extend_tracking(mint, now + tail)
            s = self.price_sample(mint, now)
            if s:
                st.add_sample(mint, s)
        if passes(self.alert_variant, res["features"]) and not st.has_alert(mint):
            reason = alerts_mod.explain(res, coin["name"], coin["symbol"])
            if st.add_alert(res, coin["name"], coin["symbol"], reason):
                ok, note = alerts_mod.send_email(res, coin["name"], coin["symbol"], cfg)
                st.mark_emailed(mint, ok, note)
                self.log(f"ALERTA {coin['symbol']} score {res['score']} · correo: {note}")

    def maybe_control(self, eligible, now):
        """Un control cada 3600/control_per_hour s: token elegible al azar que no es candidato
        (pasa las mismas puertas de capitalización y curva, sin importar su puntuación)."""
        cfg, st = self.cfg, self.store
        last = st.get_meta("last_control", 0)
        if now - last < 3600 / max(cfg["control_per_hour"], 1):
            return
        pool = [c for c in eligible if st.get_tracked(c["mint"]) is None]
        if not pool:
            return
        c = self.rng.choice(pool)
        s = self.price_sample(c["mint"], now)
        if not s:
            return
        st.track(c["mint"], "control", now, now + cfg["series"]["tail_s"], c["mcap_usd"], c["name"], c["symbol"])
        st.add_sample(c["mint"], s)
        st.set_meta("last_control", now)

    def sample_due(self, now):
        sc = self.cfg["series"]
        fails = 0
        for t in self.store.due_tracked(now):
            s = self.price_sample(t["mint"], now)
            if s:
                self.store.add_sample(t["mint"], s)
                every = sc["fast_every_s"] if now - t["start_ts"] < sc["fast_until_s"] else sc["slow_every_s"]
            else:
                fails += 1
                every = sc["fast_every_s"] * 2
            self.store.set_next(t["mint"], now + every)
        if fails:
            self.store.set_meta("sample_fails", {"ts": now, "n": fails})

    def run_forever(self):
        self.log("Radar en marcha. Solo avisa; no opera. Ctrl+C para parar.")
        last_report = 0
        while True:
            t0 = time.time()
            try:
                self.cycle()
                if t0 - last_report > 1800:
                    from .analysis import build_report
                    self.store.set_meta("report", build_report(self.store, self.cfg, int(t0)))
                    last_report = t0
            except Exception as e:  # nunca morir por un fallo de red
                self.err(f"ciclo: {type(e).__name__}: {e}")
            time.sleep(max(1, self.cfg["poll_seconds"] - (time.time() - t0)))

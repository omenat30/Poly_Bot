import io
import json
import os
import random
import re
import sys
import tempfile
import unittest
import urllib.error
import urllib.parse

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from radar import demo, wallet_history
from radar.config import load_config
from radar.engine import Engine
from radar.sources import gmgn as G
from radar.store import Store

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NOW = 1_800_000_000


class FakeResp(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


class FakeNet:
    """Sustituye a urlopen: guarda cada petición y responde lo que se le dé."""

    def __init__(self, responses):
        self.responses = responses  # ruta -> dict (data) | Exception
        self.calls = []

    def __call__(self, req, timeout=0):
        u = urllib.parse.urlparse(req.full_url)
        self.calls.append({"path": u.path, "q": urllib.parse.parse_qs(u.query), "headers": dict(req.header_items()),
                           "method": req.get_method(), "body": req.data})
        r = self.responses[u.path]
        if isinstance(r, Exception):
            raise r
        return FakeResp(json.dumps({"code": 0, "data": r}).encode())


def make(resp, cfg=None):
    cfg = cfg or load_config("/nonexistent.json")
    cfg["keys"]["gmgn"] = "KEY123"
    net = FakeNet(resp)
    sleeps = []
    bucket = G.LeakyBucket(5, 5, clock=lambda: 0.0, sleep=sleeps.append)
    return G.Gmgn(cfg, bucket=bucket, opener=net), net, sleeps


class ReadOnlyGuarantees(unittest.TestCase):
    def test_route_list_is_closed_and_has_no_trading(self):
        paths = " ".join(p for _, p in G.READ_ONLY)
        for bad in ("swap", "order", "strategy", "cooking", "follow_wallet", "wallet_holdings", "quote"):
            self.assertNotIn(bad, paths)

    def test_unlisted_route_never_reaches_the_network(self):
        g, net, _ = make({})
        for m, p in [("POST", "/v1/trade/swap"), ("GET", "/v1/user/wallet_holdings"), ("POST", "/v1/trade/strategy/create")]:
            with self.assertRaises(G.GmgnError):
                g._request(m, p)
        self.assertEqual(net.calls, [])

    def test_code_never_touches_signing_or_private_key(self):
        """Ningún archivo del paquete lee GMGN_PRIVATE_KEY ni firma peticiones."""
        for root, _, files in os.walk(os.path.join(ROOT, "radar")):
            for f in files:
                if f.endswith(".py"):
                    with open(os.path.join(root, f), encoding="utf-8") as fh:
                        src = fh.read()
                    code = "\n".join(l for l in src.splitlines() if not l.strip().startswith("#"))
                    self.assertNotRegex(code, r"environ\.get\(\s*['\"]GMGN_PRIVATE_KEY", f)
                    self.assertNotIn("X-Signature", code.replace("NO incluye", ""), f)

    def test_read_request_shape(self):
        g, net, _ = make({"/v1/token/security": {"renounced_mint": 1}})
        g.security("MINT1")
        c = net.calls[0]
        self.assertEqual(c["headers"].get("X-apikey"), "KEY123")
        self.assertNotIn("X-signature", {k.lower() for k in c["headers"]})
        self.assertIn("timestamp", c["q"])
        self.assertIn("client_id", c["q"])
        self.assertEqual(c["q"]["address"], ["MINT1"])
        self.assertEqual(c["method"], "GET")


class RateLimiting(unittest.TestCase):
    def test_bucket_waits_when_weight_exceeds_capacity(self):
        sleeps = []
        b = G.LeakyBucket(5, 5, clock=lambda: 0.0, sleep=sleeps.append)
        b.acquire(5)
        self.assertEqual(sleeps, [])
        b.acquire(3)  # nivel 5 + 3 - capacidad 5 = 3 → 3/5 s
        self.assertAlmostEqual(sleeps[-1], 0.6)

    def test_bucket_drains_over_time(self):
        t = [0.0]
        sleeps = []
        b = G.LeakyBucket(5, 5, clock=lambda: t[0], sleep=sleeps.append)
        b.acquire(5)
        t[0] = 1.0  # tras 1 s se vacía por completo
        b.acquire(5)
        self.assertEqual(sleeps, [])

    def test_429_blocks_and_is_not_retried(self):
        body = json.dumps({"code": 429, "error": "RATE_LIMIT_BANNED", "reset_at": 4_000_000_000}).encode()
        err = urllib.error.HTTPError("u", 429, "x", {}, io.BytesIO(body))
        g, net, _ = make({"/v1/token/security": err})
        with self.assertRaises(G.GmgnRateLimited) as cm:
            g.security("M")
        self.assertTrue(cm.exception.banned)
        self.assertEqual(len(net.calls), 1)
        self.assertFalse(g.available)  # en pausa
        with self.assertRaises(G.GmgnRateLimited):
            g.security("M")
        self.assertEqual(len(net.calls), 1, "durante el bloqueo no se sale a la red")

    def test_api_error_code_raises(self):
        g, _, _ = make({"/v1/token/info": {}})
        g._open = lambda req, timeout=0: FakeResp(json.dumps({"code": 40001, "error": "BAD", "message": "m"}).encode())
        with self.assertRaises(G.GmgnError):
            g.info("M")


class Normalizers(unittest.TestCase):
    def test_security_and_info(self):
        g, _, _ = make({
            "/v1/token/security": {"renounced_mint": True, "renounced_freeze_account": 1, "top_10_holder_rate": "0.21",
                                   "rug_ratio": 0.1, "bundler_trader_amount_rate": 0.05, "creator_token_status": "creator_close"},
            "/v1/token/info": {"launchpad_progress": 0.93, "total_supply": "1000000000", "dev": {"creator_address": "DEV"},
                               "wallet_tags_stat": {"smart_wallets": 3, "renowned_wallets": 1}, "stat": {"fresh_wallet_rate": 0.2}}})
        s = g.security("M")
        self.assertIs(s["renounced_mint"], True)
        self.assertIs(s["renounced_freeze"], True)
        self.assertAlmostEqual(s["top10_rate"], 0.21)
        self.assertIsNone(s["insider_hold_rate"])  # lo que falta es None, no 0
        i = g.info("M")
        self.assertEqual((i["progress"], i["creator"], i["smart_wallets"]), (0.93, "DEV", 3))

    def test_holders_marks_curve_and_pools_and_funder(self):
        g, _, _ = make({"/v1/market/token_top_holders": {"list": [
            {"address": "CURVE", "amount_percentage": 0.2, "addr_type": 0, "is_on_curve": True},
            {"address": "POOL", "amount_percentage": 0.1, "addr_type": 2},
            {"address": "W1", "amount_percentage": 0.04, "tags": ["smart_degen"], "maker_token_tags": ["bundler"],
             "native_transfer": {"address": "FUND", "name": "", "timestamp": 1700000000}},
            {"address": "W2", "amount_percentage": 0.03, "native_transfer": {"address": "EXCH", "name": "Binance"}}]}})
        h = {x["owner"]: x for x in g.holders("M")}
        self.assertTrue(h["CURVE"]["excluded"] and h["POOL"]["excluded"])
        self.assertFalse(h["W1"]["excluded"])
        self.assertEqual((h["W1"]["funder"], h["W1"]["funder_ts"]), ("FUND", 1700000000))
        self.assertEqual(h["W2"]["funder_label"], "Binance")

    def test_created_tokens_feed_the_rug_counter(self):
        from radar import security
        g, _, _ = make({"/v1/user/created_tokens": {"tokens": [
            {"token_address": "A", "market_cap": "120", "token_ath_mc": "80000", "is_open": False},
            {"token_address": "B", "market_cap": "50000", "token_ath_mc": "60000", "is_open": True}]}})
        cc = g.created_tokens("DEV")
        self.assertEqual(security.count_prev_rugs(cc, load_config("/x")["security"]), (1, 0))

    def test_activity_to_positions_and_quality(self):
        rows = []
        for i in range(4):
            t0 = 1_700_000_000 + i * 100_000
            rows.append({"event_type": "buy", "token": {"address": f"T{i}"}, "token_amount": "100", "cost_usd": "150", "timestamp": t0})
            rows.append({"event_type": "sell", "token": {"address": f"T{i}"}, "token_amount": "100", "cost_usd": "300", "timestamp": t0 + 3600})
        rows.append({"event_type": "transferIn", "token": {"address": "X"}, "token_amount": "5", "cost_usd": "0", "timestamp": 1})
        p = wallet_history.parse_gmgn_activity("W", rows, usd_per_sol=150.0)
        self.assertEqual(p["n_trades"], 8)
        self.assertNotIn("X", p["positions"])
        s = wallet_history.summarize(p, load_config("/x"))
        self.assertTrue(s["quality"], s)
        self.assertAlmostEqual(s["pnl_sol"], 4.0)


class FakeWorld:
    """pump.fun + GMGN simulados con un token sintético 'bueno' y otro con cluster."""

    def __init__(self, cfg, kind):
        rng = random.Random(4)
        coin, trades, holders, minfo, cc, wd = demo.synth_inputs(rng, kind, cfg, NOW, 0.9)
        self.coin, self.trades = coin, trades
        self.holders_raw = holders
        self.wd = wd

    def list_live(self, sol=None):
        return [self.coin]

    def trades_(self):
        return self.trades

    def coin_(self):
        return self.coin


class EngineWithGmgn(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.cfg = load_config("/nonexistent.json")
        self.cfg["keys"]["gmgn"] = "K"
        self.cfg["track_score"] = 1
        self.store = Store(os.path.join(self.tmp.name, "g.sqlite"))
        rng = random.Random(4)
        self.coin, self.trades, holders, _m, _c, wd = demo.synth_inputs(rng, "cluster", self.cfg, NOW, 0.9)
        shared = "SHAREDFUNDER"
        self.hl = [{"owner": "CURVE", "pct": 0.2, "excluded": True, "tags": [], "maker_tags": [], "funder": None,
                    "funder_label": None, "funder_ts": None}]
        for i, h in enumerate(holders):
            self.hl.append({"owner": h["owner"], "pct": h["amount"] / 1e9, "excluded": False,
                            "tags": ["smart_degen"] if i < 2 else [], "maker_tags": ["bundler"] if i == 3 else [],
                            "funder": shared if i < 8 else f"F{i}", "funder_label": None, "funder_ts": 1000 + i})
        outer = self

        class Pump:
            def list_live(s, sol=None):
                return [outer.coin]

            def trades(s, mint, **k):
                return outer.trades

            def coin(s, mint, sol=None):
                return outer.coin

        class Gm:
            available = True
            calls = {"activity": 0}

            def security(s, m):
                return {"renounced_mint": True, "renounced_freeze": True, "top10_rate": 0.2, "rug_ratio": 0.05,
                        "bundler_rate": 0.04, "rat_rate": 0.01, "insider_hold_rate": 0.02, "dev_team_rate": 0,
                        "sniper_count": 2, "creator_status": "creator_close", "burn_status": "", "is_wash": False}

            def info(s, m):
                return {"progress": 0.9, "total_supply": 1e9, "creator": "DEV", "smart_wallets": 2, "renowned_wallets": 0,
                        "sniper_wallets": 1, "bundler_wallets": 1, "rat_trader_wallets": 0, "fresh_wallet_rate": 0.1,
                        "bot_degen_rate": 0.0, "liquidity": 1, "holder_count": 100, "launchpad": "pump"}

            def holders(s, m):
                return outer.hl

            def created_tokens(s, w):
                return []

            def activity(s, w):
                s.calls["activity"] += 1
                return []

        class Dex:
            def sol_usd(s):
                return 150.0

            def best_pair(s, m):
                return None

        class NoHelius:
            available = False

        self.gm = Gm()
        self.eng = Engine(self.cfg, self.store, pump=Pump(), helius=NoHelius(), dex=Dex(), gmgn=self.gm,
                          log=lambda *a: None, rng=random.Random(1))

    def tearDown(self):
        self.store.close()
        self.tmp.cleanup()

    def test_gmgn_path_detects_cluster_from_funder_and_records_extras(self):
        self.eng.cycle(NOW)
        r = self.store.latest_since(0)[0]
        self.assertEqual(r["extras"]["data_source"], "gmgn")
        self.assertEqual(r["extras"]["smart_in_holders"], 2)
        self.assertEqual(r["extras"]["bundler_in_holders"], 1)
        self.assertGreaterEqual(r["features"]["gx_smart_wallets"], 2)
        self.assertGreater(r["features"]["largest_cluster_pct"], 30, "8 wallets con el mismo fondeador deben formar un clúster")
        self.assertNotIn("gx_data_source", r["features"])  # los textos no entran como característica numérica

    def test_works_without_helius(self):
        self.eng.cycle(NOW)
        self.assertTrue(self.store.latest_since(0))

    def test_activity_budget_is_respected(self):
        self.cfg["gmgn"]["history_wallets"] = 5
        self.eng.cycle(NOW)
        self.assertLessEqual(self.gm.calls["activity"], 5)

    def test_gmgn_unknown_authority_is_not_assumed_safe(self):
        self.gm.security = lambda m: {"renounced_mint": None, "renounced_freeze": None, "top10_rate": None, "rug_ratio": None,
                                      "bundler_rate": None, "rat_rate": None, "insider_hold_rate": None, "dev_team_rate": None,
                                      "sniper_count": None, "creator_status": None, "burn_status": None, "is_wash": None}
        self.eng.cycle(NOW)
        r = self.store.latest_since(0)[0]
        self.assertTrue(r["discarded"])
        self.assertTrue(any("mint_authority" in x for x in r["reasons"]))

    def test_rate_limit_pauses_cycle_without_crashing(self):
        def boom(m):
            raise G.GmgnRateLimited("limite", 4_000_000_000, True)
        self.gm.security = boom
        self.eng.cycle(NOW)
        self.assertEqual(self.store.latest_since(0), [])
        self.assertTrue(self.store.get_meta("errors"))


if __name__ == "__main__":
    unittest.main()

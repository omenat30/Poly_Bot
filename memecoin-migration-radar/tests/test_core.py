import os
import random
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from radar import analysis, clusters, costs, demo, evaluate, manipulation, security, stats, wallet_history
from radar.alerts import build_email, send_email
from radar.config import load_config
from radar.sources.pumpfun import normalize_coin, normalize_trade
from radar.store import Store
from radar.util import redact, sanitize_text
from radar.variants import load_variants, passes

CFG = load_config("/nonexistent.json")


class Clusters(unittest.TestCase):
    def test_same_funder_close_in_time_merges(self):
        ws = ["a", "b", "c", "d"]
        cl, _ = clusters.build_clusters(ws, {"a": ("F", 100), "b": ("F", 200), "c": ("G", 100)}, [], {}, CFG)
        self.assertIn(["a", "b"], cl)
        self.assertEqual(len(cl), 3)

    def test_same_funder_far_apart_does_not_merge(self):
        cl, _ = clusters.build_clusters(["a", "b"], {"a": ("F", 0), "b": ("F", 10 ** 6)}, [], {}, CFG)
        self.assertEqual(len(cl), 2)

    def test_single_same_slot_is_not_enough_two_are(self):
        one, _ = clusters.build_clusters(["a", "b"], {}, [], {1: ["a", "b"]}, CFG)
        two, _ = clusters.build_clusters(["a", "b"], {}, [], {1: ["a", "b"], 2: ["a", "b"]}, CFG)
        self.assertEqual(len(one), 2)
        self.assertEqual(len(two), 1)

    def test_direct_transfer_merges(self):
        cl, _ = clusters.build_clusters(["a", "b"], {}, [("a", "b")], {}, CFG)
        self.assertEqual(len(cl), 1)

    def test_ignored_funder(self):
        cfg = load_config("/nonexistent.json")
        cfg["wallets"]["ignore_funders"] = ["EXCH"]
        cl, _ = clusters.build_clusters(["a", "b"], {"a": ("EXCH", 1), "b": ("EXCH", 2)}, [], {}, cfg)
        self.assertEqual(len(cl), 2)

    def test_effective_independent(self):
        cl = [["a"], ["b"], ["c"], ["d"]]
        ind = clusters.independence(cl, {"a": 1, "b": 1, "c": 1, "d": 1})
        self.assertAlmostEqual(ind["effective"], 4.0)
        ind2 = clusters.independence([["a", "b", "c"], ["d"]], {"a": 1, "b": 1, "c": 1, "d": 1})
        self.assertAlmostEqual(ind2["largest_pct"], 75.0)
        self.assertLess(ind2["effective"], 2)


class Wallets(unittest.TestCase):
    def tx(self, ts, side, mint, sol, tokens):
        raw = {"tokenAmount": str(int(tokens * 1e6)), "decimals": 6}
        if side == "buy":
            sw = {"nativeInput": {"account": "W", "amount": str(int(sol * 1e9))}, "tokenOutputs": [{"mint": mint, "rawTokenAmount": raw}]}
        else:
            sw = {"nativeOutput": {"account": "W", "amount": str(int(sol * 1e9))}, "tokenInputs": [{"mint": mint, "rawTokenAmount": raw}]}
        return {"timestamp": ts, "events": {"swap": sw}}

    def test_quality_wallet(self):
        txs = []
        for i in range(4):
            txs += [self.tx(1000 + i * 9000, "buy", f"m{i}", 1.0, 100), self.tx(1000 + i * 9000 + 1800, "sell", f"m{i}", 1.8, 100)]
        s = wallet_history.summarize(wallet_history.parse_wallet_txs("W", txs), CFG)
        self.assertTrue(s["quality"], s)
        self.assertGreater(s["pnl_sol"], 0)

    def test_quick_exit_wallet_is_not_quality(self):
        txs = []
        for i in range(5):
            txs += [self.tx(1000 + i * 9000, "buy", f"m{i}", 1.0, 100), self.tx(1000 + i * 9000 + 20, "sell", f"m{i}", 1.4, 100)]
        s = wallet_history.summarize(wallet_history.parse_wallet_txs("W", txs), CFG)
        self.assertFalse(s["quality"])
        self.assertIn("rápido", s["reason"])

    def test_losing_wallet_is_not_quality(self):
        txs = []
        for i in range(4):
            txs += [self.tx(1000 + i * 9000, "buy", f"m{i}", 1.0, 100), self.tx(1000 + i * 9000 + 3600, "sell", f"m{i}", 0.5, 100)]
        s = wallet_history.summarize(wallet_history.parse_wallet_txs("W", txs), CFG)
        self.assertFalse(s["quality"])

    def test_empty_history_has_no_data(self):
        s = wallet_history.summarize(wallet_history.parse_wallet_txs("W", []), CFG)
        self.assertFalse(s["has_data"])

    def test_funder_only_when_history_complete(self):
        tx = {"timestamp": 5, "nativeTransfers": [{"fromUserAccount": "F", "toUserAccount": "W", "amount": 5 * 10 ** 8}]}
        self.assertEqual(wallet_history.parse_wallet_txs("W", [tx], limit=100)["funder"], "F")
        self.assertIsNone(wallet_history.parse_wallet_txs("W", [tx] * 100, limit=100)["funder"])


class Security(unittest.TestCase):
    def base(self, **k):
        d = {"mint_known": True, "mint_authority": None, "freeze_authority": None, "top10_pct": 20.0,
             "prev_rugs": 0, "honeypot": False}
        d.update(k)
        return security.evaluate(d, CFG)

    def test_clean_passes(self):
        self.assertTrue(self.base()["ok"])

    def test_each_failure_discards(self):
        for k in ({"mint_authority": "X"}, {"freeze_authority": "X"}, {"top10_pct": 60.0}, {"prev_rugs": 5}, {"honeypot": True}):
            self.assertFalse(self.base(**k)["ok"], k)

    def test_unknown_is_fail(self):
        self.assertFalse(self.base(top10_pct=None)["ok"])
        self.assertFalse(self.base(prev_rugs=None)["ok"])
        self.assertFalse(self.base(honeypot=None)["ok"])
        self.assertFalse(security.evaluate({"mint_known": False}, CFG)["ok"])

    def test_prev_rugs_count(self):
        coins = [{"mint": "a", "mcap_usd": 100, "ath_mcap": 50000}, {"mint": "b", "mcap_usd": 40000, "ath_mcap": 50000},
                 {"mint": "me", "mcap_usd": 1, "ath_mcap": 90000}, {"mint": "c", "mcap_usd": 5, "ath_mcap": None}]
        self.assertEqual(security.count_prev_rugs(coins, CFG["security"], "me"), (1, 1))


class Manipulation(unittest.TestCase):
    def test_wash_detected(self):
        tr = [{"ts": 0, "wallet": "w", "is_buy": True, "sol": 2.0}, {"ts": 20, "wallet": "w", "is_buy": False, "sol": 2.0},
              {"ts": 0, "wallet": "x", "is_buy": True, "sol": 1.0}]
        st = manipulation.wash_stats(tr, {}, CFG)
        self.assertAlmostEqual(st["wash_share"], 0.8)
        self.assertFalse(manipulation.score_manipulation(st, 0, 0, CFG)["ok"])

    def test_clean_flow(self):
        tr = [{"ts": i * 100, "wallet": f"w{i}", "is_buy": True, "sol": 1.0} for i in range(10)]
        st = manipulation.wash_stats(tr, {}, CFG)
        self.assertEqual(st["wash_share"], 0)
        self.assertTrue(manipulation.score_manipulation(st, 1, 5, CFG)["ok"])

    def test_creator_and_cluster_dominance(self):
        st = {"wash_share": 0, "circular_share": 0}
        self.assertFalse(manipulation.score_manipulation(st, 25, 0, CFG)["ok"])
        self.assertFalse(manipulation.score_manipulation(st, 0, 60, CFG)["ok"])


class Evaluate(unittest.TestCase):
    def run_kind(self, kind, progress=0.88):
        rng = random.Random(3)
        return demo.evaluate_synth(rng, kind, CFG, 1_800_000_000, progress)[1]

    def test_good_token_scores_and_passes(self):
        r = self.run_kind("good")
        self.assertFalse(r["discarded"], r["reasons"])
        self.assertGreater(r["score"], 50)

    def test_cluster_token_has_fewer_independent_holders(self):
        g, c = self.run_kind("good"), self.run_kind("cluster")
        self.assertLess(c["features"]["eff_independent"], g["features"]["eff_independent"])
        self.assertGreater(c["features"]["largest_cluster_pct"], g["features"]["largest_cluster_pct"])

    def test_wash_token_discarded(self):
        r = self.run_kind("wash")
        self.assertTrue(r["discarded"])
        self.assertTrue(any("manipulación" in x.lower() or "Sin manipulación" in x for x in r["reasons"]), r["reasons"])

    def test_unsafe_token_discarded_with_score_zero(self):
        r = self.run_kind("unsafe")
        self.assertTrue(r["discarded"])
        self.assertEqual(r["score"], 0.0)
        self.assertGreater(r["raw_score"], 0)

    def test_gates(self):
        self.assertFalse(evaluate.score_curve(50, 40000, CFG)["ok"])
        self.assertFalse(evaluate.score_curve(90, 20000, CFG)["ok"])
        self.assertFalse(evaluate.score_curve(99.9, 60000, CFG)["ok"])
        self.assertTrue(evaluate.score_curve(90, 40000, CFG)["ok"])

    def test_progress_from_sol(self):
        self.assertAlmostEqual(evaluate.curve_progress({"real_sol": 42.5}, CFG), 50.0)

    def test_volume_spike_scores_lower_than_spread(self):
        now = 10_000
        spread = [{"ts": now - i * 10, "wallet": f"w{i}", "is_buy": True, "sol": 1.0} for i in range(28)]
        spike = [{"ts": now - 5, "wallet": f"w{i}", "is_buy": True, "sol": 1.0} for i in range(28)]
        self.assertGreater(evaluate.score_volume(spread, now, CFG)["score"], evaluate.score_volume(spike, now, CFG)["score"])


class Costs(unittest.TestCase):
    def test_slippage_grows_with_size(self):
        a = costs.curve_buy_slip(100, 3e8, 1, 1.0)
        b = costs.curve_buy_slip(100, 3e8, 10, 1.0)
        self.assertGreater(b, a)
        self.assertGreater(a, 0)

    def test_flat_price_loses_costs(self):
        s = {"price": 1e-5, "vsol": 100, "vtok": 100 * 150 / 1e-5, "liq": None, "complete": False, "sol_usd": 150.0}
        ret, rug = costs.net_return(s, dict(s), CFG)
        self.assertLess(ret, 0)
        self.assertGreater(ret, -0.1)
        self.assertFalse(rug)

    def test_rug_flag_and_loss(self):
        s = {"price": 1e-5, "vsol": 100, "vtok": 100 * 150 / 1e-5, "liq": None, "complete": False, "sol_usd": 150.0}
        ret, rug = costs.net_return(s, dict(s, price=5e-7), CFG)
        self.assertTrue(rug)
        self.assertLess(ret, -0.9)

    def test_doubling_is_less_than_100pct_net(self):
        s = {"price": 1e-5, "vsol": 100, "vtok": 100 * 150 / 1e-5, "liq": None, "complete": False, "sol_usd": 150.0}
        ret, _ = costs.net_return(s, dict(s, price=2e-5), CFG)
        self.assertGreater(ret, 0.8)
        self.assertLess(ret, 1.0)


class Stats(unittest.TestCase):
    def test_signflip_detects_real_edge_and_not_noise(self):
        self.assertLess(stats.signflip_test([0.2] * 30, 2000), 0.01)
        rng = random.Random(1)
        noise = [rng.gauss(0, 1) for _ in range(40)]
        self.assertGreater(stats.signflip_test(noise, 2000), 0.05)

    def test_spearman(self):
        self.assertAlmostEqual(stats.spearman([1, 2, 3, 4, 5], [2, 4, 6, 8, 10]), 1.0)
        self.assertAlmostEqual(stats.spearman([1, 2, 3, 4, 5], [5, 4, 3, 2, 1]), -1.0)


class Parsing(unittest.TestCase):
    def test_pump_units_and_sanitizing(self):
        c = normalize_coin({"mint": "m", "name": "<b>Hola</b>\n", "symbol": "X", "usd_market_cap": 50000,
                            "real_sol_reserves": 42_500_000_000, "virtual_sol_reserves": 72_500_000_000,
                            "virtual_token_reserves": 450_000_000_000_000, "complete": False,
                            "created_timestamp": 1_700_000_000_000})
        self.assertAlmostEqual(c["real_sol"], 42.5)
        self.assertAlmostEqual(c["virtual_tokens"], 450_000_000)
        self.assertEqual(c["created_ts"], 1_700_000_000)
        self.assertNotIn("<", c["name"])
        self.assertAlmostEqual(c["price_usd"], 5e-5)

    def test_trade(self):
        t = normalize_trade({"signature": "s", "timestamp": 1_700_000_000, "user": "u", "is_buy": True,
                             "sol_amount": 1_500_000_000, "token_amount": 5_000_000_000, "slot": 9})
        self.assertAlmostEqual(t["sol"], 1.5)

    def test_redact(self):
        self.assertNotIn("SECRET", redact("https://x/?api-key=SECRET&a=1"))
        self.assertEqual(sanitize_text("a\x00b<c>"), "abc")


class Variants(unittest.TestCase):
    def test_closed_list_of_at_most_12(self):
        vs = load_variants()
        self.assertLessEqual(len(vs), 12)
        self.assertEqual(len({v["id"] for v in vs}), len(vs))

    def test_discarded_never_passes(self):
        f = {"score": 99, "progress": 99, "eff_independent": 99, "quality_share": 1, "largest_cluster_pct": 1,
             "unique_buyers": 99, "mcap": 99999, "top10_pct": 1, "discarded": True}
        self.assertFalse(passes({"min_score": 1}, f))
        f["discarded"] = False
        self.assertTrue(passes({"min_score": 70, "min_progress": 80}, f))


class Alerts(unittest.TestCase):
    def test_email_goes_only_to_configured_address_and_is_validated(self):
        cfg = load_config("/nonexistent.json")
        cfg["keys"]["smtp_user"] = "me@example.com"
        res = demo.evaluate_synth(random.Random(5), "good", cfg, 1_800_000_000)[1]
        self.assertEqual(build_email(res, "n", "S", cfg)["To"], "albertomenat@gmail.com")
        cfg["email"]["enabled"] = True
        cfg["email"]["to"] = "a@x.com, b@y.com"
        self.assertFalse(send_email(res, "n", "S", cfg)[0])
        cfg["email"]["to"] = "albertomenat@gmail.com"
        ok, note = send_email(res, "n", "S", cfg)  # sin SMTP_PASSWORD: no envía
        self.assertFalse(ok)
        self.assertIn("SMTP", note)
        cfg["email"]["enabled"] = False
        self.assertFalse(send_email(res, "n", "S", cfg)[0])


class EndToEndMeasurement(unittest.TestCase):
    def test_random_data_is_never_declared_a_winner(self):
        """Prueba de honestidad: con precios al azar el análisis NO debe encontrar ventaja."""
        verdicts = []
        for seed in range(6):
            with tempfile.TemporaryDirectory() as d:
                st = Store(os.path.join(d, "t.sqlite"))
                now = 1_800_000_000
                demo.populate(st, CFG, random.Random(seed), now)
                rep = analysis.build_report(st, CFG, now)
                verdicts.append(rep["verdict"])
                st.close()
        self.assertTrue(all(v in ("DESCARTAR", "SIN DATOS SUFICIENTES") for v in verdicts) or
                        verdicts.count("SUPERA AL AZAR (provisional)") <= 1, verdicts)

    def test_planted_edge_is_detected(self):
        """Con una ventaja plantada (los de puntuación alta suben) el análisis sí la ve."""
        with tempfile.TemporaryDirectory() as d:
            st = Store(os.path.join(d, "t.sqlite"))
            now = 1_800_000_000
            rng = random.Random(2)
            cfg = load_config("/nonexistent.json")
            import json
            import math
            for i in range(160):
                is_c = i < 80
                t0 = now - rng.randint(2 * 86400, 14 * 86400)
                mint = f"M{i}"
                mcap = rng.uniform(31000, 66000)
                p0 = mcap / 1e9
                good = is_c and rng.random() < 0.6
                price = p0
                for j in range(150):
                    price *= math.exp(rng.gauss(0.002 if good else -0.0007, 0.01))
                    t = t0 + (j + 1) * 60
                    st.db.execute("INSERT OR REPLACE INTO series VALUES(?,?,?,?,?,?,?,?,?)",
                                  (mint, t, price, price * 1e9, 100.0, 100 * 150 / price, None, 0, 150.0))
                st.db.execute("INSERT INTO tracked VALUES(?,?,?,?,?,?,?,?)",
                              (mint, "candidate" if is_c else "control", t0, t0 + 90000, t0 + 90001, mcap, "d", "D"))
                if is_c:
                    f = {"progress": 85, "mcap": mcap, "score": 80 if good else 72, "unique_buyers": 20, "eff_independent": 8,
                         "largest_cluster_pct": 10, "quality_share": 0.5, "coverage": 0.8, "wash_share": 0, "top10_pct": 20,
                         "creator_pct": 1, "prev_rugs": 0, "sec_ok": True, "discarded": False, "slip_buy_pct": 3,
                         "vsol": 100.0, "vtok": 100 * 150 / p0, "sol_usd": 150.0}
                    st.db.execute("INSERT INTO observations(mint,ts,price,mcap,progress,score,discarded,features) VALUES(?,?,?,?,?,?,?,?)",
                                  (mint, t0, p0, mcap, 85, f["score"], 0, json.dumps(f)))
            st.db.commit()
            cfg["analysis"]["horizons_s"] = [300, 3600]
            rep = analysis.build_report(st, cfg, now)
            self.assertEqual(rep["verdict"], "SUPERA AL AZAR (provisional)", rep)
            st.close()


if __name__ == "__main__":
    unittest.main()

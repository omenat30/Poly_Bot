import json
import os
import random
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from radar import demo
from radar.config import load_config
from radar.engine import Engine
from radar.state import build_state
from radar.store import Store

NOW = 1_800_000_000


class FakeWorld:
    """Simula pump.fun + Helius + DexScreener con un token 'bueno' y otro 'inseguro'."""

    def __init__(self, cfg):
        rng = random.Random(4)
        self.cfg = cfg
        self.data = {}
        for kind in ("good", "unsafe"):
            coin, trades, holders, minfo, cc, wd = demo.synth_inputs(rng, kind, cfg, NOW, 0.9)
            for t in trades:  # en la realidad cada firma es única en toda la cadena
                t["sig"] = f"{coin['mint'][:6]}-{t['sig']}"
            self.data[coin["mint"]] = (coin, trades, holders, minfo, cc, wd)
        self.by_wallet = {}
        for coin, _t, _h, _m, _c, wd in self.data.values():
            self.by_wallet.update(wd)
        self.calls = {"wallet_txs": 0}
        self.price_factor = 1.0

    # --- pump
    def list_live(self, sol=None):
        return [d[0] for d in self.data.values()]

    def trades(self, mint, **k):
        return self.data[mint][1]

    def creator_coins(self, creator, sol=None):
        for d in self.data.values():
            if d[0]["creator"] == creator:
                return d[4]
        return []

    def coin(self, mint, sol=None):
        c = dict(self.data[mint][0])
        c["price_usd"] = c["price_usd"] * self.price_factor
        return c

    # --- helius (curva: firmas y transacciones con la FORMA REAL verificada de Helius)
    available = True

    def _all_trades(self, mint):
        return sorted(self.data[mint][1], key=lambda t: -t["ts"])

    def curve_signatures(self, address, until=None, limit=1000):
        mint = next(m for m, d in self.data.items() if d[0]["bonding_curve"] == address)
        out = []
        for t in self._all_trades(mint):
            if t["sig"] == until:
                break
            out.append({"signature": t["sig"], "blockTime": int(t["ts"]), "err": None})
        self.calls["parse_sigs"] = self.calls.get("parse_sigs", 0)
        return out

    def parse_transactions(self, sigs):
        self.calls["parse_sigs"] = self.calls.get("parse_sigs", 0) + len(sigs)
        by = {t["sig"]: (m, t) for m, d in self.data.items() for t in d[1]}
        res = []
        for sg in sigs:
            m, t = by[sg]
            curve = self.data[m][0]["bonding_curve"]
            a, b = (curve, t["wallet"]) if t["is_buy"] else (t["wallet"], curve)
            res.append({"signature": sg, "timestamp": int(t["ts"]), "slot": t.get("slot"), "type": "SWAP", "source": "PUMP_FUN",
                        "events": {}, "transactionError": None,
                        "tokenTransfers": [{"fromUserAccount": a, "toUserAccount": b, "tokenAmount": t["tokens"], "mint": m}],
                        "nativeTransfers": [],
                        "accountData": [{"account": curve, "nativeBalanceChange": int((1 if t["is_buy"] else -1) * t["sol"] * 1e9)}]})
        return res

    def holders(self, mint, exclude):
        return self.data[mint][2], 1e9 - 793.1e6 * 0.9

    def mint_info(self, mint):
        return self.data[mint][3]

    def wallet_txs(self, w, limit=100):
        self.calls["wallet_txs"] += 1
        return []  # sin historial real: el motor debe tolerarlo

    # --- dex
    def sol_usd(self):
        return 150.0

    def best_pair(self, mint):
        return None


class EngineTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.cfg = load_config("/nonexistent.json")
        self.cfg["keys"]["helius"] = "x"
        self.cfg["track_score"] = 1
        self.store = Store(os.path.join(self.tmp.name, "e.sqlite"))
        self.w = FakeWorld(self.cfg)
        self.eng = Engine(self.cfg, self.store, pump=self.w, helius=self.w, dex=self.w, log=lambda *a: None,
                          rng=random.Random(1))
        self.eng.alert_variant = {"min_score": 1}  # fuerza avisos con datos sintéticos sin historial

    def tearDown(self):
        self.store.close()
        self.tmp.cleanup()

    def test_cycle_scores_tracks_alerts_and_never_alerts_unsafe(self):
        self.eng.cycle(NOW)
        good, unsafe = [m for m, d in self.w.data.items() if d[0]["name"].endswith("good")][0], \
            [m for m, d in self.w.data.items() if d[0]["name"].endswith("unsafe")][0]
        al = {a["mint"]: a for a in self.store.alerts()}
        self.assertIn(good, al)
        self.assertNotIn(unsafe, al, "un token inseguro nunca debe avisar")
        self.assertIsNotNone(self.store.get_tracked(good))
        t = self.store.get_tracked(unsafe)
        self.assertTrue(t is None or t["kind"] == "control", "un token inseguro nunca es candidato")
        self.assertEqual(al[good]["emailed"], 0)  # correo desactivado
        self.assertIn("desactivado", al[good]["email_note"])
        self.assertIn("Curva", al[good]["reason"])

    def test_one_alert_per_token_and_cache(self):
        self.eng.cycle(NOW)
        calls = self.w.calls["wallet_txs"]
        self.eng.cycle(NOW + 30)  # dentro de deep_cache_seconds: no reevalúa ni vuelve a pedir
        self.assertEqual(self.w.calls["wallet_txs"], calls)
        self.eng.cycle(NOW + 400)  # reevalúa; wallets en caché; sigue habiendo una sola alerta por token
        self.assertEqual(self.w.calls["wallet_txs"], calls)
        self.assertEqual(len({a["mint"] for a in self.store.alerts()}), len(self.store.alerts()))

    def test_series_sampling_and_outcomes_in_state(self):
        self.eng.cycle(NOW)
        for k in range(1, 70):
            self.w.price_factor = 1.0 + 0.001 * k
            self.eng.sample_due(NOW + 60 * k)
        self.assertTrue(any(c["discarded"] for c in build_state(self.store, self.cfg, NOW + 60)["candidates"]))
        st = build_state(self.store, self.cfg, NOW + 4200)
        self.assertTrue(st["alerts"])
        o = st["alerts"][0]["outcomes"]
        self.assertEqual(o["5m"]["status"], "ok")
        self.assertEqual(o["1h"]["status"], "ok")
        self.assertEqual(o["24h"]["status"], "pendiente")
        json.dumps(st)  # serializable

    def test_no_helius_key_does_nothing_and_says_so(self):
        self.eng.helius = type("H", (), {"available": False})()
        self.eng.cycle(NOW)
        self.assertEqual(self.store.alerts(), [])
        self.assertTrue(self.store.get_meta("errors"))

    def test_control_sampling_is_rate_limited(self):
        self.cfg["track_score"] = 101  # nadie es candidato → todos pueden ser control
        self.eng.alert_variant = {"min_score": 101}
        self.eng.cycle(NOW)
        self.assertEqual(self.store.count_tracked("control"), 1)
        self.eng.cycle(NOW + 60)
        self.assertEqual(self.store.count_tracked("control"), 1)


if __name__ == "__main__":
    unittest.main()

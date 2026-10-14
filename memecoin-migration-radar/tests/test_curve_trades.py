import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from radar import wallet_history
from radar.config import load_config
from radar.sources.curve_trades import trades_from_enhanced

CFG = load_config("/nonexistent.json")
MINT, CURVE, USER = "MINTpump", "CURVEaddr", "USERwallet"


def tx(sig, from_, to, amount, curve_delta, err=None, mint=MINT, ts=1_791_991_100):
    """Forma REAL observada en Helius: events vacío, tokens en tokenTransfers, SOL en accountData de la curva."""
    return {"signature": sig, "timestamp": ts, "slot": 456885432, "type": "SWAP", "source": "PUMP_FUN", "events": {},
            "transactionError": err, "nativeTransfers": [{"fromUserAccount": from_, "toUserAccount": "feeRecipient", "amount": 895880}],
            "tokenTransfers": [{"fromUserAccount": from_, "toUserAccount": to, "tokenAmount": amount, "mint": mint}],
            "accountData": [{"account": CURVE, "nativeBalanceChange": curve_delta}, {"account": USER, "nativeBalanceChange": -curve_delta}]}


class CurveTrades(unittest.TestCase):
    def test_sell_and_buy_direction_and_size(self):
        t, sk = trades_from_enhanced([tx("s1", USER, CURVE, 3_356_381, -658_242_859),
                                      tx("b1", CURVE, USER, 126_863, 25_109_315)], MINT, CURVE)
        sell, buy = t
        self.assertFalse(sell["is_buy"])
        self.assertAlmostEqual(sell["sol"], 0.658242859)
        self.assertEqual(sell["wallet"], USER)
        self.assertTrue(buy["is_buy"])
        self.assertAlmostEqual(buy["sol"], 0.025109315)
        self.assertEqual(sk, 0)

    def test_failed_transactions_are_dropped(self):
        t, _ = trades_from_enhanced([tx("f", CURVE, USER, 1, 5, err={"InstructionError": [4, {"Custom": 6042}]})], MINT, CURVE)
        self.assertEqual(t, [])

    def test_contradictory_direction_is_skipped_not_guessed(self):
        """Token sale (usuario -> curva) pero la curva gana SOL: algo no cuadra; no se inventa."""
        t, sk = trades_from_enhanced([tx("x", USER, CURVE, 100, 5_000_000)], MINT, CURVE)
        self.assertEqual((t, sk), ([], 1))

    def test_other_mint_or_no_transfer_is_skipped(self):
        t, sk = trades_from_enhanced([tx("o", USER, CURVE, 5, -1000, mint="OTHER"),
                                      {"signature": "n", "tokenTransfers": [], "accountData": []}], MINT, CURVE)
        self.assertEqual((t, sk), ([], 2))


class WalletDerive(unittest.TestCase):
    W = "WALLET"

    def curve_tx(self, ts, buy, sol, tokens, mint="M1"):
        a, b = ("CURVE", self.W) if buy else (self.W, "CURVE")
        return {"timestamp": ts, "type": "UNKNOWN", "source": "PUMP_FUN", "events": {}, "transactionError": None,
                "tokenTransfers": [{"fromUserAccount": a, "toUserAccount": b, "tokenAmount": tokens, "mint": mint}],
                "nativeTransfers": [],
                "accountData": [{"account": self.W, "nativeBalanceChange": int((-1 if buy else 1) * sol * 1e9)}]}

    def test_curve_buy_sell_positions_and_quality(self):
        txs = []
        for i in range(4):
            t0 = 1_700_000_000 + i * 100_000
            txs += [self.curve_tx(t0, True, 1.0, 100, f"M{i}"), self.curve_tx(t0 + 3600, False, 1.8, 100, f"M{i}")]
        p = wallet_history.parse_wallet_txs(self.W, txs)
        self.assertEqual(p["n_trades"], 8)
        s = wallet_history.summarize(p, CFG)
        self.assertTrue(s["quality"], s)
        self.assertAlmostEqual(s["pnl_sol"], 3.2)

    def test_amm_swap_with_wrapped_sol(self):
        wsol = wallet_history.WSOL
        t = {"timestamp": 5, "type": "SWAP", "source": "PUMP_AMM", "events": {}, "transactionError": None,
             "tokenTransfers": [{"fromUserAccount": "POOL", "toUserAccount": self.W, "tokenAmount": 500, "mint": "M9"},
                                {"fromUserAccount": self.W, "toUserAccount": "POOL", "tokenAmount": 0.14, "mint": wsol}],
             "accountData": [{"account": self.W, "nativeBalanceChange": -5000}]}
        d = wallet_history.derive_trade(self.W, t)
        self.assertEqual(d[0], "buy")
        self.assertAlmostEqual(d[2], 0.14, places=3)

    def test_failed_dust_and_multi_token_are_ignored(self):
        bad = self.curve_tx(1, True, 1.0, 5)
        bad["transactionError"] = {"err": 1}
        self.assertIsNone(wallet_history.derive_trade(self.W, bad))
        self.assertIsNone(wallet_history.derive_trade(self.W, self.curve_tx(1, True, 0.0001, 5)))
        multi = self.curve_tx(1, True, 1.0, 5)
        multi["tokenTransfers"].append({"fromUserAccount": "X", "toUserAccount": self.W, "tokenAmount": 9, "mint": "M2"})
        self.assertIsNone(wallet_history.derive_trade(self.W, multi))


if __name__ == "__main__":
    unittest.main()

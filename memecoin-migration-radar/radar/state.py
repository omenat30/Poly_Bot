"""Estado JSON que consume el panel."""
import time

from . import analysis

KEEP = ("mint", "name", "symbol", "ts", "progress", "mcap", "price", "score", "raw_score", "discarded",
        "reasons", "criteria", "security", "features", "extras")


def build_state(store, cfg, now=None, mode="live"):
    now = int(now or time.time())
    cands = []
    for r in store.latest_since(now - 900):
        c = {k: r.get(k) for k in KEEP}
        c["volume"] = r["criteria"]["volume"].get("metrics", {})
        c["history"] = r["criteria"]["history"].get("metrics", {})
        c["links"] = r.get("links", [])
        cands.append(c)
    cands.sort(key=lambda c: (c["discarded"], -(c["score"] or 0), -(c["raw_score"] or 0)))
    outcomes = analysis.alert_outcomes(store, cfg, now)
    al = []
    for a in store.alerts():
        al.append({"mint": a["mint"], "name": a["name"], "symbol": a["symbol"], "ts": a["ts"], "price": a["price"],
                   "mcap": a["mcap"], "progress": a["progress"], "score": a["score"], "reason": a["reason"],
                   "emailed": bool(a["emailed"]), "email_note": a["email_note"], "outcomes": outcomes.get(a["mint"], {})})
    last = store.get_meta("last_cycle")
    return {
        "mode": mode, "generated_at": now,
        "config": {"alert_score": cfg["alert_score"], "track_score": cfg["track_score"],
                   "gates": cfg["gates"], "curve_target_sol": cfg["curve_target_sol"],
                   "position_sol": cfg["costs"]["position_sol"], "weights": cfg["weights"]},
        "health": {"last_cycle": last, "errors": store.get_meta("errors", [])[-5:],
                   "sample_fails": store.get_meta("sample_fails"), "helius": bool(cfg["keys"]["helius"]), "gmgn": bool(cfg["keys"].get("gmgn")),
                   "gmgn_blocked_until": store.get_meta("gmgn_blocked_until"),
                   "email": bool(cfg["email"]["enabled"]), "sol_usd": (store.get_meta("sol_usd") or {}).get("v"),
                   "n_candidates_tracked": store.count_tracked("candidate"),
                   "n_controls_tracked": store.count_tracked("control")},
        "candidates": cands, "alerts": al, "report": store.get_meta("report"),
    }

"""Señales de control artificial del precio: wash trading, compras circulares,
creador o clúster dominando el suministro."""
from collections import defaultdict

from .util import clamp


def wash_stats(trades, wallet_cluster, cfg):
    """trades: dicts con ts, wallet, is_buy, sol.
    wallet_cluster: {wallet: id_de_clúster}.
    wash_share: volumen emparejado compra/venta de la MISMA wallet en ventana corta.
    circular_share: volumen de clústeres multi-wallet que compran y venden a la vez."""
    m = cfg["manipulation"]
    total = sum(t["sol"] for t in trades) or 0.0
    if total <= 0:
        return {"total_sol": 0.0, "wash_share": 0.0, "circular_share": 0.0}
    by_w = defaultdict(list)
    for t in trades:
        by_w[t["wallet"]].append(t)
    washed = 0.0
    for lst in by_w.values():
        lst.sort(key=lambda t: t["ts"])
        buys = [t for t in lst if t["is_buy"]]
        used = set()
        for s in (t for t in lst if not t["is_buy"]):
            for i, b in enumerate(buys):
                if i in used or b["ts"] > s["ts"] or s["ts"] - b["ts"] > m["wash_window_s"]:
                    continue
                r = s["sol"] / b["sol"] if b["sol"] else 0
                if m["wash_ratio_lo"] <= r <= m["wash_ratio_hi"]:
                    washed += b["sol"] + s["sol"]
                    used.add(i)
                    break
    cl_buy, cl_sell, cl_size = defaultdict(float), defaultdict(float), defaultdict(int)
    for w, c in wallet_cluster.items():
        cl_size[c] += 1
    for t in trades:
        c = wallet_cluster.get(t["wallet"])
        if c is None:
            continue
        (cl_buy if t["is_buy"] else cl_sell)[c] += t["sol"]
    circ = 0.0
    for c in set(cl_buy) | set(cl_sell):
        if cl_size[c] < 2:
            continue
        b, s = cl_buy[c], cl_sell[c]
        if min(b, s) >= 0.2 * (b + s):
            circ += b + s
    return {"total_sol": total, "wash_share": clamp(washed / total), "circular_share": clamp(circ / total)}


def score_manipulation(stats, creator_pct, largest_cluster_pct, cfg):
    """Criterio 0-100 (100 = limpio). `ok` False si se pasa algún umbral duro."""
    m = cfg["manipulation"]
    wash = max(stats["wash_share"], stats["circular_share"])
    ratios = {
        "wash/circular": wash * 100 / (m["max_wash_share"] * 100),
        "creador": (creator_pct or 0) / m["max_creator_pct"],
        "clúster dominante": (largest_cluster_pct or 0) / m["max_cluster_pct"],
    }
    worst = max(ratios.values())
    bad = [k for k, v in ratios.items() if v > 1]
    note = (f"wash {stats['wash_share']*100:.0f}% · circular {stats['circular_share']*100:.0f}% · "
            f"creador {creator_pct or 0:.1f}% · mayor clúster {largest_cluster_pct or 0:.0f}%")
    if bad:
        note += " · SUPERA: " + ", ".join(bad)
    return {"score": round(100 * clamp(1 - worst), 1), "ok": not bad, "note": note}

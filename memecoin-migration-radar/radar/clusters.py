"""Detección de clústeres de wallets controladas por una misma entidad.

Aristas (peso):
  - mismo fondeador de SOL, con fondeos cercanos en el tiempo ....... 2
  - transferencia directa entre dos wallets del conjunto ............ 2
  - compra en el mismo slot (cada coincidencia suma) ................. 1
Se unen dos wallets si el peso acumulado llega a 2 (dos coincidencias de slot
bastan; una sola no, porque dos compradores pueden coincidir por azar).

Límite conocido: si dos wallets se fondean desde el mismo exchange, parecen
hermanas sin serlo. Se mitiga con `ignore_funders` y con la ventana temporal.
"""
from collections import defaultdict
from itertools import combinations


class _UF:
    def __init__(self, items):
        self.p = {i: i for i in items}

    def find(self, x):
        while self.p[x] != x:
            self.p[x] = self.p[self.p[x]]
            x = self.p[x]
        return x

    def union(self, a, b):
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.p[rb] = ra


def build_clusters(wallets, funders, transfers, slot_buys, cfg):
    """wallets: lista de direcciones.
    funders: {wallet: (funder, ts)} (solo si se conoce de forma fiable).
    transfers: iterable de (a, b) entre wallets del conjunto.
    slot_buys: {slot: [wallets que compraron en ese slot]}.
    Devuelve (clusters, links): clusters = lista de listas; links = motivos."""
    wc = cfg["wallets"]
    ws = set(wallets)
    weight = defaultdict(int)
    why = defaultdict(list)

    def edge(a, b, w, reason):
        if a == b or a not in ws or b not in ws:
            return
        k = tuple(sorted((a, b)))
        weight[k] += w
        why[k].append(reason)

    ignore = set(wc.get("ignore_funders", []))
    by_funder = defaultdict(list)
    for w, fv in funders.items():
        if fv and fv[0] and fv[0] not in ignore and w in ws:
            by_funder[fv[0]].append((fv[1] or 0, w))
    for f, lst in by_funder.items():
        lst.sort()
        for (t1, a), (t2, b) in zip(lst, lst[1:]):
            if abs(t2 - t1) <= wc["funding_window_s"]:
                edge(a, b, 2, "mismo fondeador")
    for a, b in transfers:
        edge(a, b, 2, "transferencia directa")
    for slot, lst in slot_buys.items():
        for a, b in combinations(sorted(set(lst)), 2):
            edge(a, b, 1, f"compra en el mismo slot {slot}")

    uf = _UF(ws)
    links = []
    for (a, b), w in weight.items():
        if w >= 2:
            uf.union(a, b)
            links.append({"a": a, "b": b, "peso": w, "motivos": sorted(set(why[(a, b)]))})
    groups = defaultdict(list)
    for w in ws:
        groups[uf.find(w)].append(w)
    return sorted((sorted(g) for g in groups.values()), key=lambda g: (-len(g), g[0])), links


def independence(clusters, balances):
    """Holders independientes efectivos = 1 / Σ(cuota_i²) sobre cuotas de clúster.
    balances: {wallet: cantidad de tokens}. Devuelve métricas."""
    tot = sum(max(balances.get(w, 0.0), 0.0) for c in clusters for w in c)
    if tot <= 0:
        return {"effective": 0.0, "n_clusters": len(clusters), "largest_pct": 0.0,
                "multi": 0, "shares": []}
    shares = sorted((sum(max(balances.get(w, 0.0), 0.0) for w in c) / tot for c in clusters), reverse=True)
    hhi = sum(s * s for s in shares)
    return {
        "effective": 1.0 / hhi if hhi else 0.0,
        "n_clusters": len(clusters),
        "largest_pct": shares[0] * 100,
        "multi": sum(1 for c in clusters if len(c) > 1),
        "shares": [round(s, 4) for s in shares[:10]],
    }

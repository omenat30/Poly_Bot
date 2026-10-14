"""Variantes de filtros (lista cerrada en variants.json)."""
import json
import os

_RULES = {
    "min_score": lambda f, v: f["score"] >= v,
    "min_progress": lambda f, v: f["progress"] >= v,
    "min_eff_independent": lambda f, v: f["eff_independent"] >= v,
    "min_quality_share": lambda f, v: f["quality_share"] >= v,
    "max_largest_cluster_pct": lambda f, v: f["largest_cluster_pct"] <= v,
    "min_unique_buyers": lambda f, v: f["unique_buyers"] >= v,
    "min_mcap_usd": lambda f, v: f["mcap"] >= v,
    "max_top10_pct": lambda f, v: f["top10_pct"] is not None and f["top10_pct"] <= v,
}


def load_variants(path=None):
    path = path or os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "variants.json")
    with open(path, encoding="utf-8") as f:
        vs = json.load(f)["variants"]
    assert len(vs) <= 12, "máximo 12 variantes"
    return vs


def passes(variant, features):
    if features.get("discarded"):
        return False
    for k, v in variant.items():
        if k in _RULES and not _RULES[k](features, v):
            return False
    return True

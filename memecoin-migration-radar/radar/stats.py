"""Estadística sin dependencias: bootstrap, permutación, Spearman."""
import random

from .util import median


def mean(xs):
    return sum(xs) / len(xs) if xs else None


def bootstrap_ci(xs, n=2000, seed=7, q=(0.05, 0.95)):
    if len(xs) < 3:
        return None
    rng = random.Random(seed)
    ms = sorted(mean([rng.choice(xs) for _ in xs]) for _ in range(n))
    return ms[int(q[0] * n)], ms[min(int(q[1] * n), n - 1)]


def perm_test(a, b, n=5000, seed=7):
    """Un lado: P(diferencia de medias >= observada) si las etiquetas fueran azar.
    Devuelve (dif_medias, dif_medianas, p)."""
    if not a or not b:
        return None, None, None
    obs = mean(a) - mean(b)
    pool = list(a) + list(b)
    rng = random.Random(seed)
    k = len(a)
    hits = 0
    for _ in range(n):
        rng.shuffle(pool)
        if mean(pool[:k]) - mean(pool[k:]) >= obs:
            hits += 1
    return obs, median(a) - median(b), (hits + 1) / (n + 1)


def signflip_test(d, n=5000, seed=7):
    """Diferencias emparejadas: P(media >= observada) si el signo fuera azar. Un lado."""
    if not d:
        return None
    obs = mean(d)
    rng = random.Random(seed)
    hits = 0
    for _ in range(n):
        if mean([x if rng.random() < 0.5 else -x for x in d]) >= obs:
            hits += 1
    return (hits + 1) / (n + 1)


def _ranks(xs):
    order = sorted(range(len(xs)), key=lambda i: xs[i])
    r = [0.0] * len(xs)
    i = 0
    while i < len(order):
        j = i
        while j + 1 < len(order) and xs[order[j + 1]] == xs[order[i]]:
            j += 1
        for k in range(i, j + 1):
            r[order[k]] = (i + j) / 2 + 1
        i = j + 1
    return r


def spearman(x, y):
    if len(x) < 5 or len(x) != len(y):
        return None
    rx, ry = _ranks(x), _ranks(y)
    mx, my = mean(rx), mean(ry)
    num = sum((a - mx) * (b - my) for a, b in zip(rx, ry))
    den = (sum((a - mx) ** 2 for a in rx) * sum((b - my) ** 2 for b in ry)) ** 0.5
    return num / den if den else None


def spearman_perm_p(x, y, n=3000, seed=7):
    obs = spearman(x, y)
    if obs is None:
        return None, None
    rng = random.Random(seed)
    yy = list(y)
    hits = 0
    for _ in range(n):
        rng.shuffle(yy)
        s = spearman(x, yy)
        if s is not None and s >= obs:
            hits += 1
    return obs, (hits + 1) / (n + 1)


def describe(xs):
    if not xs:
        return {"n": 0}
    return {"n": len(xs), "mean": mean(xs), "median": median(xs),
            "win": sum(1 for x in xs if x > 0) / len(xs), "ci90": bootstrap_ci(xs)}

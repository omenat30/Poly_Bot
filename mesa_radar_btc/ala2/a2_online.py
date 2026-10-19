# Ala 2 · "a piñón": una operación simulada en CADA decisión de 10 min (lado preferido) y aprendizaje error tras error.
# Corrección en línea (NLMS) sobre las predicciones base de LightGBM: R̂_lado = base_lado + w_lado·z ; tras cada operación resuelta,
# w += η·(r_real − R̂)·z/(1+z·z). z = [1, 6 predicciones base, 38 variables] estandarizadas con medias y desviaciones de 2018-21.
# Se aprende de AMBOS lados (el no operado se resuelve igual, como sombra). Variantes cerradas: η ∈ {0 (sin aprender), 0,05, 0,2}. Elección con 2018-21.
import numpy as np, pickle, json, datetime as dt, math, sys
D = '/tmp/claude-0/-home-user-Poly-Bot/62062f9b-9ffe-50c1-8835-98e9f5ba9b0f/scratchpad/ala2/'
L = np.load(D + 'a2_lab5.npz'); td = L['td']; O = pickle.load(open(D + 'a2_oos5.pkl', 'rb'))['OOS']
X = np.fromfile(D + 'feat5.bin', dtype=np.float64).reshape(len(td), 40)[:, :38]
rL, rS, texL, texS = L['rL'], L['rS'], L['texL'], L['texS']
B = np.column_stack([O[k] for k in ('liqL', 'liqS', 'tecL', 'tecS', 'dirL', 'dirS')])
ts = lambda y: int(dt.datetime(y, 1, 1, tzinfo=dt.timezone.utc).timestamp())
ref = (td >= ts(2018)) & (td < ts(2022))   # escala: medias y desviaciones del periodo de elección
Z0 = np.column_stack([B, X]); mu = np.nanmean(Z0[ref], 0); sd = np.nanstd(Z0[ref], 0) + 1e-9
Z = np.clip(np.nan_to_num((Z0 - mu) / sd), -5, 5); Z = np.column_stack([np.ones(len(td)), Z]).astype(np.float64)
base = {'L': (B[:, 0] + B[:, 2]) / 2, 'S': (B[:, 1] + B[:, 3]) / 2}   # media de Montes y Aranda (el agregador elegido)
def run(eta, a, b, w0=None):
    w = {'L': np.zeros(Z.shape[1]), 'S': np.zeros(Z.shape[1])} if w0 is None else {k: v.copy() for k, v in w0.items()}
    ok = np.where((td >= a) & (td < b) & np.isfinite(base['L']) & np.isfinite(rL) & np.isfinite(rS))[0]
    pend = []; out = []
    import heapq
    for i in ok:
        t = td[i]
        while pend and pend[0][0] <= t:
            _, j, s = heapq.heappop(pend); r = rL[j] if s == 'L' else rS[j]; z = Z[j]; e = np.clip(r, -1.5, 1.6) - (base[s][j] + w[s] @ z); w[s] += eta * e * z / (1 + z @ z)
        pL = base['L'][i] + w['L'] @ Z[i]; pS = base['S'][i] + w['S'] @ Z[i]
        s = 1 if pL >= pS else -1; out.append((t, s, rL[i] if s == 1 else rS[i], max(pL, pS)))
        heapq.heappush(pend, (texL[i], i, 'L')); heapq.heappush(pend, (texS[i], i, 'S'))
    return out, w
def st(o):
    r = np.array([x[2] for x in o]); p = np.array([x[3] for x in o]); yrs = (o[-1][0] - o[0][0]) / 31557600
    return f"n {len(r)} ({len(r)/yrs/52.18:.0f}/sem) acierto {(r>0).mean()*100:.1f}% R/op {r.mean():+.3f} IC(previsto,real) {np.corrcoef(p, r)[0,1]:+.3f} top10% previsto R/op {r[p >= np.quantile(p, .9)].mean():+.3f}"
if __name__ == '__main__':
    best = None
    for eta in (0.0, 0.05, 0.2):
        o1, w1 = run(eta, ts(2018), ts(2022)); o2, _ = run(eta, ts(2022), int(td[-1]) + 1, w1)
        print(f'η {eta}: 18-21 {st(o1)}\n        22-26 {st(o2)}')
        r1 = np.mean([x[2] for x in o1]); best = (eta, r1) if best is None or r1 > best[1] else best
        for y in (2022, 2023, 2024, 2025, 2026): oy = [x for x in o2 if ts(y) <= x[0] < ts(y + 1)]; print('   ', y, st(oy)) if oy else None
    print('ELEGIDA con 2018-21: η', best[0])
    _, wf = run(0.05, ts(2018), int(td[-1]) + 1)   # pesos de partida del aprendiz en vivo: lo aprendido de 2018 a oct 2026
    json.dump(dict(mu=mu.tolist(), sd=sd.tolist(), eta=0.05, w={k: [round(float(x), 6) for x in v] for k, v in wf.items()}), open(D + 'online_init.json', 'w'))

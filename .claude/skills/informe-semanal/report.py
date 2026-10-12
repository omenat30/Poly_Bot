#!/usr/bin/env python3
"""Informe de la Mesa Radar en real frente a lo esperado del backtest v12 (2022-26).
Uso: python3 report.py <dir_signals> [--trades <dir_trades>] [--desde AAAA-MM-DD] [--semana AAAA-MM-DD]
<dir_signals>: los JSON de la colección `signals` (ArtifactData query con out_dir). <dir_trades>: los de `trades` (diario del usuario), opcional."""
import json, os, sys, glob, math, argparse, datetime as dt
ap = argparse.ArgumentParser(); ap.add_argument('signals'); ap.add_argument('--trades'); ap.add_argument('--desde', default='2026-10-12'); ap.add_argument('--semana')
A = ap.parse_args()
EXP = dict(sem=2.28, win=0.441, rop=0.279, cop=0.161, sd=1.60)   # v12, 2022-26 (validar-estrategia); sd = desviación del R de cartera por operación
def load(d): 
    out = []
    for f in glob.glob(os.path.join(d, '**', '*.json'), recursive=True):
        j = json.load(open(f)); out.append(j.get('data', j) | {'id': j.get('id', os.path.basename(f)[:-5])})
    return out
S = [s for s in load(A.signals) if s.get('real') and not s.get('test') and s.get('at', '') >= A.desde]
P = lambda iso: dt.datetime.fromisoformat(iso.replace('Z', '+00:00'))
byid = {s['id']: s for s in S}
ops = []
for s in S:
    if s.get('type') != 'entrada': continue
    o = byid.get(s['id'].replace('-in-', '-out-'))
    ops.append(dict(agent=s.get('agent'), desk=s.get('desk', 'propia'), at=P(s['at']), r=o.get('r') if o else None, closed=o is not None, w=1.0 if s.get('desk') == 'radar' else {'ortega': 1.0, 'paz': 0.5}.get(s.get('agent'), 1.0)))
bloq = [s for s in S if s.get('type') == 'bloqueo']
now = dt.datetime.now(dt.timezone.utc); w0 = P(A.semana + 'T00:00:00+00:00') if A.semana else now - dt.timedelta(days=7)
def st(L):
    c = [x for x in L if x['closed']]; n = len(c)
    if not n: return None
    r = [x['r'] for x in c]; wr = [x['r'] * x['w'] for x in c]
    return dict(n=n, win=sum(q > 0 for q in r) / n, rop=sum(r) / n, cop=sum(wr) / n, sum=sum(wr))
ini = P(A.desde + 'T00:00:00+00:00'); weeks = max(1 / 7, (now - ini).days / 7)
T, Wk = st(ops), st([x for x in ops if x['at'] >= w0])
print(f'# Mesa Radar · informe {now:%d %b %Y}\n')
if not ops: print('Sin operaciones avisadas todavía desde ' + A.desde + '.'); sys.exit(0)
fmt = lambda s: '—' if not s else f"{s['n']} cerradas · acierto {s['win']*100:.0f}% · R/op {s['rop']:+.2f} · cartera {s['sum']:+.2f}R"
print(f'- **Esta semana:** {fmt(Wk)} · abiertas {sum(1 for x in ops if not x["closed"])}')
print(f'- **Desde {A.desde}:** {fmt(T)} · {len(ops)/weeks:.1f} ops/semana (esperado {EXP["sem"]})')
if T:
    z = (T['cop'] - EXP['cop']) / (EXP['sd'] / math.sqrt(T['n']))
    print(f'- **Frente al backtest:** acierto {T["win"]*100:.0f}% (esp. {EXP["win"]*100:.0f}%), R/op {T["rop"]:+.2f} (esp. {EXP["rop"]:+.2f}), z = {z:+.1f}' + (' → ⚠️ por debajo de lo esperado' if T['n'] >= 20 and z < -2 else ' → dentro de lo normal' if T['n'] >= 20 else f' → aún pocas operaciones ({T["n"]}/20) para juzgar'))
print('\n| Agente | Mesa | Cerradas | Acierto | R total |\n|---|---|---|---|---|')
for (a, d) in sorted({(x['agent'], x['desk']) for x in ops}):
    s = st([x for x in ops if x['agent'] == a and x['desk'] == d])
    print(f'| {a} | {"aprendiz" if d == "radar" else "propia"} | {s["n"] if s else 0} | {f"{s["win"]*100:.0f}%" if s else "—"} | {f"{s["sum"]:+.2f}R" if s else "—"} |')
if bloq: print(f'\nBloqueadas por Salinas o paradas: {len(bloq)} (última: {bloq[-1].get("text","")[:120]})')
if A.trades:
    J = [t for t in load(A.trades) if t.get('exitPx') is not None]
    if J:
        rr = []; sl = []
        for t in J:
            s = 1 if t.get('side') in ('long', 1) else -1; risk = abs(t['plannedEntry'] - t['plannedStop'])
            if risk: rr.append(((t['exitPx'] - t['fillEntry']) * s * t['qty'] - t.get('fees', 0)) / (risk * t['qty'])); sl.append((t['fillEntry'] - t['plannedEntry']) * s / risk)
        print(f'\n**Tus operaciones reales (diario):** {len(rr)} cerradas, R medio {sum(rr)/len(rr):+.2f}, deslizamiento medio {sum(sl)/len(sl):+.2f}R' + (' ⚠️ alto' if len(sl) >= 10 and sum(sl) / len(sl) > 0.10 else ''))

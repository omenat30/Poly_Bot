#!/usr/bin/env python3
"""Control diario de la Mesa Radar: solo lee la base de datos (ticks y signals del día) y dice si todo ha ido bien.
Sustituye al control anterior, que dependía de list_triggers y list_events (no disponibles en la rutina) y por eso nunca comprobó las rondas.
Uso: python3 control_diario.py <dir_ticks> <dir_signals> [--dia AAAA-MM-DD] [--hasta AAAA-MM-DDTHH:MM:SSZ]
Los directorios son los que crea ArtifactData con out_dir (cada documento es un .json). Cuenta las rondas esperadas (L-V 7-20 Madrid, :01 :31 desde el 14 oct (antes también :16 :46)),
las que llegaron, su retraso, los avisos de datos, las señales perdidas y que ninguna salida, stop o parcial carezca de su entrada."""
import json, os, sys, re, datetime as dt
from zoneinfo import ZoneInfo
tz = ZoneInfo('Europe/Madrid'); utc = dt.timezone.utc
def load(d):
    out = []
    for f in sorted(os.listdir(d)) if os.path.isdir(d) else []:
        if f.endswith('.json'):
            x = json.load(open(os.path.join(d, f))); out.append(x.get('data', x) if isinstance(x, dict) else x)
    return out
a = sys.argv[1:]; dia = a[a.index('--dia') + 1] if '--dia' in a else dt.datetime.now(tz).strftime('%Y-%m-%d')
hasta = dt.datetime.fromisoformat(a[a.index('--hasta') + 1].replace('Z', '+00:00')) if '--hasta' in a else dt.datetime.now(utc)
T = load(a[0]); S = load(a[1]); day = dt.date.fromisoformat(dia)
ticks = sorted([(dt.datetime.fromisoformat(x['at'].replace('Z', '+00:00')), x) for x in T if x.get('at')], key=lambda p: p[0])
ticks = [(t, x) for t, x in ticks if t.astimezone(tz).date() == day]
inc = []
if day.weekday() >= 5: print(f'Control {dia}: fin de semana, sin rondas · nada que comprobar'); sys.exit(0)
slots = [dt.datetime(day.year, day.month, day.day, h, m, tzinfo=tz).astimezone(utc) for h in range(7, 21) for m in (1, 31)]
slots = [s for s in slots if s + dt.timedelta(minutes=14) <= hasta]
lags = []; falt = []
for s in slots:
    c = [t for t, _ in ticks if s <= t < s + dt.timedelta(minutes=14)]
    if c: lags.append((c[0] - s).total_seconds() / 60)
    else: falt.append(s.astimezone(tz).strftime('%H:%M'))
if falt: inc.append(f'{len(falt)} rondas sin registrar de {len(slots)} (' + ', '.join(falt[:8]) + (' …' if len(falt) > 8 else '') + ')')
tarde = sum(1 for l in lags if l > 8)
if tarde: inc.append(f'{tarde} rondas con más de 8 min de retraso')
mal = [t.astimezone(tz).strftime('%H:%M') for t, x in ticks if (x.get('radar') or {}).get('ok') is False or (x.get('radar') or {}).get('problems') or x.get('dataOk') is False]
if mal: inc.append(f'{len(mal)} rondas con avisos de datos (' + ', '.join(mal[:6]) + ')')
perd = [s for s in S if re.search(r'-lost-', str(s.get('id', ''))) and str(s.get('at', ''))[:10] >= (day - dt.timedelta(days=1)).isoformat()]
hoy = [s for s in S if dt.datetime.fromisoformat(str(s['at']).replace('Z', '+00:00')).astimezone(tz).date() == day] if S else []
perd_hoy = [s for s in perd if s in hoy]
if perd_hoy: inc.append(f'{len(perd_hoy)} señales perdidas hoy (' + '; '.join(str(s.get('text', ''))[:90] for s in perd_hoy[:3]) + ')')
ids = {str(s.get('id')) for s in S}
for s in hoy:
    if s.get('real') and s.get('type') in ('salida', 'stop', 'parcial'):
        base = re.sub(r'-(out|stop|tp)-', '-in-', str(s['id'])); base = re.sub(r'(-in-\d+)-\d+$', r'\1', base)
        if base not in ids: inc.append(f'{s["id"]}: {s["type"]} sin entrada avisada')
last = ticks[-1][1] if ticks else None
n = sw = z = None
if last:
    sc = (last.get('score') or {}).get('mesa') or {}; n, sw = sc.get('n'), sc.get('sumW'); v = ((last.get('notes') or {}).get('iturbe') or {}).get('val') or {}; z = v.get('z')
    if z is not None and n is not None and n >= 20 and z < -2: inc.append(f'z de Iturbe {z} con {n} operaciones: la mesa se desvía del backtest')
else: inc.append('ningún tick hoy')
ml = f'{sum(lags)/len(lags):.1f}' if lags else '–'
resumen = f'rondas {len(lags)}/{len(slots)} (retraso medio {ml} min) · {n if n is not None else "–"} operaciones, {sw if sw is not None else "–"}R, z {z if z is not None else "–"}'
if not inc: print(f'Control {dia}: todo en orden · {resumen}')
else: print(f'Control {dia}: {len(inc)} incidencias · {resumen}\n' + '\n'.join('- ' + i for i in inc))

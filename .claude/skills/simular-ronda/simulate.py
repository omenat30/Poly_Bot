#!/usr/bin/env python3
"""Ensayo de la oficina: repite rondas reales (cada 15 min, L-V 7-21 Madrid) con el código de mesa_radar_btc/office y comprueba invariantes.
Uso: python3 simulate.py 2026-09-03 [2026-09-04 ...] [--inicio 2026-09-01] [--office DIR] [--csv RUTA]
Comprueba: (1) ninguna ronda falla; (2) toda salida/stop/parcial tiene antes su entrada avisada; (3) todos los correos tienen asunto de la Mesa
y ninguno es de relleno; (4) las oportunidades de los aprendices que prevé el motor del Radar aparecen (entrada o bloqueo con motivo);
(5) el marcador de los aprendices cuenta solo lo que entró. Sale con código 1 si algo falla."""
import argparse, json, os, re, shutil, subprocess, sys, datetime as dt
from zoneinfo import ZoneInfo
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
ap = argparse.ArgumentParser(); ap.add_argument('dias', nargs='+'); ap.add_argument('--inicio'); ap.add_argument('--office', default=os.path.join(ROOT, 'mesa_radar_btc', 'office'))
ap.add_argument('--csv', default='/tmp/bitstamp/data/updates/btcusd_bitstamp_1min_latest.csv'); ap.add_argument('--work', default='/tmp/simular-ronda')
A = ap.parse_args()
if not os.path.exists(A.csv):
    print('Descargando el histórico de 1 min de Bitstamp…', flush=True)
    subprocess.run('rm -rf /tmp/bitstamp && git clone -q --depth 1 --filter=blob:none --sparse https://github.com/ff137/bitstamp-btcusd-minute-data /tmp/bitstamp && git -C /tmp/bitstamp sparse-checkout set data/updates', shell=True, check=True)
    A.csv = '/tmp/bitstamp/data/updates/btcusd_bitstamp_1min_latest.csv'
W = A.work; shutil.rmtree(W, ignore_errors=True); os.makedirs(W + '/db/signals'); shutil.copytree(A.office, W + '/office')
mk = os.path.join(ROOT, 'mesa_radar_btc', 'page', 'mklive_bs.js'); json.dump({}, open(W + '/fund.json', 'w'))
utc = dt.timezone.utc; tz = ZoneInfo('Europe/Madrid')
start = int(dt.datetime.fromisoformat((A.inicio or A.dias[0]) + 'T00:00:00+00:00').timestamp())
env = dict(os.environ, MESA_GO_LIVE=str(start), MESA_V10=str(start), MESA_V12=str(start))
fallos, correos, rondas = [], [], 0
for d in A.dias:
    day = dt.date.fromisoformat(d)
    if day.weekday() >= 5: continue
    for h in range(7, 21):
        for m in (1, 16, 31, 46):
            now = int(dt.datetime(day.year, day.month, day.day, h, m, tzinfo=tz).timestamp()); ms = str(now * 1000)
            subprocess.run(['node', mk, A.csv, ms, '3600', '167', W + '/h.json'], check=True)
            subprocess.run(['node', mk, A.csv, ms, '900', '72', W + '/m15.json'], check=True)
            shutil.rmtree(W + '/out', ignore_errors=True)
            p = subprocess.run(['node', W + '/office/mesa_tick.js', A.csv, W + '/h.json', W + '/db', W + '/out', '', W + '/fund.json', W + '/m15.json'], env=dict(env, MESA_NOW=ms), capture_output=True, text=True)
            rondas += 1; hm = f'{d} {h:02d}:{m:02d}'
            if p.returncode != 0: fallos.append(f'ronda {hm} falló: {p.stderr.strip()[-200:]}'); continue
            for f in os.listdir(W + '/out'):
                if not f.startswith('tick'): shutil.copy(W + '/out/' + f, W + '/db/signals/')
            for ln in p.stdout.splitlines():
                if ln.startswith('EMAIL_JSON'): correos.append((hm, json.loads(ln[len('EMAIL_JSON'):].strip())))
    print(f'{d}: hecho', flush=True)
S = {f[:-5]: json.load(open(W + '/db/signals/' + f)) for f in os.listdir(W + '/db/signals')}
# (2) gestión sin entrada
for k, s in S.items():
    if s.get('type') in ('salida', 'stop', 'parcial') and s.get('real'):
        base = re.sub(r'-(out|stop|tp)-', '-in-', k); base = re.sub(r'(-in-\d+)-\d+$', r'\1', base)
        if base not in S: fallos.append(f'{k}: {s["type"]} sin entrada avisada ({base})')
# (3) correos
for hm, e in correos:
    sub = e.get('subject', '')
    if 'Mesa Radar' not in sub or re.search(r'(?i)placeholder|lorem|\btest\b', sub + e.get('body', '')): fallos.append(f'correo raro {hm}: {sub[:80]}')
# (4) oportunidades de los aprendices esperadas por el motor del Radar (sin datos en vivo: solo Bitstamp)
sys.path.insert(0, W + '/office')
js = f"""const D=require('{W}/office/radar_desk.js'),E=require('{W}/office/engine.js');const r=D.run('{A.csv}','/dev/null',{now});
const AG={{bo:'vega',mr:'paz',swp:'rios'}};console.log(JSON.stringify(r.R.trades.filter(t=>t.extra&&t.side===t.radarSide&&t.ru<0.8&&E.madridWork(t.sigT-1)&&t.sigT>={start}).map(t=>[AG[t.kind||'bo'],new Date(t.sigT*1000).toISOString().slice(0,16).replace(/[-:T]/g,'')])))"""
exp = json.loads(subprocess.run(['node', '-e', js], capture_output=True, text=True).stdout or '[]')
got_in = {k for k in S if k.startswith('radar-') and '-in-' in k}; got_any = {re.sub(r'^radar-(\w+)-.*-(\d{12})$', r'\1-\2', k) for k in S if k.startswith('radar-')}
falta = [f'{a}-{t}' for a, t in exp if f'{a}-{t}' not in got_any]
for x in falta: fallos.append(f'oportunidad del aprendiz {x} prevista por el motor y sin entrada ni bloqueo')
# (5) marcador: el último tick cuenta solo entradas reales
tick = next((json.load(open(W + '/out/' + f)) for f in os.listdir(W + '/out') if f.startswith('tick')), None) if os.path.isdir(W + '/out') else None
if tick:
    n_sc = tick['score']['radar']['n']; n_out = sum(1 for k in S if k.startswith('radar-') and '-out-' in k)
    if n_sc != n_out: fallos.append(f'marcador de aprendices {n_sc} ≠ salidas avisadas {n_out}')
print(f'\n# simular-ronda · {rondas} rondas · {len(correos)} correos · {len(S)} señales')
print(f'- Aprendices: previstas {len(exp)}, entradas {len(got_in)}, bloqueadas {len(exp) - len([1 for a,t in exp if f"radar-{a}-in-{t}" in got_in])}')
for hm, e in correos: print(f'  {hm}  {e["subject"][:110]}')
chk = ['rondas sin fallos', 'gestión con su entrada', 'correos válidos', 'oportunidades del Radar cubiertas', 'marcador cuadra']
print('\n' + ('✅ TODO EN ORDEN' if not fallos else f'‼️ {len(fallos)} FALLOS:\n- ' + '\n- '.join(fallos)))
sys.exit(1 if fallos else 0)

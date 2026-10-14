"""Incrusta en dashboard/index.html el estado de la base de demostración (datos SINTÉTICOS).
Uso:  python -m radar demo   (Ctrl+C)   y luego   python tools/embed_sample.py
"""
import json, os, re, sys, random, time
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from radar import analysis, demo
from radar.config import load_config
from radar.state import build_state
from radar.store import Store

cfg = load_config("config.json")
path = "data/_sample.sqlite"
if os.path.exists(path):
    os.remove(path)
st = Store(path)
now = int(time.time())
demo.populate(st, cfg, random.Random(12), now)
st.set_meta("report", analysis.build_report(st, cfg, now))
state = build_state(st, cfg, now, mode="demo")
for c in state["candidates"]:
    c.pop("links", None) if not c.get("links") else None
html = open("dashboard/index.html", encoding="utf-8").read()
blob = json.dumps(state, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
html = re.sub(r'(<script type="application/json" id="sample">).*?(</script>)', lambda m: m.group(1) + blob + m.group(2), html, flags=re.S)
open("dashboard/index.html", "w", encoding="utf-8").write(html)
st.close(); os.remove(path)
print("ejemplo incrustado:", len(blob) // 1024, "KB; veredicto del análisis sobre datos al azar:", state["report"]["verdict"])

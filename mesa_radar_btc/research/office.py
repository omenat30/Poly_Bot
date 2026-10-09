# Restricción de horario de oficina (Madrid 7:00-20:00): entradas y movimientos del stop solo en horario; stops en el exchange 24 h.
import numpy as np, engine
from engine import H
from zoneinfo import ZoneInfo
import datetime
tz=ZoneInfo('Europe/Madrid')
t=H['t']
# hora local del INICIO de cada vela horaria
loc=np.array([datetime.datetime.fromtimestamp(int(x),tz).hour for x in t])
OFFICE=(loc>=7)&(loc<20)   # una vela que empieza entre 7:00 y 19:00 -> su apertura es una ejecución posible
np.save(engine.D+'office_mask.npy',OFFICE)

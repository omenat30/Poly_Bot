# Paz: estacionalidad (hora del día y día de la semana). Walk-forward: cada año se eligen con los años anteriores.
import numpy as np
from engine import *
t=H['t']; c=H['c']; o=H['o']
r=np.log(H['c']/H['o'])  # retorno de cada hora
hr=(t//3600)%24; dw=((t//86400)+3)%7  # 0=lunes
yr=np.array([1970+int(x//31556952) for x in t])
import datetime
yr=np.array([datetime.datetime.utcfromtimestamp(int(x)).year for x in t[::24]]).repeat(24)[:len(t)]
cost=0.0014
def wf_bucket(key, nb, top=3, side_long_only=False):
    res={}
    for y in range(2019,2027):
        past=(yr>=2017)&(yr<y); now=(yr==y)
        mu=np.array([r[past&(key==b)].mean() for b in range(nb)])
        best=np.argsort(-mu)[:top]
        # cada bucket elegido = una operación de 1 hora (paga coste completo)
        sel=now&np.isin(key,best)
        res[y]=(r[sel].sum()-cost*sel.sum(), sel.sum(), r[now].sum())
    return res
for name,key,nb in [('hora del día',hr,24),('día de la semana',dw,7)]:
    R=wf_bucket(key,nb)
    print(name, {y:(round(a*100,1),n,round(b*100,1)) for y,(a,n,b) in R.items()})
# sin costes (para ver si hay efecto bruto)
def gross(key,nb):
    out=[]
    for y in range(2019,2027):
        past=(yr>=2017)&(yr<y); now=(yr==y)
        mu=np.array([r[past&(key==b)].mean() for b in range(nb)]); best=np.argsort(-mu)[:3]; worst=np.argsort(mu)[:3]
        out.append((y, round(r[now&np.isin(key,best)].mean()*1e4,2), round(r[now&np.isin(key,worst)].mean()*1e4,2), round(r[now].mean()*1e4,2)))
    return out
print('hora: mejores3 / peores3 / media (pb por hora)', gross(hr,24))
print('día:', gross(dw,7))

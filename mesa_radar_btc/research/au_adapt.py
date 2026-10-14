# «Aprender cada día» (Salinas): peso de cada componente = base × factor según su R reciente (solo operaciones cerradas antes de la señal,
# pesos por recencia con vida media H días, encogido hacia 0 con pocas operaciones). 3 variantes cerradas.
import json, math
B=json.load(open('v12g_trades.json')); T=B['trades']
def adapt(H, k, lo, hi):
    out=[]
    for x in T:
        h=[y for y in T if y['src']==x['src'] and y['t1']<=x['t0']]
        ws=[0.5**((x['t0']-y['t1'])/(H*86400)) for y in h]; W=sum(ws)
        m=sum(w*y['r'] for w,y in zip(ws,h))/W if W else 0
        m*=W/(W+5)   # encogimiento: con poca historia reciente el factor tiende a 1
        out.append(dict(x, w=round(x['w']*min(hi,max(lo,1+k*m)),3)))
    return out
for nm,(H,k,lo,hi) in {'L1':(180,1.0,0.25,1.5),'L2':(365,1.0,0.25,1.5),'L3':(90,2.0,0.25,1.5)}.items():
    json.dump(adapt(H,k,lo,hi),open(f'/tmp/au_{nm}.json','w')); print(nm,'ok')

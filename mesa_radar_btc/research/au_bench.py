# Auditoría v12 · H2: «despido automático». Un componente opera solo si sus propias operaciones recientes (cerradas antes de la señal) suman > 0;
# si no, pasa a sombra (sigue registrando) hasta recuperarse. 3 variantes cerradas: últimas 20, últimas 40, últimos 12 meses.
import json, sys
B=json.load(open('v12g_trades.json')); T=B['trades']
def bench(T, rule):
    out=[]
    for x in T:
        hist=sorted([y for y in T if y['src']==x['src'] and y['t1']<=x['t0']], key=lambda y:y['t1'])
        if rule[0]=='n': h=hist[-rule[1]:]
        else: h=[y for y in hist if y['t1']>x['t0']-rule[1]*86400]
        if len(h)<5 or sum(y['r'] for y in h)>0: out.append(x)
    return out
for nm,rule in (('20',('n',20)),('40',('n',40)),('12m',('d',365))):
    C=bench(T,rule); json.dump([dict(c) for c in C],open(f'/tmp/au_bench_{nm}.json','w')); print(nm,len(T),'->',len(C))

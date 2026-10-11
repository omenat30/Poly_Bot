import numpy as np, json
exec(open('audit5.py').read().split('res={}')[0])
V10={'vega':0.75,'ortega':1.0,'paz':0.5,'rios':0.0,'funding':0.0}
Zf=with_fund(stream_full()); L=run_log([z for z in Zf if V10[z[3]]>0],base=V10)
tr={a:[] for a in ['vega','ortega','paz','rios','ferrer']}
for l in L:
    if l['w']>0: tr[l['a']].append([int(l['t0']),round(float(l['r']),3),int(l['s']),round(float(l['w']),3)])
for z in Zf:   # Ríos y Ferrer: sus señales quedan con peso 0 (sombra)
    if z[3] in ('rios','funding'): tr['ferrer' if z[3]=='funding' else 'rios'].append([int(z[0]),round(float(z[2]),3),int(z[4]),0])
R=json.load(open('../live/research.json'))
s=summ(L)
R.update(tr=tr,w={'vega':0.75,'ortega':1,'paz':0.5,'rios':0,'ferrer':0},prev={'nw':2.12,'win':0.40,'exp':0.39,'Ry':27.5,'dd':15.4},wf={k:float(v) for k,v in s.items()})
json.dump(R,open('../live/research.json','w'),separators=(',',':'))
print({k:round(v,2) for k,v in s.items()})

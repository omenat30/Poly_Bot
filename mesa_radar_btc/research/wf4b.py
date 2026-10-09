import pickle, engine
from engine import ts
import wf4, pm
W=wf4.W; C=wf4.C
def chooseAny(ref):
    p=wf4.chooseZ(ref,'nub','solo'); q=wf4.chooseZ(ref,'fund','solo')
    a,b=p['rios'],q['rios']
    p['rios']=max([x for x in (a,b) if x],key=lambda x:x[2]) if (a or b) else None
    return p
sel={y:chooseAny(ts(y)) for y in W.yrs}; pm.sel=sel
for y in W.yrs: print('SEL',y,'rios:',sel[y]['rios'][0] if sel[y]['rios'] else None,'| ferrer:',sel[y]['funding'][0] if sel[y]['funding'] else None)
Z=pm.stream(['vega','ortega','paz','rios','funding'])
d=pm.run(Z,base=wf4.BASE,cap=2.0,ddth=(8,0.5)); print('ANY',' '.join(f'{k}={float(v):.3f}' for k,v in d.items()))
live=chooseAny(W.END+1); print('LIVE',{a:(b[0],{k:round(float(v),3) for k,v in b[1].items()}) if b else None for a,b in live.items()})
# referencia: nub fijo, pick vivo
live2=wf4.chooseZ(W.END+1,'nub','solo'); print('LIVE_NUB',{a:(b[0]) if b else None for a,b in live2.items()})

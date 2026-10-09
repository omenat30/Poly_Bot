import numpy as np, pickle
from engine import *
P=pickle.load(open(D+'desk2.pkl','rb'))
# intervalos de posición (entrada≈sigT, salida=x[4]) por agente
iv={k:[(x[0],x[4],x[1]) for x in T] for k,T in P.items()}
def inpos(k,ts,side,minR=None):
    for a,b,s in iv[k]:
        if a<=ts<b and s==side: return True
    return False
def rep(lab,T):
    for nm,(a,b) in (('TR',TRAIN),('TE',(TEST[0],1e11))):
        r=np.array([x[2] for x in T if a<=x[0]<b]); yrs=(min(b,H['t'][-1])-a)/31557600
        print(f'{lab:34s} {nm} n/sem={len(r)/yrs/52.18:4.2f} win={np.mean(r>0)*100:4.1f}% exp={r.mean():+.3f} t={r.mean()/r.std()*np.sqrt(len(r)):+.2f}',end=' | ')
    print()
for ag in ('paz','rios'):
    T=P[ag]
    rep(ag+' base',T)
    rep(ag+' si Vega dentro',[x for x in T if inpos('vega',x[0],x[1])])
    rep(ag+' si Ortega dentro',[x for x in T if inpos('ortega',x[0],x[1])])
    rep(ag+' si Vega u Ortega',[x for x in T if inpos('vega',x[0],x[1]) or inpos('ortega',x[0],x[1])])
    rep(ag+' si NINGUNO',[x for x in T if not(inpos('vega',x[0],x[1]) or inpos('ortega',x[0],x[1]))])
rep('ortega si Vega dentro',[x for x in P['ortega'] if inpos('vega',x[0],x[1])])
rep('ortega si Vega fuera',[x for x in P['ortega'] if not inpos('vega',x[0],x[1])])

import json, pickle, numpy as np
from paz3 import *
def fam(name, rows, pick):
    return dict(fam=name, variants=len(rows), posTest=sum(1 for _,a,b in rows if b['exp']>0),
        medTest=float(np.median([b['exp'] for _,a,b in rows])),
        train={k:float(pick[1][k]) for k in ('n','exp','t','pf')}, test={k:float(pick[2][k]) for k in ('n','exp','t','pf')})
P=[]
for rl in (35,40,45):
 for reg in (20,50):
  for sh in (0,1):
   for maxh in (24,48,96):
    for tk in (0,3,5):
     for en in (20,50):
      T=paz3(rsi_lo=rl,reg=reg,shorts=sh,maxh=maxh,tk=tk,en=en); P.append(((rl,reg,sh,maxh,tk,en),stats(T,*TRAIN),stats(T,*TEST)))
pk=[r for r in P if r[0]==(45,50,1,96,5,50)][0]
C=[]
for mode in ('cont','fade'):
 for z in (2,2.5,3):
  for kk in (1,3,6):
   for reg in (0,50):
    for rr in (1.5,2.5):
     T=calvo(z=z,kk=kk,reg=reg,rr=rr,mode=mode); C.append(((mode,z,kk,reg,rr),stats(T,*TRAIN),stats(T,*TEST)))
ck=max(C,key=lambda r:r[1]['t'])
old=json.load(open(D+'../live/research.json'))['fam']
out=[f for f in old if f['fam'] in ('vega','ortega2','rios2')]+[fam('paz3',P,pk),fam('calvo',C,ck)]+[f for f in old if f['fam'] in ('ortega','rios','paz')]
json.dump(out,open(D+'families2.json','w'))
for o in out: print(o['fam'],o['variants'],o['posTest'],round(o['medTest'],3),round(o['train']['exp'],3),round(o['test']['exp'],3))
print('calvo pick',ck[0])

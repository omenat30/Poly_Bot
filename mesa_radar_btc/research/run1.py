import sys, pickle, time
from strategies import *
fam=sys.argv[1]; f,G=FAM[fam]; res=[]
t0=time.time()
for p in G:
    T=f(**p); res.append((p,T))
pickle.dump(res,open(D+f'res_{fam}.pkl','wb'))
print(fam,len(G),'variants',round(time.time()-t0),'s')

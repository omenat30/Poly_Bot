from paz3 import *
res=[]
for n in (0,20,100,200):
 for rl in (40,45):
  for sh in (0,1):
   for tk in (3,5):
    for mh in (48,96):
     T=paz3(rsi_lo=rl,reg=50,n=n,shorts=sh,maxh=mh,tk=tk,en=50)
     a,b=rep(f'paz3 n={n} rl={rl} sh={sh} tk={tk} mh={mh}',T); print('     dd TR',round(a['dd'],1),'TE',round(b['dd'],1))

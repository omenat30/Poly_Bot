from wf_sel2 import *
import json
S2={}
for y in range(2020,2027):
    p,W=choose2(ts(y),'Ry',0,1.0,FW); S2[y]={a:(p[a][0] if p[a] else None,W[a]) for a in AG}
    print(y,{a:(S2[y][a][0][1:] if S2[y][a][0] else None) for a in AG})
d=desk(yrs,lambda y:S2[y]); print({k:v for k,v in d.items()})
tr={a:[] for a in AG}
for y in yrs:
    for a,(k,w) in S2[y].items():
        if k is None: continue
        tr[a]+=[[int(x[0]),round(float(x[2]),2),int(x[1])] for x in C[k] if ts(y)<=x[0]<ts(y+1)]
v3={'nw':1.715,'win':0.414,'exp':0.400,'Ry':22.3,'dd':17.6}
R=json.load(open('../live/research.json'))
R.update(start=ts(2020),split=ts(2020),end=END,tr=tr,w=FW,prev=v3,wf={k:(float(v) if not isinstance(v,dict) else v) for k,v in d.items() if k!='Y'},sel={str(y):{a:(list(S2[y][a][0][1:]) if S2[y][a][0] else None) for a in AG} for y in yrs})
json.dump(R,open('../live/research.json','w'),separators=(',',':'),default=float)

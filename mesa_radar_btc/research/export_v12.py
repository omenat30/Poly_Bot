import json, numpy as np, math
exec(open('v12_eval2.py').read().split("for a in V10:")[0])
# v12g: Vega propia a sombra, Ortega 1R, Paz 0,5R; aprendices del Radar 1R (a favor del Radar, ru<0,8, horario de oficina)
W12={'vega':0.0,'ortega':1.0,'paz':0.5}
Zf=with_fund(stream_full())
AG={'bo':'vega','mr':'paz','swp':'rios'}
items=[(int(z[0]),int(z[1]),float(z[2]),W12[z[3]],z[3],int(z[4])) for z in Zf if z[3] in W12 and W12[z[3]]>0]
items+=[(int(x['sigT']),int(x['exitT']),float(x['rn']),1.0,AG[x.get('kind','bo')],int(x['side'])) for x in EXf]
a,b=ts(2020),END
Z=sorted([z for z in items if a<=z[0]<b]); open_=[]; eq=0; pk=0; tk=[]
for t0,t1,r,w,src,sd in Z:
    for o in sorted([o for o in open_ if o[1]<=t0],key=lambda o:o[1]): eq+=o[2]*o[3]; pk=max(pk,eq); open_.remove(o)
    if pk-eq>8: w*=0.5
    room=2.0-sum(o[3] for o in open_)
    if w>room: w=room
    if w<0.2: continue
    open_.append((t0,t1,r,w)); tk.append((t0,t1,r,w,src,sd))
tr={k:[] for k in ['vega','ortega','paz','rios','ferrer']}
for t0,t1,r,w,src,sd in tk: tr[src].append([t0,round(r,3),sd,round(w,3)])
for z in Zf:
    if z[3] in ('vega','rios','funding') and a<=z[0]<b: tr['ferrer' if z[3]=='funding' else z[3]].append([int(z[0]),round(float(z[2]),3),int(z[4]),0])
for k in tr: tr[k].sort()
yrs=(b-a)/31557600; r=np.array([x[2] for x in tk]); wr=np.array([x[2]*x[3] for x in tk]); o=np.argsort([x[1] for x in tk]); cum=np.cumsum(wr[o]); dd=float((np.maximum.accumulate(np.r_[0,cum])[1:]-cum).max())
wf=dict(n=len(tk),nw=len(tk)/yrs/52.18,win=float((r>0).mean()),exp=float(r.mean()),wexp=float(wr.mean()),Ry=float(wr.sum()/yrs),tot=float(wr.sum()),dd=dd,RyDD=float(wr.sum()/yrs/dd))
R=json.load(open('../live/research.json'))
R.update(tr=tr,w={'vega':1,'ortega':1,'paz':0.5,'rios':1,'ferrer':0},prev={'nw':1.97,'win':0.40,'exp':0.39,'Ry':20.2,'dd':12.4},wf=wf)
json.dump(R,open('../live/research.json','w'),separators=(',',':'))
print({k:round(v,3) for k,v in wf.items()}); print({k:len(v) for k,v in tr.items()}, {k:sum(1 for x in v if x[3]>0) for k,v in tr.items()})
print({y:round(sum(x[2]*x[3] for x in tk if ts(y)<=x[0]<ts(y+1)),1) for y in range(2020,2027)})

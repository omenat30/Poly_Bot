import json, numpy as np, engine, math, io, contextlib
from engine import ts
with contextlib.redirect_stdout(io.StringIO()):
    exec(open('audit5.py').read().split('res={}')[0])
exec(open('mx_eval.py').read().split("E=[x for x")[0].replace("import json, numpy as np, engine, math",""))
V10={'vega':0.75,'ortega':1.0,'paz':0.5}
Zm=[z for z in with_fund(stream_full()) if z[3] in V10]
mesa=[(z[0],z[1],z[2],V10[z[3]],z[3]) for z in Zm]
EX=[x for x in X if x['extra'] and x['office'] and x['side']==x['radarSide']]
def port(trades,a,b):
    Z=sorted([z for z in trades if a<=z[0]<b]); open_=[]; eq=0; pk=0; tk=[]
    for t0,t1,r,w,src in Z:
        for o in sorted([o for o in open_ if o[1]<=t0],key=lambda o:o[1]): eq+=o[2]*o[3]; pk=max(pk,eq); open_.remove(o)
        if pk-eq>8: w*=0.5
        room=2.0-sum(o[3] for o in open_)
        if w>room: w=room
        if w<0.2: continue
        open_.append((t0,t1,r,w)); tk.append((t0,t1,r,w,src))
    yrs=(min(b,END)-a)/31557600; r=np.array([x[2] for x in tk]); wr=np.array([x[2]*x[3] for x in tk]); o=np.argsort([x[1] for x in tk]); cum=np.cumsum(wr[o]); dd=(np.maximum.accumulate(np.r_[0,cum])[1:]-cum).max()
    d0=a//86400; v=np.zeros(min(b,END)//86400-d0+1)
    for x in tk: v[min(len(v)-1,x[1]//86400-d0)]+=x[2]*x[3]
    py={y:round(sum(x[2]*x[3] for x in tk if ts(y)<=x[0]<ts(y+1)),1) for y in range(2020,2027)}
    return dict(sem=len(tk)/yrs/52.18,win=float((r>0).mean()),Rop=float(r.mean()),cop=float(wr.mean()),Ry=float(wr.sum()/yrs),dd=float(dd),SR=float(v.mean()/v.std()*math.sqrt(365)),py=py)
CF={'v10':mesa}
for w in (0.5,1.0): CF[f'v12 extras a favor {w}R']=mesa+[(int(x['sigT']),int(x['exitT']),x['rn'],w,'aprendiz') for x in EX]
for per,(a,b) in [('2018-21',(ts(2018),ts(2022))),('2022-26',(ts(2022),END)),('2020-26',(ts(2020),END))]:
    print('=====',per)
    for k,v in CF.items():
        s=port(v,a,b); print(f'{k:26s} n/sem={s["sem"]:.2f} win={s["win"]:.3f} R/op={s["Rop"]:+.3f} cart/op={s["cop"]:+.3f} R/año={s["Ry"]:+.1f} caída={s["dd"]:.1f} Sharpe={s["SR"]:.2f}', s['py'] if per=='2020-26' else '')

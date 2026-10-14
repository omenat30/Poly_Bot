# Auditoría v12: aportación marginal de cada componente (cartera sin él frente a la cartera completa), con el port() del juez.
import json, math, datetime as dt, sys
sys.argv=['x','/dev/null']
B=json.load(open('v12g_trades.json')); END=B['end']; T=B['trades']
ts=lambda y:int(dt.datetime(y,1,1,tzinfo=dt.timezone.utc).timestamp())
def port(items,a,b):
    Z=sorted([z for z in items if a<=z['t0']<b],key=lambda z:z['t0']); op=[]; eq=pk=0; tk=[]
    for z in Z:
        for o in sorted([o for o in op if o['t1']<=z['t0']],key=lambda o:o['t1']): eq+=o['r']*o['wt']; pk=max(pk,eq); op.remove(o)
        w=z['w']*(0.5 if pk-eq>8 else 1); w=min(w,2-sum(o['wt'] for o in op))
        if w<0.2: continue
        y=dict(z,wt=w); op.append(y); tk.append(y)
    return tk
def st(tk,a,b):
    yrs=(min(b,END)-a)/31557600; r=[x['r'] for x in tk]; wr=[x['r']*x['wt'] for x in tk]
    d0=a//86400; v=[0.0]*(min(b,END)//86400-d0+1)
    for x,q in zip(tk,wr): v[min(len(v)-1,x['t1']//86400-d0)]+=q
    m=sum(v)/len(v); sd=math.sqrt(sum((q-m)**2 for q in v)/len(v))
    cum=pk=dd=0
    for x,q in sorted(zip(tk,wr),key=lambda p:p[0]['t1']): cum+=q; pk=max(pk,cum); dd=max(dd,pk-cum)
    return f"ops/sem {len(r)/yrs/52.18:.2f} win {sum(q>0 for q in r)/len(r)*100:4.1f}% R/op {sum(r)/len(r):+.3f} cart {sum(wr)/len(wr):+.3f} R/año {sum(wr)/yrs:+5.1f} Sh {m/sd*math.sqrt(365):.2f} dd {dd:4.1f}"
srcs=sorted({x['src'] for x in T})
for nm,(a,b) in (('18-21',(ts(2018),ts(2022))),('22-26',(ts(2022),END))):
    print('=====',nm); print(f"{'completa':16s}",st(port(T,a,b),a,b))
    for s in srcs: print(f"{'sin '+s:16s}",st(port([x for x in T if x['src']!=s],a,b),a,b))
    for s in srcs: print(f"{'solo '+s:16s}",st(port([x for x in T if x['src']==s],a,b),a,b))

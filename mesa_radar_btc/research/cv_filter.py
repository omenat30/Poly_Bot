# El modelo de velas como filtro de la mesa v12g: veta una entrada si el R previsto para ese sentido, en su marco, es menor que un umbral.
import numpy as np, pickle, math
exec(open('v12_eval2.py').read().split("for a in V10:")[0])
W12={'vega':0.0,'ortega':1.0,'paz':0.5}; Zf=with_fund(stream_full()); AG={'bo':'vega','mr':'paz','swp':'rios'}
own=[(int(z[0]),int(z[1]),float(z[2]),W12[z[3]],z[3],int(z[4]),'1h') for z in Zf if z[3] in W12 and W12[z[3]]>0]
apr=[(int(x['sigT']),int(x['exitT']),float(x['rn']),1.0,'ap_'+AG[x.get('kind','bo')],int(x['side']),'15m') for x in EXf]
PR={}
for tf in ('15m','1h','4h'):
    Z=np.load(engine.D+f'cv_{tf}.npz'); PR[tf]=(Z['T'],pickle.load(open(engine.D+f'cv_pred_{tf}.pkl','rb')))
def pred(T0,s,tf):
    T,P=PR[tf]; i=np.searchsorted(T,T0,side='right')-1   # última vela cerrada en el momento de la señal
    return P[s][i] if i>=0 else np.nan
def run(items,a,b):
    Z=sorted([z for z in items if a<=z[0]<b]); open_=[]; eq=0; pk=0; tk=[]
    for t0,t1,r,w,src,sd,tf in Z:
        for o in sorted([o for o in open_ if o[1]<=t0],key=lambda o:o[1]): eq+=o[2]*o[3]; pk=max(pk,eq); open_.remove(o)
        if pk-eq>8: w*=0.5
        room=2.0-sum(o[3] for o in open_); w=min(w,room)
        if w<0.2: continue
        open_.append((t0,t1,r,w)); tk.append((t0,t1,r,w))
    yrs=(min(b,END)-a)/31557600; r=np.array([x[2] for x in tk]); wr=np.array([x[2]*x[3] for x in tk]); o=np.argsort([x[1] for x in tk]); cum=np.cumsum(wr[o]); dd=(np.maximum.accumulate(np.r_[0,cum])[1:]-cum).max()
    d0=a//86400; v=np.zeros(min(b,END)//86400-d0+1)
    for x in tk: v[min(len(v)-1,x[1]//86400-d0)]+=x[2]*x[3]
    return f'n/sem={len(tk)/yrs/52.18:.2f} win={(r>0).mean():.3f} R/op={r.mean():+.3f} cart/op={wr.mean():+.3f} R/año={wr.sum()/yrs:+.1f} caída={dd:.1f} Sharpe={v.mean()/v.std()*math.sqrt(365):.2f}'
base=own+apr
print('v12g sin filtro | 18-21',run(base,ts(2018),ts(2022)),'| 22-26',run(base,ts(2022),END),flush=True)
for scope in ('todas','solo propias','solo aprendices'):
  sel=lambda z: scope=='todas' or (scope=='solo propias')==(z[6]=='1h')
  for tfp in ('1h','4h','15m'):
    pv=np.array([pred(z[0],z[5],tfp) for z in base if sel(z) and ts(2018)<=z[0]<ts(2022)])
    for q in (0.1,0.25,0.4):
        thr=np.nanquantile(pv,q)
        it=[z for z in base if not (sel(z) and pred(z[0],z[5],tfp)<thr)]
        print(f'{scope:15s} velas {tfp:3s} veta el {int(q*100)}% peor | 18-21 {run(it,ts(2018),ts(2022))} | 22-26 {run(it,ts(2022),END)}',flush=True)

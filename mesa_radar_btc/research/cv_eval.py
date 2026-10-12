import numpy as np, pickle, datetime as dt, math
D='/tmp/claude-0/-home-user-Poly-Bot/62062f9b-9ffe-50c1-8835-98e9f5ba9b0f/scratchpad/research/'
ts=lambda y: int(dt.datetime(y,1,1,tzinfo=dt.timezone.utc).timestamp()); END=1791514800
def trades(tf,thr):
    Z=dict(np.load(D+f'cv_{tf}.npz')); P=pickle.load(open(D+f'cv_pred_{tf}.pkl','rb')); T=Z['T']; sec=int(Z['sec'])
    pl,ps=P[1],P[-1]; out=[]; busy=-1
    for i in np.where(Z['office']&np.isfinite(pl)&((pl>thr)|(ps>thr)))[0]:
        if i<=busy: continue
        s=1 if pl[i]>=ps[i] else -1; r=Z['rl' if s==1 else 'rs'][i]; ex=Z['exl' if s==1 else 'exs'][i]
        if not np.isfinite(r) or ex<0: continue
        out.append((int(T[i]),int(Z['t'][ex]+sec),float(r),s)); busy=ex
    return out
def st(tk,a,b):
    tk=[x for x in tk if a<=x[0]<b]; yrs=(min(b,END)-a)/31557600
    if len(tk)<5: return 'n<5'
    r=np.array([x[2] for x in tk]); d0=a//86400; v=np.zeros(min(b,END)//86400-d0+1)
    for x in tk: v[min(len(v)-1,x[1]//86400-d0)]+=x[2]
    return f'n/sem={len(r)/yrs/52.18:5.2f} win={np.mean(r>0):.3f} R/op={r.mean():+.3f} R/año={r.sum()/yrs:+6.1f} Sharpe={v.mean()/v.std()*math.sqrt(365):+.2f}'
if __name__=='__main__':
    for tf in ('4h','1h','15m'):
        for thr in (-9,0,0.05,0.1,0.2,0.3):
            tk=trades(tf,thr); print(f'{tf:3s} thr={thr:+.2f} | 18-21: {st(tk,ts(2018),ts(2022))} | 22-26: {st(tk,ts(2022),END)}')

import pickle, json, numpy as np, engine
d=pickle.load(open(engine.D+'ml_res.pkl','rb'))
rows=[]
for (t0,t1,r,a,s),x,q in zip(d['rows'],d['X'],d['Q']):
    rows.append([int(t0),int(t1),'ferrer' if a=='funding' else a,int(s),round(float(r),4),[round(float(v),5) for v in x],None if q!=q else round(float(q),4)])
Q=np.array([np.nan if r[6] is None else r[6] for r in rows]); R=np.array([r[4] for r in rows]); ok=np.isfinite(Q)
idx=np.where(ok)[0][-200:]; b=idx[Q[idx]<0.25]; o=idx[Q[idx]>=0.25]
diff=R[o].mean()-R[b].mean(); se=np.sqrt(R[o].var(ddof=1)/len(o)+R[b].var(ddof=1)/len(b))
print('ultimas 200: bajo p25 n',len(b),'R',R[b].mean().round(3),'resto',R[o].mean().round(3),'dif',diff.round(3),'t',(diff/se).round(2))
json.dump(dict(names=d['names'],rows=rows,cutoff=int(max(r[1] for r in rows))),open(engine.D+'../live/office/ml_hist.json','w'),separators=(',',':'))
print(len(rows), __import__('os').path.getsize(engine.D+'../live/office/ml_hist.json'))

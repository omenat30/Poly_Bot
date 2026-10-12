# Walk-forward anual: LightGBM predice el R de la operación fija en cada sentido con los años anteriores (desde 2016); predice el año siguiente.
import numpy as np, lightgbm as lgb, datetime as dt, sys, pickle
D='/tmp/claude-0/-home-user-Poly-Bot/62062f9b-9ffe-50c1-8835-98e9f5ba9b0f/scratchpad/research/'
ts=lambda y: int(dt.datetime(y,1,1,tzinfo=dt.timezone.utc).timestamp())
P=dict(objective='regression',learning_rate=0.03,num_leaves=15,min_data_in_leaf=400,feature_fraction=0.7,bagging_fraction=0.7,bagging_freq=1,lambda_l2=10,verbose=-1,num_threads=4)
out={}
for tf in sys.argv[1:]:
    Z=np.load(D+f'cv_{tf}.npz'); X,T=Z['X'],Z['T']; pred={1:np.full(len(T),np.nan),-1:np.full(len(T),np.nan)}
    for y in range(2018,2027):
        lo,hi=ts(y),ts(y+1)
        for s,key,exk in ((1,'rl','exl'),(-1,'rs','exs')):
            r=Z[key]; ex=Z[exk]
            # entrenamiento: solo operaciones ya cerradas antes del 1 de enero del año que se predice (sin solape de etiquetas)
            exT=np.where(ex>=0,Z['t'][np.maximum(ex,0)]+int(Z['sec']),np.iinfo(np.int64).max)
            tr=(T>=ts(2016)+30*86400)&(exT<lo)&np.isfinite(r)
            w=0.5**((lo-T[tr])/(2*31557600))   # más peso a lo reciente (vida media 2 años)
            m=lgb.train(P,lgb.Dataset(X[tr],np.clip(r[tr],-2,2),weight=w),num_boost_round=250)
            te=(T>=lo)&(T<hi); pred[s][te]=m.predict(X[te])
        print(tf,y,'listo',flush=True)
    out[tf]=pred
    pickle.dump(pred,open(D+f'cv_pred_{tf}.pkl','wb'))

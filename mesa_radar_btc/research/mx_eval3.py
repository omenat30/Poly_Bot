exec(open('mx_eval.py').read().split("E=[x for x")[0])
M=dict(np.load(engine.D+'m15.npz')); mt=M['t']; mc=M['c']
RAD=[x for x in X if not x['extra']]; ra=np.array([x['sigT'] for x in RAD])
def radar_open_at(T):
    k=np.searchsorted(ra,T,side='right')-1
    while k>=0:
        x=RAD[k]
        if x['sigT']<=T<x['exitT']: return x
        k-=1
        if k>=0 and T-RAD[k]['sigT']>4*86400: break
    return None
E=[x for x in X if x['extra'] and x['office'] and x['side']==x['radarSide']]
for x in E:
    ro=radar_open_at(x['sigT']); j=np.searchsorted(mt,x['sigT']-900,side='right')-1
    x['ru']=(mc[j]-ro['entry'])*ro['side']/ro['risk'] if ro else np.nan
for lab,f in [('Radar va perdiendo (<0R)',lambda x:x['ru']<0),('Radar 0 a +0,8R',lambda x:0<=x['ru']<0.8),('Radar ≥ +0,8R',lambda x:x['ru']>=0.8),('Radar ≥ 0R',lambda x:x['ru']>=0)]:
    sel=[x for x in E if x['ru']==x['ru'] and f(x)]
    print(f'{lab:26s}','18-21',st(sel,ts(2018),ts(2022)),'| 22-26',st(sel,ts(2022),END))
json.dump([dict(sigT=x['sigT'],ru=x['ru']) for x in E],open(engine.D+'mx_ru.json','w'),default=float)

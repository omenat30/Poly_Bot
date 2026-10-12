import pickle, numpy as np, engine
from engine import ts
R=pickle.load(open(engine.D+'rl_rows.pkl','rb'))
def rm(x): return x['r']-0.0006/x['risk_f']-(0.0003/x['risk_f'] if x['reason']=='stop' else 0)   # costes de la Mesa (0,14% + 0,03% en stops)
for x in R: x['rm']=rm(x)
def show(lab, key):
    for per,(a,b) in [('17-21',(ts(2017),ts(2022))),('22-26',(ts(2022),ts(2027)))]:
        g={}
        for x in R:
            if a<=x['T']<b and x['office']: g.setdefault(key(x),[]).append(x['rm'])
        print(lab,per,' | '.join(f'{k}: n={len(v)} w={np.mean(np.array(v)>0):.2f} e={np.mean(v):+.2f}' for k,v in sorted(g.items(),key=lambda kv:str(kv[0]))))
show('tipo',lambda x:x['kind']); show('grado',lambda x:x['grade'])
show('Vega',lambda x:int(x['f']['vega'])); show('Ortega',lambda x:int(x['f']['ortega'])); show('Paz',lambda x:int(x['f']['paz']))
show('tendencia(V+O)',lambda x:int(np.sign(x['f']['vega']+x['f']['ortega'])))
show('SMA200',lambda x:int(x['f']['sma200'])); show('Nub+lado',lambda x:(int(x['f']['nub']),x['s']))
show('funding',lambda x:'a favor' if x['f']['fund']<-0.5 else 'en contra' if x['f']['fund']>0.5 else 'neutro')
show('hora',lambda x:'07-11' if x['hour']<9 else '11-15' if x['hour']<13 else '15-19' if x['hour']<17 else '19-21')
show('lado',lambda x:x['s']); show('riesgo%',lambda x:'<0,8' if x['f']['risk']<0.8 else '<1,5' if x['f']['risk']<1.5 else '>=1,5')
show('volrel',lambda x:'baja' if x['f']['volrel']<-0.2 else 'alta' if x['f']['volrel']>0.2 else 'media')

import numpy as np, pickle, engine
from engine import H, ts
Z=np.load(engine.D+'funding_h.npz'); F3=Z['F3']; FH=Z['FH']
idx={int(x):i for i,x in enumerate(H['t'])}
C=pickle.load(open(engine.D+'wf3_cands.pkl','rb'))
K={'vega':('vega',50,2,'B1',None),'ortega':('ortega',5,2,'B1',None),'paz':('paz',40,2,'B1',0,'nub')}
def bucket(f,s):
    g=f*s*100   # funding "a favor de la multitud" en mi dirección: positivo = mi lado paga (multitud conmigo)
    return 'muy en contra(<-0.005)' if g<-0.005 else 'neutro(-0.005..0.01)' if g<0.01 else 'multitud conmigo(0.01..0.03)' if g<0.03 else 'muy cargado(>0.03)'
B=['muy en contra(<-0.005)','neutro(-0.005..0.01)','multitud conmigo(0.01..0.03)','muy cargado(>0.03)']
allr={}
for a,k in K.items():
    T=[x for x in C[k] if x[0]>=ts(2020)]
    print('==',a)
    for b in B:
        line=[]
        for lab,(lo,hi) in (('20-22',(ts(2020),ts(2023))),('23-26',(ts(2023),1e11))):
            r=np.array([x[2] for x in T if lo<=x[0]<hi and F3[idx[int(x[0])-3600]]==F3[idx[int(x[0])-3600]] and bucket(F3[idx[int(x[0])-3600]],x[1])==b])
            allr.setdefault((b,lab),[]).extend(r.tolist())
            line.append(f'{lab} n={len(r):3d} w={np.mean(r>0)*100 if len(r) else 0:3.0f}% e={r.mean() if len(r) else 0:+.2f}')
        print(f'  {b:30s}',' | '.join(line))
print('== mesa (V+O+P)')
for b in B: print(f'  {b:30s}',' | '.join(f'{lab} n={len(allr[(b,lab)]):3d} w={np.mean(np.array(allr[(b,lab)])>0)*100:3.0f}% e={np.mean(allr[(b,lab)]):+.2f}' for lab in ('20-22','23-26')))

import numpy as np, engine, strategies as S
from engine import *
M=np.load(D+'office_mask.npy')
orig=engine.sim
def patched(sigs, trail=None, exit_mask=None): return engine.sim_office(sigs, trail, exit_mask, M)
for name,(f,p) in {'vega':(S.vega,dict(n=20,k=3.5,shorts=0,mom=1)),'ortega2':(S.ortega2,dict(N=5,k=2,shorts=0,reg=0)),'rios2':(S.rios2,dict(q=0.2,vm=1.0,k=4,reg=50,shorts=0))}.items():
    S.sim=orig; A=f(**p); S.sim=patched; B=f(**p); S.sim=orig
    print(f'{name:8s} 24h   TRAIN',fmt(stats(A,*TRAIN)),'| TEST',fmt(stats(A,*TEST)))
    print(f'{name:8s} 7-20h TRAIN',fmt(stats(B,*TRAIN)),'| TEST',fmt(stats(B,*TEST)))

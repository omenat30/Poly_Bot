import numpy as np
def load():
    a=np.fromfile('../../mesa_radar_audit/min.bin',dtype=np.float64).reshape(-1,6)
    return a
def resample(a, sec):
    k=(a[:,0]//sec*sec).astype(np.int64)
    b=np.r_[0, np.flatnonzero(np.diff(k))+1]
    t=k[b]; o=a[b,1]
    h=np.maximum.reduceat(a[:,2],b); l=np.minimum.reduceat(a[:,3],b)
    e=np.r_[b[1:]-1, len(a)-1]; c=a[e,4]; v=np.add.reduceat(a[:,5],b)
    return dict(t=t,o=o,h=h,l=l,c=c,v=v)
if __name__=='__main__':
    a=load()
    for name,sec in [('h1',3600),('d1',86400),('m15',900)]:
        B=resample(a,sec); np.savez('./'+name+'.npz',**B); print(name,len(B['t']))
    # gap check on h1
    B=np.load('./h1.npz'); d=np.diff(B['t']); print('h1 gaps>1h',(d>3600).sum(),'max gap h',d.max()/3600)

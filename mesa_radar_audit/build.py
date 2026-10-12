import gzip, numpy as np, sys
start=1451606400
rows=[]
def load(f, op):
    with op(f,'rt') as fh:
        next(fh)
        for line in fh:
            t=int(line[:10])
            if t<start: continue
            rows.append(line)
load('data/r/data/historical/btcusd_bitstamp_1min_2012-2025.csv.gz', gzip.open)
load('data/r/data/updates/btcusd_bitstamp_1min_latest.csv', open)
a=np.loadtxt(rows, delimiter=',', dtype=np.float64)
a=a[np.argsort(a[:,0],kind='stable')]
_,idx=np.unique(a[:,0],return_index=True); a=a[idx]
a.astype(np.float64).tofile('min.bin'); print(a.shape, a[0,0], a[-1,0])

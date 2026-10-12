import math
def norm_cdf(x): return 0.5*(1+math.erf(x/math.sqrt(2)))
def norm_ppf(p):
    lo,hi=-10,10
    for _ in range(100):
        m=(lo+hi)/2
        if norm_cdf(m)<p: lo=m
        else: hi=m
    return (lo+hi)/2

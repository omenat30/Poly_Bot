# test helper: fake OpenMarket HOUR response built from Bitstamp minutes up to NOW (includes the bar in progress)
import sys, json, csv
src, now, out = sys.argv[1], int(sys.argv[2]), sys.argv[3]
B = {}
with open(src) as f:
    next(f)
    for line in f:
        a = line.split(','); t = int(float(a[0]))
        if t < now - 170 * 3600 or t + 60 > now: continue
        o, h, l, c, v = map(float, a[1:6]); k = t // 3600 * 3600
        if k not in B: B[k] = [o, h, l, c, v]
        else: b = B[k]; b[1] = max(b[1], h); b[2] = min(b[2], l); b[3] = c; b[4] += v
rows = [[k * 1000, b[0] + 20, b[1] + 20, b[2] + 20, b[3] + 20, b[4] * 110] for k, b in sorted(B.items())]
json.dump({'data': {'series': [{'columns': ['t', 'open', 'high', 'low', 'close', 'volume'], 'rows': rows}]}}, open(out, 'w'))
print(len(rows))

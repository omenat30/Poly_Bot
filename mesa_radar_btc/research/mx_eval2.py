exec(open('mx_eval.py').read().split("E=[x for x")[0])
E=[x for x in X if x['extra'] and x['office'] and x['side']==x['radarSide']]
for lab,sel in [('a favor, bo',[x for x in E if x['kind']=='bo'])]+[(f'a favor, grado {g}',[x for x in E if x['grade']==g]) for g in 'ABC']:
    print(f'{lab:20s}','18-21',st(sel,ts(2018),ts(2022)),'| 22-26',st(sel,ts(2022),END))
# estado del Radar (todas sus operaciones, 24 h) en el momento de cada entrada propia de la v10
RAD=[x for x in X if not x['extra']]
ra=np.array([x['sigT'] for x in RAD]); rb=np.array([x['exitT'] for x in RAD]); rs=np.array([x['side'] for x in RAD])
def radar_pos(T):
    k=np.searchsorted(ra,T,side='right')-1
    return int(rs[k]) if k>=0 and T<rb[k] else 0
def radar_last(T,hrs=24):
    k=np.searchsorted(ra,T,side='right')-1
    return int(rs[k]) if k>=0 and T-ra[k]<=hrs*3600 else 0
import io,contextlib
with contextlib.redirect_stdout(io.StringIO()):
    exec(open('audit5.py').read().split('res={}')[0])
Zf=with_fund(stream_full())
for a in ('vega','ortega','paz'):
    for lab,fn in (('pos',radar_pos),('últ24h',radar_last)):
        out=[]
        for per,(lo,hi) in (('18-21',(ts(2018),ts(2022))),('22-26',(ts(2022),END))):
            g={}
            for z in Zf:
                if z[3]==a and lo<=z[0]<hi: g.setdefault(fn(z[0])*z[4],[]).append(z[2])
            out.append(per+' '+' '.join(f'{k:+d}:n={len(v)} w={np.mean(np.array(v)>0):.2f} e={np.mean(v):+.2f}' for k,v in sorted(g.items())))
        print(a,lab,' | '.join(out))

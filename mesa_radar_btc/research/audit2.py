import numpy as np, json, itertools
from audit_base import *
from engine import DD
Z=stream_full(); L=run_log(Z); S=summ(L); out={'base':S}
c=H['c']; t=H['t']
A14=engine.atr(H,14); S200=engine.sma(c,4800); S50=engine.sma(c,1200)
def idx(t0): return np.searchsorted(t,t0)-1
volr=A14/c; 
def vol_rank(i): w=volr[max(0,i-8760):i]; return (w<volr[i]).mean()
def regime(i):
    if not np.isfinite(S200[i]): return 'x'
    if c[i]>S200[i] and S50[i]>S200[i]: return 'alcista'
    if c[i]<S200[i] and S50[i]<S200[i]: return 'bajista'
    return 'transicion'
def stat(r):
    r=np.array(r); 
    return dict(n=len(r), win=round(float(np.mean(r>0)),2) if len(r) else None, exp=round(float(r.mean()),3) if len(r) else None, tot=round(float(r.sum()),1))
# A) Paz (y todos) por régimen, volatilidad, lado
reg={}
for a in AGS:
    rows=[(regime(idx(z[0])), 'alta' if vol_rank(idx(z[0]))>0.5 else 'baja', 'largo' if z[4]==1 else 'corto', z[2], z[7]) for z in Z if z[3]==a]
    reg[a]={'regimen':{g:stat([x[3] for x in rows if x[0]==g]) for g in ('alcista','transicion','bajista')},
            'vol':{g:stat([x[3] for x in rows if x[1]==g]) for g in ('alta','baja')},
            'lado':{g:stat([x[3] for x in rows if x[2]==g]) for g in ('largo','corto')},
            'salida':{g:stat([x[3] for x in rows if x[4]==g]) for g in set(x[4] for x in rows)}}
    r=np.sort(np.array([x[3] for x in rows]))[::-1]
    if len(r): reg[a]['dependencia_ganadoras']={'top5pct_R':round(float(r[:max(1,len(r)//20)].sum()),1),'resto_exp':round(float(r[max(1,len(r)//20):].mean()),3),'top10_R':round(float(r[:10].sum()),1),'total':round(float(r.sum()),1),'sin_top10_exp':round(float(r[10:].mean()),3)}
out['regimenes']=reg
# B) ablación con el mismo gestor
abl={}
for a in AGS:
    s=summ(run_log([z for z in Z if z[3]!=a])); abl['sin_'+a]={k:round(v,2) for k,v in s.items()}
    s=summ(run_log([z for z in Z if z[3]==a])); abl['solo_'+a]={k:round(v,2) for k,v in s.items()}
out['ablacion']=abl
# C) correlación diaria y semanal de R por agente (sin ponderar) y pérdidas simultáneas
d0=ts(2020)//86400; nd=END//86400+1-d0; M=np.zeros((len(AGS),nd))
for z in Z: M[AGS.index(z[3]), min(nd-1,z[1]//86400-d0)]+=z[2]
cd=np.corrcoef(M); W_=M[:,:nd//7*7].reshape(len(AGS),-1,7).sum(2); cw=np.corrcoef(W_)
out['corr_diaria']={AGS[i]:{AGS[j]:round(float(cd[i,j]),2) for j in range(len(AGS))} for i in range(len(AGS))}
out['corr_semanal']={AGS[i]:{AGS[j]:round(float(cw[i,j]),2) for j in range(len(AGS))} for i in range(len(AGS))}
# solapamiento de posiciones: % del tiempo en posición de cada par y mismo lado
def busy_mask(a):
    m=np.zeros(len(t),bool); sd=np.zeros(len(t),np.int8)
    for z in Z:
        if z[3]!=a: continue
        i0,i1=np.searchsorted(t,z[0]),np.searchsorted(t,z[1]); m[i0:i1]=True; sd[i0:i1]=z[4]
    return m,sd
BM={a:busy_mask(a) for a in AGS}; sel_=t>=ts(2020)
ov={}
for a,b in itertools.combinations(AGS,2):
    both=BM[a][0]&BM[b][0]&sel_; ov[a+'-'+b]=dict(horas_juntos=int(both.sum()), mismo_lado=round(float((BM[a][1][both]==BM[b][1][both]).mean()),2) if both.sum() else None)
out['solapes']=ov
wk_loss=(W_<0).sum(0); out['semanas_con_perdida_simultanea']={k:int((wk_loss>=k).sum()) for k in (2,3,4)}; out['semanas']=int(W_.shape[1])
# D) Nubarrones: misma selección anual, cambiando el veto por la versión sin filtro (None)
def swap(sel, mode):
    s2={}
    for y,p in sel.items():
        s2[y]=dict(p)
        for a in ('paz','rios'):
            b=p.get(a)
            if b and b[0][-1]=='nub':
                k=b[0][:-1]+(mode,)
                if k in C: s2[y][a]=(k,)+tuple(b[1:])
    return s2
for mode in (None,'na'):
    Zs=stream_full(swap(SEL,mode)); s=summ(run_log(Zs)); out['nub_'+str(mode)]={k:round(v,2) for k,v in s.items()}
    out['nub_'+str(mode)+'_por_ano']={y:round(sum(z[2]*BASE[z[3]] for z in Zs if ts(y)<=z[0]<ts(y+1)),1) for y in range(2020,2027)}
out['nub_veto_por_ano']={y:round(sum(z[2]*BASE[z[3]] for z in Z if ts(y)<=z[0]<ts(y+1)),1) for y in range(2020,2027)}
# Paz cortos en bajista con y sin veto
Zn=stream_full(swap(SEL,None)); out['paz_cortos_bajista_sin_veto']=stat([z[2] for z in Zn if z[3]=='paz' and z[4]==-1 and regime(idx(z[0]))=='bajista'])
out['rios_cortos_bajista_sin_veto']=stat([z[2] for z in Zn if z[3]=='rios' and z[4]==-1 and regime(idx(z[0]))=='bajista'])
# E) Salinas: rejilla de tope y freno
grid={}
for cap in (None,1.5,2.0,2.5,3.0):
    for dd in (None,(6,0.5),(8,0.5),(10,0.5),(12,0.5),(8,0.75)):
        s=summ(run_log(Z,cap=cap,ddth=dd)); grid[f'cap={cap} freno={dd}']=(round(s['Ry'],1),round(s['dd'],1),round(s['RyDD'],2))
out['salinas_rejilla']=grid
json.dump(out,open(engine.D+'../audit/a2.json','w'),indent=1,default=str)
print('BASE',{k:round(v,3) for k,v in S.items()})
for a in AGS: print(a,reg[a]['regimen'],reg[a]['vol'],reg[a]['lado'],reg[a].get('dependencia_ganadoras'))
for k,v in abl.items(): print(k,v)
print('corr diaria',out['corr_diaria']); print('corr semanal',out['corr_semanal'])
print('solapes',ov); print('perdida simultanea',out['semanas_con_perdida_simultanea'],'de',out['semanas'])
for k in ('nub_None','nub_na'): print(k,out[k],out[k+'_por_ano'])
print('veto',out['nub_veto_por_ano']); print('paz cortos bajista sin veto',out['paz_cortos_bajista_sin_veto'],'rios',out['rios_cortos_bajista_sin_veto'])
for k,v in grid.items(): print(k,v)

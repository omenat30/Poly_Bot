exec(open('rl_final2.py').read().split('for lab,ko,kv in')[0])
own_o=own(('ortega',5,2,'B1',None),0.5,'ortega'); own_v=own(('vega',50,2,'B1',None),0.375,'vega')
AG={'bo':'ortega','mr':'paz','swp':'rios'}
coreR=[(x['T'],x['T1'],x['rm'],1.0,'radar_'+AG[x['kind']]) for x in R if radar_live(x) and pazv(x)]
CF={'Radar 24/7 (papel)':radar(lambda x:True),'Radar horario real (L-V 7-22)':radar(radar_live),
 'Oficina v11 núcleo (7-22, Radar + veto Paz)':coreR,'Oficina v11 (núcleo + Ortega y Vega a medio tamaño)':coreR+own_o+own_v}
res={}
for per,(a,b) in [('2018-21',(ts(2018),ts(2022))),('2022-26',(ts(2022),END_)),('2020-26',(ts(2020),END_))]:
    print('=====',per)
    for k,v in CF.items():
        s=port(v,a,b); res[per+'|'+k]=s; print(f'{k:52s} n/sem={s["sem"]:.2f} win={s["win"]:.3f} R/op={s["Rop"]:+.3f} cart/op={s["Rop_cart"]:+.3f} R/año={s["Ry"]:+.1f} caída={s["dd"]:.1f} Sharpe={s["SR"]:.2f}', s['py'] if per=='2020-26' else '')
json.dump(res,open(engine.D+'../audit/v11.json','w'),indent=1,default=float)
# operaciones tomadas por Salinas en 2020-26, por agente, para el panel
Z=sorted([z for z in coreR+own_o+own_v if ts(2020)<=z[0]<END_]); open_=[]; eq=0; pk=0; tr={a:[] for a in ['vega','ortega','paz','rios','ferrer']}
for t0,t1,r,w,src in Z:
    for o in sorted([o for o in open_ if o[1]<=t0],key=lambda o:o[1]): eq+=o[2]*o[3]; pk=max(pk,eq); open_.remove(o)
    if pk-eq>8: w*=0.5
    room=2.0-sum(o[3] for o in open_)
    if w>room: w=room
    if w<0.2: continue
    open_.append((t0,t1,r,w)); a=src.replace('radar_',''); tr[a].append([int(t0),round(float(r),3),0,round(float(w),3)])
RJ=json.load(open('../live/research.json')); RJ.update(tr=tr,w={'vega':0.375,'ortega':0.5,'paz':0,'rios':0,'ferrer':0},prev={'nw':1.97,'win':0.40,'exp':0.39,'Ry':20.2,'dd':12.4})
json.dump(RJ,open('../live/research.json','w'),separators=(',',':')); print({a:len(v) for a,v in tr.items()})

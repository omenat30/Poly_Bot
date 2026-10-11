// Prueba de anticipación: el motor en vivo, alimentado solo con datos hasta T, debe tomar las mismas decisiones que con todo el histórico.
const E=require('./office/engine.js'), D=require('./ml_par.json');
const from=Date.UTC(2021,0,1)/1000, i0=D.t.findIndex(x=>x>=from);
const sl=(a,b)=>({t:D.t.slice(a,b),o:D.o.slice(a,b),h:D.h.slice(a,b),l:D.l.slice(a,b),c:D.c.slice(a,b),v:D.c.slice(a,b).map(()=>1)});
const fund=D.fund.map(([t,r])=>[t,r]);
function runAll(H, office){
  const X=E.prepare(H), R={}; R.vega=E.vega(X,office); R.ortega=E.ortega(X,office);
  const NUB=E.nubarrones(X), nubF=(ts,sd)=>!NUB.veto(ts,sd);
  const SH={vega:E.vega(X,false,E.SHADOW.vega),ortega:E.ortega(X,false,E.SHADOW.ortega)}, CONF=E.confluence(SH.vega,SH.ortega);
  const ff=k=>E.combine(E.PICK[k].conf?CONF:null,E.PICK[k].nub?nubF:null);
  R.paz=E.paz(X,office,ff('paz')); R.rios=E.rios(X,office,ff('rios'));
  const lastT=H.t[H.t.length-1]+3600; R.ferrer=E.ferrer(X,office,fund.filter(f=>f[0]<=lastT));
  return R;
}
const full=runAll(sl(i0,D.t.length),false);
const key=x=>x.sigT+'|'+x.side;
let checked=0, bad=[], openChk=0;
const N=D.t.length, cuts=[]; for(let k=0;k<30;k++) cuts.push(Math.floor(N-24*30-k*24*29.3));
for(const cut of cuts){
  const T=D.t[cut]; const R=runAll(sl(i0,cut),false);
  for(const a of Object.keys(R)){
    const F=new Map(full[a].trades.map(x=>[key(x),x])); if(full[a].open) F.set(key(full[a].open),full[a].open);
    for(const x of R[a].trades){ const y=F.get(key(x)); checked++;
      if(!y||Math.abs(y.entry-x.entry)>1e-6||Math.abs(y.r-x.r)>1e-6||y.exitT!==x.exitT) bad.push([a,new Date(T*1e3).toISOString().slice(0,10),new Date(x.sigT*1e3).toISOString(),y?'difiere':'no existe en el histórico completo', x.r, y&&y.r]); }
    if(R[a].open){ openChk++; const y=F.get(key(R[a].open)); if(!y||Math.abs(y.entry-R[a].open.entry)>1e-6) bad.push([a,'abierta',new Date(R[a].open.sigT*1e3).toISOString(), y?'entrada difiere':'no existe']); }
  }
}
console.log(JSON.stringify({cortes:cuts.length,operaciones_comparadas:checked,abiertas_comparadas:openChk,discrepancias:bad.length,ejemplos:bad.slice(0,8)},null,1));

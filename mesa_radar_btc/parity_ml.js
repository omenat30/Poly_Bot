const ML=require('./office/ml.js'),D=require('./ml_par.json'),Hh=require('./office/ml_hist.json');
const H={t:D.t,o:D.o,h:D.h,l:D.l,c:D.c}; const M=ML.market(H,D.fund.map(([t,r])=>[t,r]));
let mx=new Array(17).fill(0);
for(const r of Hh.rows){const x=ML.features(M,r[0],r[2],r[3],[],[],false); if(!x)continue; for(let j=0;j<10;j++) mx[j]=Math.max(mx[j],Math.abs(x[j]-r[5][j]));}
console.log('max dif features 0-9',mx.slice(0,10).map(v=>v.toExponential(1)).join(' '));

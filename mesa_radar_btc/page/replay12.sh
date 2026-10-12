# uso: replay12.sh <dir> <start-iso> <dia1> [dia2 ...]  (repite rondas cada 15 min, 05-19 UTC, días laborables)
R=$1; S=$2; shift 2; CSV=../data/r/data/updates/btcusd_bitstamp_1min_latest.csv; rm -rf $R && mkdir -p $R/db/signals; START=$(date -d ${S}T00:00:00Z +%s); n=0
for D in "$@"; do for hh in 05 06 07 08 09 10 11 12 13 14 15 16 17 18 19; do for mm in 01 16 31 46; do NOW=$(date -d ${D}T${hh}:${mm}:00Z +%s)000
  node mklive_bs.js $CSV $NOW 3600 167 $R/h.json; node mklive_bs.js $CSV $NOW 900 72 $R/m15.json
  rm -rf $R/out; MESA_GO_LIVE=$START MESA_V10=$START MESA_V12=$START MESA_NOW=$NOW node office/mesa_tick.js $CSV $R/h.json $R/db $R/out "" /tmp/mesa_now/fund.json $R/m15.json > $R/last.txt 2>&1 || { tail -5 $R/last.txt; exit 1; }
  for f in $R/out/*.json; do case $f in *tick-*) ;; *) cp $f $R/db/signals/;; esac; done
  grep -o '"subject":"[^"]*"' $R/last.txt | sed "s/^/$D $hh:$mm /"; grep -h "RADAR:\|DATOS:" $R/last.txt|head -1; n=$((n+1)); done; done; done; echo "rondas $n"; grep RESUMEN $R/last.txt | cut -c1-300
node -e "const f=require('fs');const t=JSON.parse(f.readFileSync('$R/out/'+f.readdirSync('$R/out').find(x=>x.startsWith('tick'))));console.log(JSON.stringify(t.score.radar),JSON.stringify(t.score.mesa));console.log(t.notes.salinas.text);console.log(t.notes.iturbe.text)"

# replay: every 15 min of office hours over a period, carrying known signal ids
rm -rf rp && mkdir -p rp/db/signals rp/out
start=$1; end=$2
t=$start
while [ $t -lt $end ]; do
  h=$(TZ=Europe/Madrid date -d @$t +%H)
  if [ $h -ge 7 ] && [ $h -lt 20 ]; then
    rm -rf rp/out; MESA_GO_LIVE=$start MESA_NOW=${t}000 node office/mesa_tick.js ../data/r/data/updates/btcusd_bitstamp_1min_latest.csv empty.json rp/db rp/out > rp/last.txt 2>&1
    grep -q "^WRITES" rp/last.txt || { cat rp/last.txt; break; }
    for f in rp/out/*.json; do case $f in *tick-*) ;; *) cp $f rp/db/signals/;; esac; done
    grep "^EMAIL_JSON" rp/last.txt | sed "s/^/$(TZ=Europe/Madrid date -d @$t '+%d%b %H:%M') /" | cut -c1-170
  fi
  t=$((t+900))
done

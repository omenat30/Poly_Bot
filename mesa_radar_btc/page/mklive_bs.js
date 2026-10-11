// genera respuestas tipo OpenMarket (1 h y 15 min) a partir de Bitstamp, para repetir rondas pasadas
const fs = require('fs'); const [, , csv, nowMs, sec, hours, out] = process.argv; const now = +nowMs / 1000, from = now - (+hours) * 3600;
const txt = fs.readFileSync(csv, 'utf8'); let end = txt.length; const M = new Map();
while (end > 0) { const st = txt.lastIndexOf('\n', end - 1), line = txt.slice(st + 1, end).trim(); end = st < 0 ? 0 : st; if (!line || line[0] === 't') { if (st < 0) break; continue; }
  const a = line.split(',').map(Number); if (a[0] + 60 > now) { if (st < 0) break; continue; } if (a[0] < from) break; const k = Math.floor(a[0] / sec) * sec, b = M.get(k);
  if (!b) M.set(k, [a[1], a[2], a[3], a[4], a[5]]); else { b[0] = a[1]; b[1] = Math.max(b[1], a[2]); b[2] = Math.min(b[2], a[3]); if (b.closeSet === undefined) { b[3] = a[4]; b.closeSet = 1; } b[4] += a[5]; } if (st < 0) break; }
const rows = [...M.entries()].sort((a, b) => a[0] - b[0]).map(([t, v]) => [new Date(t * 1000).toISOString().replace('.000', ''), v[0], v[1], v[2], v[3], +(v[4] * 110).toFixed(3)]);
fs.writeFileSync(out, JSON.stringify({ data: { series: [{ columns: ['t', 'open', 'high', 'low', 'close', 'volume'], rows }] } }));

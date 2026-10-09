# Mesa Radar · operativa BTC (9 oct 2026)

Esta carpeta contiene la investigación y el motor en vivo de la oficina de agentes Mesa Radar.

## Protocolo

- **Datos.** Velas de 1 minuto de BTC/USD en Bitstamp (`ff137/bitstamp-btcusd-minute-data`), de 2016 a octubre de 2026, agrupadas en velas de 1 hora y de 1 día.
- **Ajuste y prueba.** Los parámetros se eligen solo con 2017–2021 (el de mejor t en ese periodo) y se miden en 2022–2026, años que no se usaron. También hay un walk-forward anual.
- **Costes.** 0,14% por operación de ida y vuelta, más un 0,03% de deslizamiento en los stops. Si el stop y el objetivo se tocan en la misma hora, cuenta el stop.
- **Horario de oficina.** Las entradas y los movimientos del stop solo ocurren entre las 7:00 y las 20:00, hora de Madrid. Los stops siguen activos en el exchange las 24 horas.

## Resultados (R por operación, variante elegida con 2017–21)

| Familia | Variantes | Positivas en 22–26 | 17–21 | 22–26 | Veredicto |
|---|---|---|---|---|---|
| Vega · tendencia diaria (SMA20 + momentum) | 48 | 48 | +0,31 | +0,17 | real |
| Ortega · ruptura del máximo de 5 días | 48 | 48 | +0,52 | +0,34 | real |
| Ríos · compresión de volatilidad + volumen | 72 | 38 | +0,66 | +0,10 (+0,04 en horario) | papel |
| Barrido de liquidez y vuelta | 27 | 0 | −0,14 | −0,37 | descartada |
| Cascada / capitulación (comprar el pánico) | 72 | 0 | +0,18 | −0,31 | descartada |
| Ruptura del rango asiático | 36 | 0 | +0,12 | −0,07 | descartada |
| Estacionalidad hora/día (walk-forward) | – | – | – | negativa tras costes | descartada |

La mesa (Vega + Ortega) en horario de oficina obtiene estos resultados:
- **2017–21:** +0,40R por operación (t = 3,6).
- **2022–26:** +0,26R por operación (t = 1,9), unas 35 operaciones al año y una caída máxima de 10,8R.
- **Con costes dobles:** alrededor de +0,23R por operación.
- **Peor año:** 2022, con −10R, porque fue bajista y la mesa solo compra.

## Motor en vivo

- `office/engine.js` porta las estrategias a JavaScript. `parity.js` comprueba que reproduce el backtest operación por operación: 0 diferencias.
- `office/mesa_tick.js` hace una ronda completa. Une el histórico de Bitstamp con 167 h de Binance futuros (OpenMarket) y escribe la nota de cada agente, las señales y los correos.
- `replay.sh` reproduce rondas cada 15 minutos sobre el histórico para probar los avisos.
- Cuatro rutinas en Haiku, a :01, :16, :31 y :46 entre las 7:00 y las 19:59, ejecutan el script y escriben en la base de datos del artefacto Mesa Radar.

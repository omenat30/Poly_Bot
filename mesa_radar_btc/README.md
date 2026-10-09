# Mesa Radar · operativa BTC (9 oct 2026, v4: L–V 7–21 y selección por recencia)

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

## v2 · al menos 2 operaciones por semana

Con Vega y Ortega solo en largo, la mesa hacía unas 0,7 operaciones por semana. Para pasar de 2:

- **Ortega** también opera en corto, siempre a favor de la SMA50 diaria. Las 12 variantes con ese filtro salen positivas en 2022–26.
- **Paz** entra en los retrocesos de 1 h a favor de la SMA50 diaria (`paz3.py`). Condición: RSI14 por debajo de 45 en las 6 h anteriores (por encima de 55 en cortos) y un cierre que recupera la EMA50 de 1 h. Stop bajo el mínimo de 6 h, como mucho a 2 ATR; stop móvil a 5 ATR; 96 h como máximo. Variante elegida: la de mejor t en 2017–21 entre las que operan en corto. 169 de 216 variantes salen positivas en 2022–26.
- **Ríos** pasa a real y opera en ambos sentidos.
- **Movimientos bruscos** (`fam2.py calvo`): se probó tanto seguir el tirón como darle la vuelta, en 72 variantes. Solo 6 son positivas en 2022–26, así que esta familia se descarta. La sala de emergencias solo autoriza entradas que vengan de un sistema.

Riesgo: 1R para Vega y Ortega y ½R para Paz y Ríos (`desk2.py`). Resultados de la mesa en horario de oficina:

| Periodo | Operaciones/semana | Win rate | R por operación | t (ponderado) | R/año | Caída máxima |
|---|---|---|---|---|---|---|
| 2017–21 | 3,4 | 35% | +0,40 | 5,1 | +41,6 | 14,4 |
| 2022–26 | 3,9 | 29% | +0,18 | 1,8 | +23,9 | 33,7 |
| 2022–26, costes ×2 | 3,9 | 27% | +0,06 | 0,9 | +11,3 | 43,5 |

Más frecuencia supone menos R por operación y más sensibilidad a los costes.

La paridad entre JS y Python (`parity2.js`) da 0 diferencias en 2.033 operaciones.

**Sala de emergencias.** Se activa cuando BTC se mueve 3,5σ o más en 1–3 h, unas 1,5 veces por semana en horario. Los cuatro agentes votan según su sistema y Calvo da el veredicto, que te llega por correo.

## v4 · horario L–V 7:00–21:00, selección ponderada por recencia, más R al año

- **Horario:** entradas y movimientos de stop solo de lunes a viernes, de 7:00 a 21:00 en Madrid (`office_mask2.npy`, `madridWork` en el motor). Las rondas corren de lunes a viernes, de 7:01 a 20:46.
- **Recencia** (`wf.py`, `wf_sel*.py`): para cada agente hay un menú de 114 variantes. Cada año se elige la que más R al año dio en los años anteriores, ponderando cada operación por 0,5^(antigüedad/2 años) y exigiendo una t ponderada ≥ 1. Ese año se opera sin verlo (walk-forward 2020–26).

Walk-forward 2020–26, con riesgos 1 / 1 / ½ / ½:

| | v3 fija (mismo horario) | v4 |
|---|---|---|
| Operaciones/semana | 1,7 | 3,0 |
| Acierto | 41% | 34% |
| R por operación | +0,40 | +0,30 |
| R al año | +22,3 | +27,4 |
| t | 2,6 | 3,0 |
| Caída máxima | 17,6R | 30,9R |

Selección en vivo, con datos hasta el 9 oct 2026:
- **Vega:** SMA50 con momentum, largos y cortos, stop 2,5 ATR, break-even a +1R.
- **Ortega:** ruptura de 3 días, stop 2 ATR, break-even a +1R.
- **Paz:** RSI < 40 y confluencia con las sombras v3.
- **Ríos:** sin confluencia.

Aporte de cada agente: Vega suma poco en el walk-forward (+2R al año). Sin Ortega, 2026 queda negativo.

La paridad JS/Python (`parity4.js`) da 0 diferencias en 1.101 operaciones.

**Modo prueba:** `MESA_TEST=long|short` simula una entrada de Ortega marcada como PRUEBA (correo, base de datos y tablero) sin afectar al marcador.

## v3 · más acierto y más R por operación, con 2–3 operaciones por semana

Probado y descartado:
- **Gestión de la salida sola** (`mg_run.py`): parciales y stop a break-even. Sube el acierto unos puntos, pero baja el R por operación.
- **Filtros por hora, volatilidad, día de la semana o alineación de medias** (`feat.py`): mejoran en 2017–21 pero no se sostienen en 2022–26.

Lo que sí funciona:
- **Confluencia** (`conf.py`): Paz y Ríos solo entran si Vega u Ortega ya están dentro en el mismo sentido. Sube el R esperado.

Para elegir la combinación (`desk3.py`) se probaron 144 combinaciones de gestión y confluencia. La regla, fijada solo con 2017–21, fue: 2–3 operaciones por semana, acierto de al menos 45% y el mayor R esperado. La elegida:
- **Ortega** cobra un 33% a +1,5R y pone el stop en +0,3R al llegar a +0,75R.
- **Paz** filtra por confluencia y pone el stop en +0,3R al llegar a +1,5R.
- **Ríos** filtra por confluencia y pone el stop en +0,3R al llegar a +1R.
- **Vega** no cambia.

| 2022–26 | v2 | v3 |
|---|---|---|
| Operaciones/semana | 3,9 | 2,4 |
| Acierto | 29% | 37% (45% en 2017–21) |
| R por operación | +0,18 | +0,29 |
| R al año (ponderado) | +23,9 | +22,3 |
| Caída máxima | 33,7R | 17,7R |
| R por operación con costes ×2 | +0,06 | +0,19 |

Hay un límite: las combinaciones que llegan a un 45% de acierto en 2022–26 se quedan en +0,10–0,17R por operación. En BTC la tendencia gana con pocas ganadoras grandes. La paridad JS/Python (`parity3.js`) da 0 diferencias en 1.262 operaciones.

## Motor en vivo

- `office/engine.js` porta las estrategias a JavaScript (Vega, Ortega, Paz y Ríos). `parity2.js` comprueba que reproduce el backtest operación por operación.
- `page/` contiene las piezas de la página del artefacto; `build_mesa.sh` las monta.
- `office/mesa_tick.js` hace una ronda completa. Une el histórico de Bitstamp con 167 h de Binance futuros (OpenMarket) y escribe la nota de cada agente, las señales y los correos.
- `replay.sh` reproduce rondas cada 15 minutos sobre el histórico para probar los avisos.
- Cuatro rutinas en Haiku, a :01, :16, :31 y :46 entre las 7:00 y las 19:59, ejecutan el script y escriben en la base de datos del artefacto Mesa Radar.

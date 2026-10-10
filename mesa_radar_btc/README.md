# Mesa Radar · operativa BTC (10 oct 2026, v9: Duarte y el modelo de calidad)

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

## v9 · Duarte (ciencia de datos) y el modelo de calidad

- **Modelo.** Regresión logística con L2 (`office/ml.js`, `research/ml.py`) que estima la probabilidad de que una señal acabe en ganancia. Variables: lado, posición frente a la SMA200, SMA50 sobre SMA200, impulso de 24 h y de 7 días (en unidades de volatilidad), volatilidad relativa, RSI, funding de 3 días y frente a su media de 30, posición en el rango de 20 días, racha de las últimas 10 operaciones del agente y de la oficina, y el agente.
- **Aprendizaje operación a operación.** Antes de cada señal se reentrena solo con operaciones ya cerradas, con vida media de 2 años. En vivo se reentrena en cada ronda con el histórico (`office/ml_hist.json`, 765 señales del walk-forward 2020–26) más cada operación cerrada desde el corte.
- **Resultado fuera de muestra (705 señales puntuadas, desde jun 2020).** No separa. Por cuartil de la puntuación: Q1 (peor) +0,62R y 43% de acierto, Q2 +0,30R, Q3 −0,06R, Q4 +0,71R. Con el gestor de carteras: base +29,3R/año y caída de 15,5R; filtrar el 10% peor da +26,1R, el 20% +19,8R, el 30% +18,5R y el 40% +9,6R, sin bajar la caída. Con más regularización (λ = 30) o con más historial mínimo (120 o 200 operaciones) el resultado es igual.
- **Decisión.** Duarte puntúa en sombra y no veta. El filtro se activa solo si, en las últimas 200 operaciones puntuadas fuera de muestra, el cuartil bajo rinde al menos 0,25R menos que el resto con t ≥ 2. Hoy: cuartil bajo +0,28R, resto −0,08R (t = −0,9).
- **Paridad.** Las variables de mercado de `ml.js` coinciden con Python hasta 5e-6; las de funding difieren en 2 de 765 filas (Python arrastraba un funding viejo tras el fin del histórico; JS pone 0).

## v8 · vuelve Ríos; Ferrer (funding) y Ríos (liquidez) juntos

**Colaboración** (`collab.py`, `wf4*.py`):
- Ríos con el funding de Ferrer, solo cuando la multitud no está cargada en su lado o está atrapada en contra.
- Ferrer con el volumen de Ríos.

Ninguna mejora el walk-forward. Las rupturas con la multitud atrapada en contra aciertan el 54% (+1,06R), pero en 2023–26 no aparecen. La lectura cruzada queda como información en notas y correos.

Walk-forward 2020–26 con Salinas (tope de 2R y freno a 8R):

| | v7 | v8 |
|---|---|---|
| Operaciones/semana | 2,03 | 2,60 |
| Acierto | 40,8% | 40,3% |
| R por operación | +0,40 | +0,38 |
| R al año | +28,9 | +31,2 |
| Caída máxima | 15,5R | 15,0R |
| R al año / caída | 1,87 | 2,08 |

## v7 · sale Ríos, entran Salinas (gestor de carteras) y Ferrer (funding)

**Datos de funding** (`funding.py`): funding de Binance BTCUSDT cada 8 h, de 2020-01 a 2026-10, unido de dos datasets públicos de GitHub (`zwmjj/funding-rate-arb` y `gelatotrade/HMM-Decentralised-Perpetual-Futures`). Coinciden en las 572 liquidaciones que comparten. En vivo, OpenMarket `FUNDING_RATE_AGG` da 167 h.

**Ferrer, funding** (`fund_diag.py`, `fund_strat.py`):
- Como filtro de las operaciones de los demás, el funding no discrimina de forma estable.
- Su operativa propia, el squeeze (media de 3 días > 0,05% o < −0,005% y rotura en contra de la multitud), sale positiva en las dos mitades en 43 de 216 variantes. La ventaja es pequeña y opera unas 3 veces al año.

**Salinas, gestor de carteras** (`pm.py`, walk-forward 2020–26):
- Repartir el riesgo según el rendimiento reciente de cada agente no aportó.
- Un tope de 2R de riesgo abierto y riesgo a la mitad tras 8R de caída sí bajan la caída máxima de 23,7R a 15,5R.

| Walk-forward 2020–26 | v6 (con Ríos) | v7 |
|---|---|---|
| Acierto | 40,3% | 40,8% |
| R por operación | +0,39 | +0,40 |
| Operaciones/semana | 2,56 | 2,03 |
| Caída máxima | 22,7R | 15,5R |
| R al año | +41,7 | +28,9 |

La paridad JS/Python de Ferrer (`parity_f.js`) da 0 diferencias. La rutina de cada ronda está en `rutina_mesa.txt`.

**Oficina:** 26 m de ancho, despacho de cristal para Salinas, biblioteca y salita, suelo de madera, lámparas, reloj, cuadros, mesas con más detalle y monigotes con codos, rodillas y estilo propio.

## v6 · Nubarrones (bajistas y macro)

**Diagnóstico de 2022 y 2025** (`bear_diag.py`, `bear_feat.py`):
- Paz pierde comprando caídas en 2025 (−13R).
- Los cortos en bajista maduro pierden.

**Ley de Nubarrones**, comprobada en 2017–19 (fuera de muestra) y en 2020–26: con SMA50 < SMA200 diaria se vetan los cortos de Paz y Ríos. En ese régimen, los cortos de Ríos dan −0,10R y −0,20R por operación con un 26–29% de acierto; fuera de él, +0,53–0,56R.

Su operativa propia, vender el giro (`nub_strat.py`, 108 variantes), pierde en 2017–19 y da muy pocas operaciones, así que Nubarrones no opera.

Walk-forward 2020–26 (`wf3*.py`), con el veto y Paz sin confluencia:

| | v5 | v6 |
|---|---|---|
| R por operación | +0,35 | +0,39 |
| R al año | +33,7 | +41,7 |
| t | 2,6 | 3,1 |
| Operaciones/semana | 2,3 | 2,6 |
| Acierto | 41% | 40% |
| Caída máxima | 21,7R | 22,7R |
| 2022 / 2025 | −13R / −1R | −3R / +14R |

`parity6.js` da 0 diferencias en 1.245 operaciones.

## v5 · stops y objetivos más cortos y el Radar BTC como filtro

`wf2.py` genera un menú de 432 variantes:
- objetivos fijos de 1, 1,5, 2 y 3R;
- stops más cortos;
- break-even;
- el Radar BTC (señales V20, `panel_trades.json`) como filtro: no entrar si su señal neta de 24 h va en contra. Nunca se usa como disparador.

`wf2_sel.py` compara reglas de selección en walk-forward 2020–26. La elegida es: por agente, el mayor (R medio × acierto) ponderado por recencia, con t ≥ 1. Riesgos: Vega y Ortega 1R, Paz y Ríos 0,75R.

| Walk-forward 2020–26 | v4 | v5 |
|---|---|---|
| Acierto | 34% | 41% |
| R por operación | +0,30 | +0,35 |
| R al año | +27,4 | +33,7 |
| Operaciones/semana | 3,0 | 2,3 |
| Caída máxima | 30,9R | 21,7R |

Lo que se descartó:
- **Objetivos de 1–1,5R:** dan un 47–49% de acierto, pero el R al año se queda en 11–14 y la mesa baja de 2 operaciones por semana.
- **Radar BTC:** en 2017–20 (fuera de su ajuste) no mejora a Vega, Ortega ni Ríos. La mejor regla con Radar (44% de acierto, +0,36R por operación) tiene más caída y baja de 2 operaciones por semana en 2021 y 2026.

Selección viva:
- **Vega:** SMA50, k = 2, break-even.
- **Ortega:** ruptura de 5 días, k = 2, break-even.
- **Paz:** RSI < 40 con confluencia.
- **Ríos:** k = 4.

`parity4.js` da 0 diferencias en 1.075 operaciones.

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

# Mesa Radar · operativa BTC (12 oct 2026, v12: los aprendices del Radar)

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

## v12.4 · rondas cada hora y liquidez solo L–V (18 oct 2026)

Por orden del usuario (gasto): rondas de la Mesa solo a las :01 (la :31 queda pausada) y el correo de liquidez de la mañana solo de lunes a viernes. Estrategia sin cambios.
- `RADAR_WINDOW` pasa de 35 a 80 min para que cada señal de aprendiz siga viéndose en la siguiente ronda horaria.
- Coste medido (`v13_delay.py`, aprendices, entrada tarde con stop y objetivo de la señal): R total 2022-26 con entrada inmediata 52,8; a 35 min 45,8; a 45 min 42,3; a 60 min 42,8; a 75 min 28,1. Con rondas horarias el retraso medio de entrada es ~45 min: se esperan unas −10 a −12R en 4,6 años en los aprendices (≈ −2,5R/año), sin contar que los avisos de salida y parcial llegan hasta 1 h tarde. En 2018-21 el retraso de 60-75 min deja el R/op en +0,08 a +0,03 (frente a +0,14 inmediato).
- Simulación de regresión (`simulate.py` con todas las rondas :16/:31/:46 saltadas, 3 y 7 sep): ✅ sin salidas sin entrada, 0 señales perdidas.
- Reversible: reactivar las rutinas :16/:31/:46 y devolver `RADAR_WINDOW` a 35 min.

## v12.3 · eficiencia de las tareas programadas (14 oct 2026)

Sin cambios de estrategia (backtest idéntico). Medido: las 4 rutinas de ronda (280 ejecuciones/semana) son ≈80% del consumo; los escáneres del Radar (155/sem) no se tocan.
- `radar_desk.js`: la ventana de datos pasa de 167 h / 72 h fijas a `max(60, horas desde la última vela + 16)` (tope 167). Verificado idéntico en la simulación de regresión.
- Control diario: antes no comprobaba nada (dependía de herramientas que la rutina no tiene). Ahora lo hace `research/control_diario.py`, solo con la base de datos (rondas recibidas, retraso, avisos de datos, señales perdidas, salidas sin entrada, z de Iturbe). Rutina en Haiku.
- Informe semanal en Haiku. Ningún modelo inferior a Haiku existe.
- Propuesta pendiente de aprobación: rondas cada 30 min (−50% consumo principal; coste estimado −1 a −1,5R/año y captura 86–93%).

## v12.2 · captura de las señales y búsqueda de una v13 (13 oct 2026)

**Encargo:** una versión que rinda mejor que la v12. **Resultado honesto: ninguna variante de estrategia lo consigue; sí se corrige una fuga real de captura en vivo.**

**1. Ocho variantes de estrategia (pre-registradas antes de mirar, `research/v13_prereg.md`; `v13_eval.py`).** Reducciones de riesgo con razón de mercado sobre la cartera v12g.

| Variante | 2018-21: Sharpe rec. · ops/sem · caída |
|---|---|
| v12 | 1,68 · 1,32 · 9,7R |
| F1/F2 · saltar entradas a favor del funding de multitud (θ 0,0003 / 0,0006) | 1,63 · 1,08 · 8,7R / 1,45 · 1,24 · 9,7R |
| V1/V2 · riesgo ×0,5 con volatilidad turbulenta (ratio ≥ 2,0 / ≥ 1,5) | **1,69** · 1,32 · 9,7R / 1,49 · 1,31 · 9,7R |
| T1/T2 · aprendices contra la SMA50 diaria ×0,5 / saltados | 1,57 · 1,34 · 11,4R / 1,45 · 1,10 · 12,4R |
| S1 · apilado del mismo lado ×0,5 | 1,63 · 1,36 · 7,9R |
| W1 · saltar viernes 19-21 h | 1,62 · 1,31 · 9,7R |

- La regla de elección (solo 2018-21) escoge V1, con +0,01 de Sharpe: ruido. En 2022-26 empeora: 0,75 frente a 0,77, R/año +18,5 frente a +19,1, 2 de 5 años mejores.
- **Juez: DESCARTAR.** DSR 0,000. Inventario: 3.114 pruebas.
- Por qué no hay más margen: con 2018-26 consumido por 12 versiones y más de 3.100 pruebas, no queda periodo limpio. Una mejora «de backtest» ya no es certificable; solo el futuro y otros activos lo son.

**2. La fuga de captura (lo que sí mejora).**
- Un aprendiz solo se avisaba si la vela de señal cerraba hace menos de 20 min. La primera oportunidad real de verla es la ronda a +16 min nominales, que llega 3,4 min tarde de media (mediana 3,4, p90 4,2, máx. 5,6; 6 de 84 rondas del 12-13 oct no se ejecutaron).
- **Con 20 min, solo el 79% de las señales tenían su primer intento a tiempo** (66 de 84 rondas). Con 35 min, el 93% más un segundo intento: ≈ 99%.
- Ya perdió la primera señal real (12 oct, vela de las 15:15 Madrid).
- **v12.2:** ventana de 35 min y, si el aviso llega con 10 min o más de retraso, el correo dice «AVISO TARDÍO», el precio de ahora y la distancia en R a la entrada de la señal. El stop y el objetivo son los de la señal. No cambia ninguna regla de entrada, salida, tamaño ni parada.
- **Estimación (no medida):** unas +0,16 operaciones por semana de aprendices y alrededor de +2R al año (≈ 10% de los +19R/año). El backtest no cambia (ya supone entrada inmediata); mejora lo que se cobra en vivo.
- Backtest de la ventana (`v13_delay.py`): entrar 35 min tarde da +0,19R (2018-21) y +0,24R (2022-26) por operación recuperada. Detalle y la desviación del pre-registro (se descarta la guarda de precio) en `v13_prereg.md`.

**3. Pruebas.** `simular-ronda`:
- 7 y 8 sep, 3 sep: ✅ sin cambios.
- `--saltar 2026-09-03T15:16`: ✅, las dos entradas se avisan tarde (31 y 16 min) con su aviso.
- Seis rondas seguidas perdidas el 3 sep: ✅, 0 operaciones contadas y 2 señales perdidas anotadas.

## v12.1 · la contabilidad anota, no deduce (13 oct 2026)

**Incidente.** El 12 oct, a las 13:35 UTC, el marcador contaba un corto del aprendiz de Vega desde 82.533 (cerrado después por objetivo, +1,5R) que nadie había avisado: no hubo evento de entrada, ni correo, ni documento en `signals`. Con él, Iturbe daba z = 0,84 y Calvo «100% ganadoras», y el tope de riesgo abierto estaba ocupado por una operación que no existía para el usuario.

**Causa.**
- El motor ve oportunidades que el usuario nunca recibió. Una entrada solo se avisa si la vela de señal cerró hace menos de 20 minutos.
- Ese día faltaron 3 de 56 rondas (≈10:31, 13:01 y 17:01 UTC) y las rondas llegan 2–5 minutos tarde. Perder una sola deja la siguiente en el límite de la ventana o fuera.
- Si una oportunidad no constaba, `mesa_tick.js` repetía la regla del tope de 2R y la daba por operada.
- Es el mismo tipo de fallo que el de Salinas: se confundía «el motor cree que hay una operación» con «hay una operación».

**Arreglo (v12.1, solo contabilidad; ninguna regla de entrada, salida, tamaño ni parada cambia).**
- La rutina pide ahora todas las señales desde el arranque (`2026-10-09`, límite 1.000), no una ventana de 72 h.
- Una oportunidad solo cuenta si su entrada consta en `signals`. Ya no hay repetición de la regla del tope ni excepción por antigüedad.
- Lo que ninguna ronda avisó se anota como `radar-<agente>-lost-<hora>` (tipo `bloqueo`, de Calvo). No genera correo y no cuenta. El tick lleva `radar.missed`.
- El mismo criterio vale para las operaciones propias (`inLive`).

**Prueba de regresión** (`simular-ronda`, opción nueva `--saltar`): el 3 sep 2026 se pierden las rondas de las 15:16, 15:31, 16:01 y 16:16.
- Código anterior: ‼️ marcador de aprendices 2 con 0 entradas ni salidas avisadas.
- v12.1: ✅ 0 operaciones contadas y 2 señales perdidas anotadas.
- Días de regresión habituales (3 sep; 7 y 8 sep): ✅, sin cambios en entradas, salidas ni correos.
- El simulador ahora también comprueba que nada abierto en el tick falta en `signals`.

**Estado de la v12.** Congelada. `audit/manifest_v12.json` guarda los hashes y los parámetros. Cualquier cambio de estrategia es una v13 con su propia evidencia.

**Pendiente del dictamen del 13 oct** (nada de esto cambia reglas de la v12 sin aprobación):
- Libro de operaciones con estados (señal, avisada, ejecutada, cerrada, perdida). `trades`, el diario del usuario, ya es la fuente natural de «ejecutada».
- Política de aviso tardío con guarda de precio: descartada en la v12.2 (descarta entre el 28% y el 39% de las señales y baja el R total).
- Latido y parte diario fuera del camino del modelo de lenguaje.
- Datos de una sola fuente (Binance perpetuo) para el backtest.
- Regla escrita de reanudación tras −10R.
- Prueba de estabilidad en otros activos y PBO.

## Segunda ala · machine learning (12 oct 2026) · CERRADA Y DESCARTADA

**Cerrada el 12 oct 2026 por decisión del usuario, antes de su primera ronda en vivo.** No hay ventaja fuera de muestra y aprender error a error no la crea.
- La rutina está desactivada y el panel ya no tiene su sección.
- El código queda archivado en `ala2/` (`ala2/office`, `ala2/page`) por si algún día hay datos de liquidez real o costes más bajos que justifiquen reabrirla.
- No repetir sin una razón nueva.

Lo que sigue es el registro de lo que se probó.

Es un ala independiente de la primera: no ve sus señales, posiciones ni decisiones. Decide cada 10 minutos (L–V 7:00–20:50 Madrid) y registra todas las decisiones, también las de «sin operación». No envía correos y no opera con dinero.

**Quién hace qué**
- **Montes · liquidez.** Flujo comprador o vendedor estimado (BVC), volumen relativo, absorción, mechas de rechazo, iliquidez de Amihud, distancia al VWAP y funding.
- **Aranda · técnico.** Retornos de 10 min a 7 días, EMAs, RSI de 1 h y 4 h, posición en el rango, distancia a máximos y mínimos, SMA50 diaria.
- **Lagos · director.** Combina a los dos con un modelo propio (stacking con sus predicciones fuera de muestra y el régimen), versiona los modelos y lleva campeón y retador.
- **Beltrán · riesgo, con veto.** Calibra el EV con una regresión isotónica sobre los últimos 24 meses fuera de muestra. Reglas:
  - una posición a la vez, 1R = 0,5%;
  - EV neto calibrado > +0,05R;
  - parada diaria en −2R;
  - mitad de riesgo si la cartera cae más de 8R;
  - suspensión si cae 12R (solo el campeón);
  - sin entradas si los datos son dudosos.

**Fase 1 · backtest** (`ala2/`, protocolo de la casa):
- **Modelo:** LightGBM walk-forward mensual 2018–2026 (106 versiones).
- **Costes:** 0,14%, más 0,03% en los stops, más funding.
- **Operación:** entrada 5 min después de la decisión, stop de 1,5 ATR de 1 h, objetivo de 1,5R, máximo 24 h.
- **Variantes:** 16, cerradas antes de mirar.
  - Primera tanda: 8 sobre velas de 1 min.
  - Segunda tanda: 8 sobre velas de 5 min y EV calibrado. Son las mismas variables que ve el vivo; el código es el mismo (`office/ala2_feat.js`).
- **Elección y prueba:** se elige con 2018–21 y se prueba en 2022–26 sin tocar.

| 2022–26 (prueba) | ops/sem | acierto | R/op neto | R/op antes de costes | payoff | PF | Sharpe | caída |
|---|---|---|---|---|---|---|---|---|
| Velas de 1 min, elegida (media, umbral 0,20) | 2,47 | 42,3% | −0,114 | – | 1,12 | 0,82 | −0,84 | 51,0R |
| Velas de 5 min + calibración, elegida (media, EV > 0,05) · **campeón** | 0,49 | 45,1% | +0,010 | +0,118 | 1,24 | 1,02 | −0,11 | 10,8R |
| Explorador de Lagos (sin filtro de EV) · **retador** | 14,45 | 40,4% | −0,180 | −0,005 | 1,09 | 0,74 | −3,90 | 328R |
| Ala 1 · v12 | 2,3 | 44,1% | +0,279 | – | – | – | 0,77 | 14,3R |

**Veredicto: no hay ventaja demostrada. Descartado como estrategia de dinero real.**
- **Poca señal:** la correlación de las predicciones con el resultado cae de 0,07–0,10 en 2018–21 a 0,01–0,04 en 2022–26.
- **Los costes se comen lo poco que hay:** 0,11–0,18R por operación con stops de 1,5 ATR de 1 h. Una cadencia de 10 min obliga a stops cortos, y con un 0,14% de comisión eso es estructural.
- **El campeón no opera desde 2023:** la calibración de Beltrán ya no ve EV positivo y veta.
- **Por debajo del objetivo:** el payoff realizado (1,1–1,24) no llega al 1,5 pedido, por los cierres por tiempo.
- **Dato llamativo sin validar:** a favor de la SMA50 diaria el campeón dio +0,26R (34 operaciones). Se vio después de la prueba, así que no se usa.

Inventario: +17 pruebas (16 variantes y el explorador) y +3 del modo a piñón: 3.106 en total.

**Fase 2 · simulación en vivo** (desde el 13 oct 2026):
- **Ronda:** `office/ala2_tick.js` (rutina «Mesa Radar · Ala 2 ML»; instrucción en `ala2/rutina_ala2.txt`).
  - Las rutinas no pueden bajar de una hora, así que corre a las :57 y calcula las 6 decisiones de 10 min de esa hora, cada una solo con velas cerradas antes de su minuto.
  - El registro es el mismo que con una ronda cada 10 min; se publica con hasta 1 h de retraso.
  - Se usa la rutina antigua de Calvo, desactivada desde el 9 oct, porque es la única libre que tiene el conector de OpenMarket.
- **Base de datos:** colección `ala2`, un documento `d-AAAAMMDDHHMM` por decisión más `estado`.
  - Cada decisión guarda: hora, datos, liquidez, técnico, régimen, predicciones de Montes, Aranda y Lagos, dirección, entrada, stop y objetivo, R:R, riesgo en % y € (capital teórico de 10.000 €), costes, EV neto, probabilidad, confianza, motivo, veto de Beltrán y versión del modelo.
  - Al cerrar se añade: R neto y bruto, costes, MFE/MAE, previsto frente a real y motivo del cierre.
- **Liquidez real:** cada decisión guarda también el flujo agresor comprador de Binance (10 min, 1 h, 4 h), el interés abierto y las liquidaciones. OpenMarket gratis solo guarda 7 días, así que esta es la única forma de tener histórico para reentrenar a Montes con datos de verdad.
- **Campeón y retador:** el campeón es la variante elegida; el retador, de momento, es el explorador de Lagos, que da señales simuladas para aprender (y perderá según el backtest).
- **Versiones:** viven en `office/ala2_models.json` (`historial`). Para volver atrás se vuelve a publicar la versión anterior. Un modelo nuevo entra como retador.
- **Dinero real:** solo con 100 operaciones simuladas, R medio positivo y aprobación del usuario.
- **Ensayo:** `node ala2/replay_ala2.js <bitstamp.csv> <dir> <días>`.
  - 7, 8 y 9 oct y viernes 2 → lunes 5 oct: ✅ (510 rondas, ninguna salida sin entrada, 0 correos).
  - Con umbral abierto en una copia de prueba: 10 entradas y 10 cierres del campeón, parada diaria correcta.
- **Paridad de modelos:** Python y JS dan la misma predicción (diferencia máxima 0 en 300 decisiones).

**Modo «a piñón» con aprendizaje (12 oct, petición del usuario).**
- **Qué hace:** cada decisión de 10 min abre una operación simulada por el lado preferido, unas 84 al día, y cada operación cerrada enseña al aprendiz.
- **Cómo aprende:** corrección en línea (NLMS) sobre la media de Montes y Aranda, con variables estandarizadas. Aprende del lado operado y también del no operado, que se resuelve como sombra.
- **Qué corre en paralelo:**
  - el **control**: los mismos modelos, sin aprender;
  - el **campeón** de Beltrán.
- **Backtest 2022–26** (`ala2/a2_online.py`, 3 variantes de η, elección con 2018–21 → η = 0):

| 2022–26 | ops/sem | acierto | R/op neto | R/op antes de costes | payoff | PF |
|---|---|---|---|---|---|---|
| Control (sin aprender) | 420 | 41,1% | −0,159 | +0,017 | 1,10 | 0,76 |
| Aprendiz (η 0,05, lo que corre en vivo) | 420 | 39,8% | −0,190 | −0,015 | 1,09 | 0,72 |

- **Veredicto:** aprender error a error no mejora fuera de muestra. Cada operación es casi todo ruido y el corrector aprende ruido.
- **Por qué se monta igualmente:** a petición del usuario, en simulación, para medir en vivo si aprender ayuda; el panel enseña la curva del aprendiz frente al control.
- **Ojo con el R total:** las operaciones se solapan (decenas abiertas a la vez, casi siempre del mismo lado), así que su suma no es una cartera. Se juzga por acierto y R por operación.
- **Estado:** el documento `estado` guarda las operaciones abiertas en compacto, los pesos del aprendiz y los marcadores. El ensayo de 3 días da unos 4 KB.
- **Ensayo** (7–9 oct): 270 rondas, 252 decisiones y operaciones, 212 cierres, 424 lecciones, 0 fallos, 0 correos.

## Auditoría externa de la v12 (12 oct 2026)

El dictamen de diez auditores externos dice que la mesa no ha demostrado una ventaja propia y queda lejos del Radar BTC 15m (2022–26: acierto 44% frente a 56%, Sharpe 0,77 frente a 2,51). Sus propuestas se probaron el mismo día con el juez (`validar-estrategia`); ninguna mejora la cartera fuera de muestra. Inventario: 3.081 pruebas.

| Hipótesis | Script | Resultado | Veredicto |
|---|---|---|---|
| Aportación de cada agente (cartera sin él) | `au_loo.py` | Vega es lo mejor (sin él, Sharpe 0,57); Ortega aporta (0,69); Paz propia resta en 2022–26 (sin ella 1,12) pero es el motor de 2018–21 (sin ella 0,72) | — |
| Aprender de las 1.119 extras del Radar (5 variantes con ML) | `au_meta.py` | ML que aprende de todas: +0,10R/op frente a +0,27R de la regla; la mejor elegida con 2018–21 no mejora la cartera | Descartada |
| Despido automático por resultado reciente (20, 40 ops o 12 meses) | `au_bench.py` | Sharpe 2022–26 de 0,61 a 0,75 frente a 0,77 | Descartada |
| Oportunidades del modelo en fin de semana | `au_finde.py` | 0,05 ops/semana | Descartada |
| Mesa sin Paz propia | juez | 2022–26: Sharpe 1,12, acierto 48%, caída 8,9R; pero −63R en 2020–21, −33R en 2023, 1,0 ops/semana | Aspirante en sombra |

Pesos de los aprendices (juez): (a) aprendices a 1,5R → 2022–26 Sharpe 0,71 frente a 0,77, caída 16,9R: descartada; (b) aprendices a 1,5R y Paz propia a 0,25R → 2022–26 Sharpe 1,00 y acierto 45,5%, pero 2018–21 Sharpe 0,74 frente a 1,47: descartada. Inventario: 3.083.

«Aprender cada día» ajustando el peso de cada agente por su resultado reciente (`au_adapt.py`, vida media 90/180/365 días): 2022–26 Sharpe 0,62–0,65 frente a 0,77 y caída de unos 18R. Descartado: el resultado reciente de un agente no predice el siguiente. Inventario: 3.086.

Decisiones:
- La v12 queda congelada.
- Aprendizaje diario sin riesgo: Iturbe compara en cada ronda la vigente con las aspirantes en sombra (sin Paz propia y v12a) en `notes.iturbe.val.retadores`; sección «Aprendizaje diario» del panel. Promoción con 20 o más operaciones cerradas, más R y aprobación del usuario.
- Cada cambio, uno a uno y aprobado por la auditoría.

La visita está en la escena 3D: diez auditores y una reunión de unos 31 minutos, una sola vez (12 oct, una vez por navegador). El dictamen por agente está en la sección «Auditoría externa de la v12» del panel.

## Revisión de la v12a con el juez (12 oct 2026, descartada)

Se pasa por `validar-estrategia` la alternativa v12a frente a la v12 en vivo. La v12a mantiene la tendencia propia de Vega a 0,75R y lleva los aprendices a 0,5R en lugar de 1R. No es una prueba limpia: sus cifras de 2022–26 ya se habían visto al elegir la v12. Cuenta como una prueba más en el inventario (3.071).

| 2022–26 | v12 | v12a |
|---|---|---|
| Ops/semana | 2,28 | 2,65 |
| Acierto | 44,1% | 45,7% |
| R/op propio | +0,279 | +0,286 |
| R/op cartera | +0,161 | +0,150 |
| R/año | +19,1 | +20,8 |
| Sharpe | 0,77 | 0,85 |
| Caída | 14,3R | 12,5R |

- En 2018–21 (elección) la v12a es peor: Sharpe 1,38 frente a 1,47 y R/año +20,0 frente a +21,8.
- Año a año en 2022–26 mejora 2 de 5: 2022 (+3,9R) y 2025 (+13,8R). Empeora 2023, 2024 y 2026.
- La mejora de Sharpe en 2022–26 se apoya casi entera en 2025.
- La ventaja de la candidata sola no está demostrada (DSR 0,42).
- Con ponderación por recencia (vida media de 2 años), en 2022–26 la v12a gana: Sharpe 0,76 frente a 0,65 y R/año +15,2 frente a +13,2. Pero es justo por 2025. En 2018–21 ponderado sigue perdiendo: Sharpe 1,57 frente a 1,68.
- Veredicto del juez: **DESCARTAR**. Se mantiene la v12.

## Velas con machine learning (12 oct 2026, descartado)

Se buscó si la forma de las velas (cuerpo, mechas, rango, cierre en el rango y volumen de las últimas 6 velas, más patrones clásicos) da ventaja. Marcos de 15 min, 1 h y 4 h. Operación fija: stop de 1 ATR, objetivo de 1,5R. Costes de la Mesa y horario de oficina. Walk-forward anual con LightGBM (`cv_data.py`, `cv_wf.py`). Elección con 2018–21 y prueba en 2022–26.

- **Como señal propia** (`cv_eval.py`):
  - El mejor umbral de cada marco en 2018–21 se vuelve negativo en 2022–26:
    - 4 h: de +0,07R a −0,10R por operación.
    - 1 h: de +0,10R a 0,00R.
    - 15 min: negativo en los dos periodos.
  - Entrar al azar cuesta −0,60R (15 min), −0,27R (1 h) y −0,10R (4 h), por los costes.
- **Patrones clásicos uno a uno** (`cv_pat.py`): 126 combinaciones (14 patrones × 3 contextos × 3 marcos).
  - Positivas en 2018–21: 14. Positivas también en 2022–26: 5, lo que se espera del azar.
  - La mejor de 2018–21 (vela grande bajista en 4 h, +0,24R) da +0,04R en 2022–26.
- **Como filtro de la mesa v12** (`cv_filter.py`, 27 variantes).
  - La elegida con 2018–21 veta el 25% de aprendices con peor previsión en 1 h. En 2022–26 frente a la v12:

    | | Filtro | v12 |
    |---|---|---|
    | Ops/semana | 2,05 | 2,28 |
    | Acierto | 43,9% | 44,1% |
    | R/op | +0,30 | +0,28 |
    | Sharpe | 0,80 | 0,77 |
    | Caída | 12,5R | 14,3R |

  - Diferencias dentro del ruido, y quita operaciones. No se adopta.
- Inventario: unas 170 pruebas más (126 patrones, 18 umbrales de señal propia, 27 de filtro).

## v12 · los aprendices del Radar (12 oct 2026)

La v11 (los agentes copiaban las señales del Radar) se retiró: no se trataba de repetir al Radar sino de aprender de él y buscar **otras** oportunidades. El Radar BTC 15m solo lleva una operación a la vez. Mientras está dentro, su propio modelo sigue viendo señales que él ignora. Esas son las oportunidades de los aprendices. Nunca se reenvía una señal propia del Radar, y su panel no se toca.

- **Motor.** `office/radar_multi.js` es el motor del Radar (`strat.js`, parámetros V20) con un modo `multi`. Sus operaciones propias quedan idénticas: 1.513 de 1.513 frente a `panel_trades`. Añade aparte las señales que el modelo ve estando dentro (`extra: true`), cada una con su stop, objetivo de 1,65R y cierre a las 72 h. Cada extra lleva `radarSide`, el sentido del Radar, y `ru`, lo que este lleva recorrido en R. `office/radar_desk.js` monta las velas de 15 min como el escáner (Bitstamp + Binance).
- **La regla** (`mx_eval*.py`):
  - Solo se toman las extras en el mismo sentido que la operación abierta del Radar y con `ru < 0,8`, y solo si la vela de señal cierra en horario de oficina (L–V 7–21 Madrid). Rupturas → Vega, reversiones → Paz, barridos → Ríos. Riesgo 1R.
  - Contra el Radar pierden en los dos periodos. Con `ru ≥ 0,8` el movimiento ya está gastado.
  - Solas: +0,12R por operación en 2018–21 y +0,27R en 2022–26, con un 54% de acierto.
  - Con 1, 5 o 15 min de retraso (`mx_delay.py`), el acierto es del 54% y el resultado de +0,25 a +0,27R.
- **La cartera** (`v12_eval*.py`, tope 2R y freno de 8R de Salinas). Entre cinco combinaciones, la elegida (v12g) es la de mejor Sharpe en 2018–21:
  - Vega propia a sombra.
  - Ortega 1R.
  - Paz propia 0,5R.
  - Aprendices 1R.

| | Acierto | R/op (riesgo propio) | R/op (cartera) | R/año | Sharpe | Caída | Ops/sem |
| --- | --- | --- | --- | --- | --- | --- | --- |
| v12 · 2022–26 (prueba) | 44,1% | +0,279 | +0,161 | +19,1 | 0,77 | 14,3R | 2,3 |
| v10 · 2022–26 | 42,5% | +0,286 | +0,137 | +13,6 | 0,59 | 12,4R | 1,9 |
| v12 · 2018–21 (elección) | 40,2% | +0,547 | +0,315 | +21,8 | 1,47 | 9,7R | 1,3 |
| v10 · 2018–21 | 35,1% | +0,610 | +0,324 | +18,0 | 1,28 | 8,8R | 1,1 |
| v12 · 2020–26 | 42,9% | +0,385 | +0,223 | +26,3 | 1,12 | 14,3R | 2,3 |
| v10 · 2020–26 | 40,2% | +0,389 | +0,196 | +20,2 | 0,91 | 12,4R | 2,0 |

- **Por año (2020–26, R de cartera):**
  - v12: +45,0, +41,6, +2,4, +65,7, +23,0, **−7,3**, +7,5.
  - v10: +40,0, +32,1, −0,4, +56,3, +8,0, +0,7, +0,3.
- **Lo que no mejora:**
  - El R por operación en el riesgo de cada agente no sube.
  - La caída máxima pasa de 12,4R a 14,3R.
  - 2025 empeora.
- **Alternativa más prudente (no elegida por la regla):** v12a, la v10 más los aprendices a 0,5R. Mejora a la v10 en los 7 años y en 2022–26 da Sharpe 0,85 y +20,8R/año. Pero en 2018–21 tuvo peor Sharpe (1,38).
- **Descartado:**
  - Un aprendiz genérico con aprendizaje automático sobre 47.667 situaciones del Radar (`rs_data.py`, `rs_model.py`): pierde fuera de muestra.
  - El modelo del Radar en otras temporalidades.
  - Otras salidas.
  - El estado del Radar como filtro de las estrategias propias.
- **En vivo** (`office/mesa_tick.js`, `rutina_mesa.txt`):
  - Ronda cada 15 min, L–V de 7 a 21 h.
  - Una extra entra si su vela de señal cerró hace menos de 20 min. Correo de entrada y de salida.
  - Salinas cuenta lo abierto (propio y aprendices) contra el tope de 2R.
  - Las decisiones de días anteriores se leen de la base de datos (`signals`). Si no constan, se repite la regla del tope.
  - Probado con `page/replay12.sh` sobre septiembre de 2026.

## v11 · el modelo del Radar BTC 15m en la cabeza de los agentes (11 oct 2026, retirada)

Protocolo: reglas elegidas con 2018–21; 2022–26 es la prueba. Costes de la Mesa (0,14% + 0,03% en stops) y funding también para el Radar. Comparación en el mismo horario que el escáner real del Radar (L–V 7:00–22:00).

| | Acierto | R/op | R/año | Sharpe | Caída |
| --- | --- | --- | --- | --- | --- |
| Oficina v11 · 2022–26 | 54,3% | +0,369 | +41,5 | 2,71 | 9,0R |
| Radar horario real · 2022–26 | 55,7% | +0,328 | +36,2 | 2,51 | 8,9R |
| Oficina v11 · 2018–21 | 49,1% | +0,246 | +23,5 | 1,98 | 12,4R |
| Radar horario real · 2018–21 | 50,5% | +0,215 | +17,8 | 1,58 | 13,4R |
| Radar 24 h (papel) · 2022–26 | 56,0% | +0,331 | +51,9 | 3,05 | 9,3R |

- **Qué es:** `office/radar_engine.js` es el motor del Radar (idéntico a `strat.js` y al de `radar_alert.js`; parámetros V20). `office/radar_desk.js` monta las velas de 15 min como el escáner (Bitstamp + Binance). Rupturas → Ortega, reversiones → Paz, barridos → Ríos, 1R por señal. Paz veta las señales contra su propia posición abierta (2017–21 −0,21R, 2022–26 −0,39R por operación). Ortega (0,5R) y Vega (0,375R) mantienen sus tendencias propias. Paz, Ríos y Ferrer propios en sombra.
- **Descartado:** (1) Duarte filtrando al Radar: la mejora aparente venía de una fuga de datos mía (variables de la vela de 1 h aún abierta; hasta 45 min de futuro). Corregido (`rl_data.py`), no aporta. (2) El modelo del Radar en 5, 30 y 60 min (`mtf.js`, `mtf_eval.py`): solo funciona en 15 min. (3) Salidas alternativas (`rx.js`, `rx_eval.py`): stop a +0,3R tras +1R, objetivos 1,2R y 2R, todas peores que 1,65R. (4) Duarte con las variables internas del Radar: no aporta fuera de muestra. (5) Objetivo fijo en las tendencias de Ortega y Vega: no sube su acierto.
- **Retraso** (`rl_delay.py`, velas de 1 min): con 1, 5 o 15 min de demora, la mesa del Radar mantiene ~60% de acierto y +0,41 a +0,50R por operación en 2022–26.
- **Límites:** el acierto queda 1,4 puntos por debajo del Radar (las tendencias aciertan menos); el núcleo solo (Radar + veto de Paz) supera al Radar en acierto y R/op pero empata en R/año y Sharpe. El Deflated Sharpe del Radar está pendiente (sus pruebas no están inventariadas). Las variantes propias de Ortega y Vega se eligieron con datos hasta 2026.
- **Horario:** la mesa del Radar opera hasta la vela que cierra a las 21:45 (rutinas 7–21 h); las tendencias propias siguen entrando de 7:00 a 21:00.

## v10 · respuesta a la auditoría externa (11 oct 2026)

**Conclusión:** tras corregir por las ~2.700 variantes probadas, la ventaja no es estadísticamente significativa (Deflated Sharpe 0,035 semanal con N = 500; SPA de Hansen p = 0,12). La v10 opera con menos riesgo y la versión queda congelada (`audit/manifest_v10.json`).

- **Reconciliación** (`research/audit1.py`, `audit/a1.json`): +0,41R por operación es R en el riesgo de cada agente; +29R al año es R de cartera (1R = 0,5% del capital). 765 señales → 748 operaciones (17 rechazadas por el tope, 34 recortadas, 288 con el freno). Pesos: +308 → +248R; tope: +236R; freno: +199R; funding: +186R (+27,5R al año).
- **Robustez** (`audit2.py`): ablación, regímenes, dependencia de las 10 mejores operaciones, correlaciones, solapes, Nubarrones con y sin veto (y en 2017–19), rejilla de Salinas.
- **Estadística y ejecución** (`audit3.py`): funding de los perpetuos, costes extra, retraso de 15/30/60 min con velas de 15 min, Newey-West, bootstrap estacionario, Deflated Sharpe y Reality Check / SPA sobre 1.269 variantes distintas.
- **Paradas y selección** (`audit4.py`): −3R/7 días y −10R; regla de selección con actividad mínima; cortos vetados por Nubarrones fuera de su periodo de diseño.
- **Cartera v10** (`audit5.py`, `export_v10.py`): Ortega 1R, Vega 0,75R, Paz 0,5R; Ríos y Ferrer en sombra. +20,2R al año, 12,4R de caída, 1,97 operaciones por semana; 2025 +0,7R, 2026 +0,3R.
- **Anticipación** (`audit/causal.js`): 30 cortes, 12.985 operaciones, 0 diferencias.
- **Reproducibilidad** (`regen.py`): 22 de 24 variantes elegidas idénticas; las dos de Ríos con filtro de funding difieren.
- **Fallo encontrado en la selección:** una variante sin operaciones recientes conserva sus estadísticas antiguas (Ríos). Se exige ya 6 operaciones en los 2 años previos.
- **Motor en vivo:** agentes en sombra (registran la señal sin operar), parada operativa si fallan los datos, paradas por rendimiento y freno con lo abierto, −10R exige revisión humana (`MESA_REANUDAR`), marcador neto de funding, registro de decisiones en cada tick, Duarte sin veto, Iturbe (validación) compara lo real con lo esperado.
- **Pendiente:** validación por una persona independiente sobre la versión congelada; inventario de pruebas manuales incompleto; verificación de stops en el exchange.

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
- `replay.sh` reproduce rondas cada 15 minutos sobre el histórico para probar los avisos; `page/replay12.sh` lo hace con la v12 (incluye las velas de 15 min de los aprendices).
- Dos rutinas en Haiku (desde el 14 oct; antes cuatro), a :01 y :31 entre las 7:00 y las 19:59, ejecutan el script y escriben en la base de datos del artefacto Mesa Radar.

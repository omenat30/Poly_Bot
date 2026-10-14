# Poly_Bot · instrucciones para Claude

Repositorio de Alberto. Contiene:
- `fastloop_trader.py`, `config.json` y el `README.md` de la raíz: plantilla de Polymarket. Ya no se usa; no tocar salvo que lo pida.
- `mesa_radar_audit/`: el **Radar BTC 15m** (motor `strat.js`, backtests y auditoría). Es otro producto con su propio panel. **No se toca el panel del Radar**: solo se lee su código.
- `mesa_radar_btc/`: la **Mesa Radar**, la oficina de agentes que opera **solo BTC**. Es donde se trabaja casi siempre.
- **Segunda ala (ML): cerrada y descartada el 12 oct 2026.** Archivada en `mesa_radar_btc/ala2/` (código, investigación y ensayo). Su rutina está desactivada. No reabrir sin una razón nueva (datos de liquidez real o costes más bajos).

Idioma: español, directo, honesto. Si una idea no funciona, se dice y se documenta como descartada.

## Objetivos del usuario
Más acierto, más R por operación y por año, más Sharpe anual, menos caída y 2–3 operaciones por semana. Ninguna mejora cuenta si no sobrevive fuera de muestra.

## Mesa Radar: dónde está cada cosa
- `office/engine.js`: estrategias propias (Vega, Ortega, Paz, Ríos, Ferrer) y pesos de Salinas (`PM`).
- `office/mesa_tick.js`: una ronda completa. Escribe notas, señales (`signals`), `ticks` y las líneas `EMAIL_JSON` y `WRITES`.
- `office/radar_multi.js` y `office/radar_desk.js`: motor del Radar en modo multi y su alimentación de 15 min. Los aprendices toman extras a favor del Radar con `ru < 0,8`.
- `office/ml.js` y `office/ml_hist.json`: Duarte (puntúa, nunca veta).
- `page/`: piezas del panel (`page_head.html`, `page_body.html`, `page_app.js`, `page_3d.js`, `research.json`). `build_mesa.sh` las une en `mesa_radar.html`.
- `page/replay12.sh` y `page/mklive_bs.js`: repiten rondas pasadas con datos de Bitstamp.
- `research/`: scripts Python del backtest, la auditoría y los estudios (`v12_eval*.py`, `mx_eval*.py`, `cv_*.py`…).
- `rutina_mesa.txt`: instrucción exacta de las 4 rutinas de ronda (:01, :16, :31, :46, L–V 7–20 Madrid).
- `README.md` de `mesa_radar_btc`: historial de versiones con resultados. Se añade una sección por cada versión o estudio.

## Producción
- Panel y base de datos: artefacto `https://claude.ai/artifact/MxNVeAAFhmbBYRg4qi6LJy`. Colecciones `ticks`, `signals`, `calendar` y `trades`; `trades` es del usuario y nunca se escribe.
- Se publica el HTML con `files` `office/*.js`. Las rutinas leen esos archivos del artefacto en cada ronda.
- Correos: solo a albertomenat@gmail.com y solo los que produce el script (`EMAIL_JSON`).
- OpenMarket: solo lectura (`points`).

## Protocolo de validación (obligatorio)
1. Datos de 1 min de Bitstamp (`ff137/bitstamp-btcusd-minute-data`) y funding de Binance.
2. Costes: 0,14% ida y vuelta, más 0,03% en los stops y el funding. Solo horario de oficina (L–V 7–21 Madrid).
3. Sin mirar el futuro: solo velas cerradas. Vigilar sobre todo las velas de 1 h aún abiertas (ya hubo una fuga de 45 min).
4. Elegir con **2018–21** y probar en **2022–26**, sin tocar nada después de ver la prueba.
5. Comparar con la versión en vivo en las mismas métricas: ops/semana, acierto, R por operación (propio y de cartera), R/año, Sharpe, caída y resultado por año.
6. Sumar las variantes probadas al inventario (más de 2.900 hasta hoy) y recordar el Deflated Sharpe.
7. Adoptar solo si mejora fuera de muestra; si no, documentarlo en el README como descartado.

## Skills del proyecto (`.claude/skills/`)
- `mesa-radar`: flujos generales (probar, publicar, auditar).
- `validar-estrategia`: juez único de cualquier idea (script `validate.py`, inventario en `research/inventory.json`).
- `simular-ronda`: ensayo obligatorio antes de publicar `office/*.js` (script `simulate.py`).
- `informe-semanal`: rendimiento real frente al backtest (script `report.py`; rutina los viernes 21:37).
- `post-mortem`: investigar incidentes y dejar prueba de regresión.
- `buscador-de-ideas`: ideas nuevas con disciplina anti-sobreajuste.

## Antes de publicar un cambio en la oficina
- `node --check` de cada archivo tocado.
- Repetir rondas con `page/replay12.sh` (como mínimo un día con operaciones). Comprobar:
  - que cada correo de salida o de gestión tiene antes su entrada avisada;
  - que no hay correos fuera de `EMAIL_JSON`;
  - que el marcador cuadra con el backtest.
- Captura del panel (playwright y chromium en `/opt/pw-browsers`) sin errores de consola.
- Publicar, actualizar las 4 rutinas si cambia la instrucción, commit y push a la rama de trabajo.

## Estado tras la auditoría externa (12 oct 2026)
- v12 congelada: un cambio cada vez, solo con veredicto ADOPTAR del juez y aprobación explícita del usuario.
- Aspirantes en sombra (lo mide Iturbe en cada ronda, `notes.iturbe.val.retadores`): sin la estrategia propia de Paz y v12a. Promoción con 20+ operaciones cerradas, más R y aprobación del usuario.
- Ya probado y descartado (no repetir sin una razón nueva): 8 reducciones de riesgo sobre la cartera (funding de multitud, volatilidad, aprendices contra tendencia, apilado, fin de semana; v13, juez DESCARTAR), guarda de precio en el aviso tardío, segunda ala de ML cada 10 min (a piñón y con aprendizaje error a error: sin ventaja tras costes), ML sobre todas las extras del Radar, despido automático por racha, pesos adaptativos por resultado reciente, señales de fin de semana, velas/patrones, v12a.

## Errores ya cometidos (no repetir)
- La ronda envió un correo «placeholder». La instrucción de las rutinas prohíbe enviar nada que no salga de `EMAIL_JSON`.
- Llegó una salida de una entrada nunca avisada (señal en fin de semana). `inLive` exige que la entrada conste en `signals`.
- Se contaban como operadas oportunidades que Salinas había bloqueado.
- El cierre de las velas de 15 min de `mklive_bs.js` era incorrecto; está corregido.
- La v11 copió las señales del Radar sin que se pidiera. Hay que aprender del Radar, no clonarlo.
- El marcador contó (12 oct, 13:35 UTC) un corto de un aprendiz que nunca se avisó, porque una regla de reserva daba por operadas las oportunidades que no constaban en `signals`. Desde la v12.1 solo cuenta lo que consta; lo no avisado se anota como `-lost-`. Regresión: `simulate.py --saltar` (ver `simular-ronda`). Desde la v12.2 la ventana de aviso de los aprendices es de 35 min (antes 20, que dejaba perder ~21% de las señales por el retraso de 2-5,6 min de las rondas).

## Working preferences
- Aprende del Radar BTC 15m, nunca copies sus señales ni toques su panel.
- No avises ninguna salida, stop o parcial sin una entrada previa avisada.
- Nunca envíes correos de prueba o relleno; solo las líneas EMAIL_JSON del script.
- No vuelvas con resultados hasta que el cambio esté completo, probado y funcione.
- Si algo no mejora fuera de muestra, dilo claro y descártalo.

## v12.3 (14 oct 2026)
Solo eficiencia: ventanas de datos más cortas, `research/control_diario.py` (control diario determinista, alojado en el artefacto como `ops/control_diario.py.txt`), rutinas de control e informe en Haiku. Rondas cada 30 min (:01 y :31) aplicadas el 14 oct por orden del usuario; las rutinas :16 y :46 están pausadas.

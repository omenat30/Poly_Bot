---
name: mesa-radar
description: Flujos de trabajo de la Mesa Radar (oficina de agentes BTC). Úsalo para probar una idea o estrategia nueva, publicar una versión de la oficina (motor, panel, rutinas) o auditar las rondas reales y el marcador en vivo.
---

# Mesa Radar · flujos de trabajo

Lee antes `CLAUDE.md` de la raíz: rutas, producción y protocolo. Este skill son las listas de pasos; no te saltes ninguno.

## A. Probar una idea nueva
1. Escribe en una frase la hipótesis y las métricas que debe mejorar: ops/semana, acierto, R por operación, Sharpe y caída.
2. Construye los datos solo con velas cerradas. Comprueba que no mira el futuro, sobre todo con mezclas de marcos (1 h abierta, 15 min).
3. Simula con los costes de la Mesa, más el funding y el horario de oficina. Fija antes la lista corta de variantes (umbrales, pesos) y apúntalas.
4. Elige con 2018–21 y luego mira 2022–26 una sola vez. Nada de reajustar viendo la prueba.
5. Compara con la versión en vivo en la cartera completa (`research/v12_eval.py:port`: tope 2R y freno 8R), no solo la estrategia suelta.
6. Informa en una tabla 2022–26 frente a la versión en vivo, más el resultado por año. Di claramente lo que empeora.
7. Documenta en `mesa_radar_btc/README.md` (adoptado o descartado), copia los scripts a `research/` y suma las pruebas al inventario.

## B. Publicar una versión
1. Edita `office/*.js` y/o `page/*`. Pasa `node --check` a cada archivo.
2. Repite rondas: `bash page/replay12.sh /tmp/rp <inicio> <día1> [día2…]`, con un día que tenga operaciones conocidas. Verifica:
   - que cada entrada esperada por el backtest aparece, y las bloqueadas, con su motivo;
   - que ninguna salida, stop o parcial llega sin su entrada avisada;
   - que no hay correos fuera de `EMAIL_JSON`;
   - que el marcador (`score`) cuadra.
3. Construye el panel (`build_mesa.sh`), haz una captura con playwright y comprueba que no hay errores.
4. Publica el artefacto con `files` `office/*.js` (y `null` para lo que se retire).
5. Si cambian los archivos o pasos, actualiza las 4 rutinas de ronda con `rutina_mesa.txt` (crons `7-20`, L–V, Madrid).
6. Haz un commit con resultados en el mensaje y un push a la rama de trabajo.
7. Cuéntale al usuario qué cambia, con números, y lo que no mejora.

## C. Auditar las rondas reales
1. `list_triggers`: sesiones de las rondas del día (`last_run`), y `list_events` de cada una.
2. Busca:
   - `send_message` sin su línea `EMAIL_JSON`;
   - rondas fallidas, bloqueadas por permisos o con `DATOS:` o `RADAR:`.
3. Consulta `signals` del artefacto y comprueba:
   - que toda `salida`, `stop` o `parcial` tiene antes su `entrada`;
   - que no hay duplicados.
4. Revisa el marcador en vivo frente al esperado (Iturbe: z). Avisa si z < −2 con 20 o más operaciones.
5. Arregla lo que sea del código con el flujo B. Lo que sea de datos del usuario (`trades`), no se toca: se informa.

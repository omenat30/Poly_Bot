---
name: simular-ronda
description: Ensayo obligatorio antes de publicar cualquier cambio en la oficina Mesa Radar (office/*.js o la instrucción de las rutinas). Repite rondas reales con el código del repositorio y comprueba que no hay salidas sin entrada, correos raros, oportunidades del Radar perdidas ni marcador mal contado.
---

# simular-ronda

## Cuándo
Siempre antes de publicar `office/*.js` en el artefacto. También después de un incidente, para reproducirlo (junto con el skill `post-mortem`).

## Pasos
1. Elige días con actividad conocida. Como mínimo:
   - un día con entradas y salidas de aprendices, por ejemplo `2026-09-03` o `2026-09-07 2026-09-08`;
   - un lunes tras un fin de semana con señales;
   - el día del incidente, si lo hay.
2. Ejecuta:
   ```bash
   python3 .claude/skills/simular-ronda/simulate.py 2026-09-07 2026-09-08 [--inicio AAAA-MM-DD]
   ```
   - Descarga Bitstamp a `/tmp/bitstamp` si falta (usa `--csv` para otra ruta).
   - Tarda unos 2 min por día.
3. Lee el informe:
   - lista de correos que habría recibido el usuario;
   - oportunidades de los aprendices previstas, entradas y bloqueadas;
   - ✅ o ‼️ por cada fallo.
4. **Si hay ‼️, no se publica.** Se arregla, se añade el caso a esta lista de días y se repite.
5. Copia el resumen (✅ o ‼️, nº de rondas, correos) en la respuesta al usuario y en el mensaje del commit.

## Qué comprueba
1. Ninguna ronda falla.
2. Toda `salida`, `stop` o `parcial` tiene antes su `entrada` avisada (el fallo del stop de Ríos del 12 oct).
3. Todos los correos son de la Mesa; ninguno es de relleno («placeholder»).
4. Cada oportunidad que el motor del Radar prevé para los aprendices aparece como entrada o como bloqueo con motivo.
5. El marcador de los aprendices cuenta solo lo que entró (el fallo de Salinas).

## Días de regresión (añade aquí cada incidente)
- `2026-09-07 2026-09-08`: dos aprendices seguidos con el tope de 2R.
- `2026-09-03`: dos aprendices largos en el mismo día.

## Segunda ala (ML, simulación)
Antes de publicar `office/ala2_*.js` o `office/ala2_models.json`:
```bash
node mesa_radar_btc/ala2/replay_ala2.js <bitstamp.csv> /tmp/a2rep 2026-10-07 2026-10-08 2026-10-09
```
- Repite las rondas como la rutina horaria y comprueba lo mismo: rondas sin fallos, ningún cierre sin su decisión abierta, decisiones sin huecos en horario y 0 correos.
- Para probar el camino del campeón, usa una copia de `office` con `champion.thr = -9` y `ALA2_OFFICE=<copia>`.

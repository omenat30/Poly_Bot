---
name: informe-semanal
description: Informe del rendimiento real de la Mesa Radar frente a lo esperado del backtest v12 (operaciones por semana, acierto, R por operación, z de Iturbe, resultado por agente y ejecución real del diario). Úsalo cuando el usuario pregunte cómo va la mesa o los viernes.
---

# informe-semanal

## Pasos
1. Exporta las señales reales: ArtifactData `query` en `https://claude.ai/artifact/MxNVeAAFhmbBYRg4qi6LJy`, colección `signals`, `{"where":[["at",">=","2026-10-12T00:00:00Z"]],"limit":1000}`, con `out_dir` `/tmp/informe/signals`.
2. Opcional: lo mismo con `trades` (el diario del usuario; **solo lectura**) en `/tmp/informe/trades`.
3. Ejecuta:
   ```bash
   python3 .claude/skills/informe-semanal/report.py /tmp/informe/signals [--trades /tmp/informe/trades] [--semana AAAA-MM-DD]
   ```
4. Entrega el informe tal cual y añade, en 2-3 frases, la lectura:
   - qué agente aporta y quién resta;
   - si la z está por debajo de −2 con 20 o más operaciones (señal de que la mesa se desvía del backtest);
   - si el deslizamiento real es alto.
5. No saques conclusiones con menos de 20 operaciones cerradas: dilo así.

## Referencia (v12, 2022-26)
2,28 ops/semana · 44,1% de acierto · +0,279R por operación (propio) · +0,161R de cartera · desviación 1,60R.
Para escalar el riesgo hacen falta 100 operaciones, 12 meses y el deslizamiento real medido (regla de Iturbe).

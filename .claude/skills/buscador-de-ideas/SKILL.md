---
name: buscador-de-ideas
description: Busca y prueba ideas nuevas para la Mesa Radar (más operaciones por semana, más acierto, R o Sharpe) con disciplina anti-sobreajuste. Hipótesis escrita antes de probar, pocas variantes, y juicio con validar-estrategia. Úsalo cuando el usuario pida mejorar la performance o ideas nuevas.
---

# buscador-de-ideas

## Principio
Con más de 3.000 pruebas en el inventario, casi cualquier idea parecerá buena en algún periodo. Solo vale lo que tiene una razón de mercado **y** sobrevive fuera de muestra **dentro de la cartera**.

## Dónde buscar (lo que ya ha funcionado y lo que no)
- **Funciona:**
  - estructura del precio: rupturas de rango, tendencia diaria, retrocesos a favor;
  - el contexto del Radar 15m: los aprendices a su favor antes de +0,8R;
  - diversificar marcos temporales.
- **No funciona (no repetir sin una razón nueva):**
  - ML genérico sobre muchas variables (aprendiz genérico, Duarte);
  - forma de las velas y patrones clásicos;
  - el modelo del Radar en otros marcos;
  - filtros de calidad;
  - copiar las señales del Radar (v11);
  - extras del Radar contra su posición.

## Pasos
1. **Hipótesis** en 3 líneas, antes de tocar datos:
   - qué ineficiencia explota y por qué existiría;
   - qué métrica debe mejorar (ops/semana, acierto, R/op, Sharpe, caída);
   - cómo encaja con la cartera (¿diversifica u ocupa el mismo riesgo?).
2. **Lista cerrada de variantes**, como máximo 12, escrita antes de probar. Apúntala en el README del estudio.
3. Implementa en `mesa_radar_btc/research/`:
   - solo velas cerradas;
   - costes de la Mesa y funding;
   - horario de oficina.
   - Para datos grandes (1 min de Bitstamp, logs) usa el skill **headroom**: medir primero, leer solo lo necesario.
4. Elige la variante con 2018-21 (Sharpe de la cartera) y genera su `candidata.json`.
5. Juzga con **validar-estrategia** (`--pruebas` = nº de variantes). Copia su informe.
6. Solo si sale **ADOPTAR**:
   - impleméntalo en `office/`;
   - pasa **simular-ronda**;
   - publica con el flujo B de `mesa-radar`;
   - entra a riesgo mínimo y se mide en real con **informe-semanal**.
7. Si sale **DUDOSO o DESCARTAR**, documéntalo en el README (sección «descartado») con sus números. También es un resultado.

## Al informar
Tabla 2022-26 frente a la v12, año a año y lo que empeora. Nunca vendas una mejora que no pasó el juez.

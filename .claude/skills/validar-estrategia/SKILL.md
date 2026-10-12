---
name: validar-estrategia
description: Juez único de ideas de trading de la Mesa Radar. Úsalo siempre que haya que decidir si una estrategia, filtro, peso o agente nuevo entra en la oficina. Mide la candidata sola y dentro de la cartera v12 en 2018-21 (elección) y 2022-26 (prueba), año a año, con estrés de costes, bootstrap y Deflated Sharpe, y da un veredicto.
---

# validar-estrategia

## Cuándo
Antes de adoptar cualquier cosa que cambie qué operaciones hace la mesa: estrategia nueva, filtro, cambio de pesos, agente nuevo. También para revisar una idea descartada.

## Pasos
1. **Antes de mirar resultados**, escribe la hipótesis y la lista cerrada de variantes (umbrales, pesos) en el README del estudio. Elige la variante solo con 2018-21.
2. Genera `candidata.json` con las operaciones de la variante elegida:
   - lista de objetos con `t0` (cierre de la vela de señal, segundos UTC), `t1` (salida), `r` (R neto de costes de la Mesa y funding) y `side`;
   - si puedes, también `risk_pct` (stop/entrada) y `src`;
   - solo velas cerradas y solo horario de oficina (L-V 7-21 Madrid).
3. Ejecuta:
   ```bash
   python3 .claude/skills/validar-estrategia/validate.py candidata.json --peso 1.0 --pruebas <nº variantes probadas>
   ```
   - `--peso`: riesgo por operación en R de cartera (1R = 0,5%).
   - `--reemplaza src1,src2`: quita de la v12 componentes a los que sustituye (p. ej. `paz` o `aprendiz_vega`).
   - `--no-registrar`: para ensayos que no cuentan en el inventario.
4. Lee el informe completo y cópialo en la respuesta al usuario. Debe incluir:
   - la tabla 2022-26 frente a la v12;
   - el año a año;
   - lo que empeora;
   - el veredicto.
5. Según el veredicto:
   - **ADOPTAR:** solo entonces se implementa en `office/` con el flujo de publicar del skill `mesa-radar` y `simular-ronda`.
   - **DUDOSO o DESCARTAR:** se documenta en `mesa_radar_btc/README.md` y no se toca la oficina.

## Reglas
- **Lo reciente pesa más:** el veredicto usa el Sharpe y el R/año ponderados por recencia (vida media de 2 años, `--vida-media`), tanto en la elección como en la prueba. También descarta mejoras que dependen de un solo año.
- La base es `mesa_radar_btc/research/v12g_trades.json`, la cartera en vivo. Si cambia la versión en vivo, se regenera con `research/export_v12g_trades.py`.
- El inventario de pruebas está en `research/inventory.json` y el script lo suma solo. No lo bajes nunca.
- Nada de reajustar después de ver 2022-26. Si se reajusta, es otra prueba más y cuenta en el inventario.
- Un DSR < 0,95 no impide adoptar, pero se le dice al usuario: «ventaja no demostrada estadísticamente».

# v13 · pre-registro (13 oct 2026, escrito ANTES de mirar resultados)

**Encargo del usuario:** una oficina cuya nueva versión rinda mejor que la v12. **Condición de la casa:** solo se adopta lo que el juez
(`validar-estrategia`) da por bueno fuera de muestra. Si nada pasa, la v13 no existe y se dice.

## Hipótesis
La v12 pierde casi todo su R por **riesgo de ejecución y de cola**, no por falta de señales: (1) entra a favor de la posición más cargada del
mercado (funding extremo) y sufre los squeezes; (2) mantiene el tamaño en regímenes de volatilidad turbulenta, donde el deslizamiento real de los
stops es mayor que el 0,03% supuesto; (3) apila posiciones correlacionadas del mismo lado; (4) los aprendices, que no filtran por la tendencia diaria,
operan contra ella igual que a favor; (5) se mantiene posición sin vigilancia el fin de semana tras entradas de viernes por la tarde.
Cada una es una **reducción de riesgo** con razón de mercado, no una búsqueda de más señales. Debería mejorar Sharpe, caída y R por operación a costa de
pocas operaciones. Métrica que debe mejorar: Sharpe ponderado por recencia de la cartera (el del juez), sin bajar de 0,9× las operaciones por semana de la v12.

## Variantes (lista cerrada, 9 como máximo; se prueban sobre las operaciones de la cartera v12g)
- **F1 / F2 · funding de multitud.** Se salta la entrada si el lado va cargado: largo con media de las 9 últimas liquidaciones de funding > θ, corto con < −θ. θ = 0,0003 (F1) y 0,0006 (F2) por 8 h.
- **V1 / V2 · volatilidad turbulenta.** Riesgo ×0,5 si el ATR de 1 h (24 h) frente a su mediana de 30 días es ≥ 2,0 (V1) o ≥ 1,5 (V2).
- **T1 / T2 · aprendices contra la tendencia diaria.** Los aprendices que van contra la SMA50 diaria operan a ×0,5 (T1) o se saltan (T2).
- **S1 · apilado.** Riesgo ×0,5 si ya hay abierta otra operación del mismo lado.
- **W1 · fin de semana.** Se salta la entrada si la señal cierra el viernes entre las 19:00 y las 21:00 (Madrid).
- **K1 · combinación.** Solo si dos o más familias pasan el juez por separado: la combinación de las que pasan, como una variante más.

## Reglas de decisión (fijadas ahora)
1. Se elige **solo con 2018-21**: la variante de mayor Sharpe de cartera ponderado por recencia, con operaciones por semana ≥ 0,9× las de la v12 en ese periodo.
2. Se prueba en 2022-26 con el juez tal cual (`validate.py`): mejora en elección y en prueba, 3 de 5 años, caída ≤ 1,25× y sin depender de un solo año.
3. No se retoca ningún umbral después de ver 2022-26. Cada variante suma al inventario (9 pruebas).
4. DSR por debajo de 0,95: se le dirá al usuario «ventaja no demostrada estadísticamente».
5. Si el juez no da ADOPTAR, la v13 no se publica y las variantes quedan documentadas como descartadas.

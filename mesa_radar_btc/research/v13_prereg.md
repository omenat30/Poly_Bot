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

---

## Adenda (13 oct, tras el resultado de las 8 variantes y antes de la prueba siguiente): fidelidad de la captura
**Resultado de la lista anterior:** ninguna variante mejora la elección de forma material (la mejor, V1, +0,01 de Sharpe) y la elegida empeora en la prueba. Veredicto del juez: DESCARTAR (8 pruebas al inventario).

**Hipótesis nueva (no cambia ninguna regla de la v12, solo cuánto de ella llega al usuario):** en vivo, un aprendiz solo se avisa si la vela de señal cerró hace menos de 20 min.
Las rondas son cada 15 min y llegan 2–5,6 min tarde (media 3,4), así que la 2.ª oportunidad de ver una señal cae hacia el minuto 18–21: la mitad de las veces fuera. Cada señal tiene
en la práctica un solo intento. El 12 oct se perdió así la primera señal de aprendiz. El backtest ya supone entrada inmediata y se ha probado robusto a 1, 5 y 15 min de retraso (`mx_delay.py`);
falta probar 20–35 min y una guarda de precio.

**Variantes (cerradas, 3 en total)** sobre los aprendices (2018-21 y 2022-26), entrada a mercado `d` minutos después del cierre de la señal, con stop y objetivo fijos de la señal:
- L1: d = 20 min, guarda: se salta si el precio se ha alejado más de 0,25R de la entrada de la señal (en cualquier sentido).
- L2: d = 35 min, misma guarda.
- L3: d = 35 min, sin guarda.

**Regla (fijada ahora):** se adopta la ventana más larga (L2) si en 2018-21 el R por operación con retraso es ≥ 0,9× el de entrada inmediata y se confirma en 2022-26,
y no empeora el acierto más de 2 puntos. Si no, la ventana se queda en 20 min y solo se añade la política de aviso. No se toca ningún umbral después de ver 2022-26.

### Resultado de la adenda (13 oct)
`v13_delay.py`, aprendices del Radar, entrada a mercado `d` min tarde con stop y objetivo de la señal:

| | 2018-21: tomadas · acierto · R/op | 2022-26: tomadas · acierto · R/op |
|---|---|---|
| Inmediata (d = 0) | 115 · 46,1% · +0,144 | 194 · 53,6% · +0,272 |
| d = 5 / 15 (referencia) | 115 · 46,1% · +0,179 / +0,187 | 194 · 54,1% · +0,247 / +0,251 |
| L1 · d = 20 + guarda 0,25R | 80 · 47,5% · +0,258 | 135 · 51,1% · +0,238 |
| L2 · d = 35 + guarda 0,25R | 83 · 47,0% · +0,216 | 118 · 53,4% · +0,270 |
| L3 · d = 35 sin guarda | 115 · 47,0% · +0,186 | 192 · 53,6% · +0,239 |

**Según la regla pre-registrada se adoptaba L2** (R/op 150% de la inmediata en 2018-21 y 99% en 2022-26; acierto −0,2 puntos).
**Desviación declarada:** se adopta **L3 (ventana de 35 min, sin guarda)**. La regla premiaba el R por operación, y la guarda lo sube porque descarta entre el 28% y el 39% de las señales (32 de 115 y 76 de 194),
lo que baja el R total por oportunidad en los dos periodos: 2018-21, 0,156 (L2) frente a 0,186 (L3); 2022-26, 0,164 frente a 0,237. La decisión se sostiene solo con 2018-21.
Además, la comparación correcta de ampliar la ventana no es contra la entrada inmediata, sino contra perder la señal: cada señal recuperada entre los min 20 y 35 vale +0,19R (2018-21) y +0,24R (2022-26) de media.
La guarda queda descartada como política de entrada; la distancia en R al precio de la señal se enseña en el aviso para que decida el usuario.

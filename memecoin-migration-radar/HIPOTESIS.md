# Hipótesis y variantes (escrito ANTES de ver ningún resultado)

Fecha de fijación: 2026-10-13. Este archivo no se edita después de empezar a medir.
Si hay que cambiar algo, se abre una versión nueva (HIPOTESIS_v2.md) y se explica por qué.

## Hipótesis
Entre los tokens de pump.fun con capitalización ≥ 30.000 USD y curva ≥ 60 %, los que combinan
(a) volumen creciente de compradores únicos, (b) holders realmente independientes, (c) wallets con historial
rentable que no sale al entrar y (d) ausencia de wash trading y de clústeres dominantes, rinden **más, neto de
costes**, que tokens elegidos al azar con la misma capitalización.

La hipótesis nula es la que se espera por defecto: **no hay diferencia** (la mayoría de memecoins pierde y las
«wallets buenas» ya están dentro cuando llega el aviso).

## Qué cuenta como resultado
- Unidad: la primera observación de cada token con puntuación ≥ `track_score` (cohorte).
- Retorno **neto**: entrada a `latency_s` segundos del aviso, comisión por lado, deslizamiento de curva/pool para
  `position_sol`, comisión de red. Sin precio de salida = pérdida total (conservador).
- Horizonte principal: **1 hora**. Se informan también 5 min y 24 h; no se elige el mejor a posteriori.
- Control: tokens sin aviso con capitalización ±25 %, seguidos exactamente igual.

## Partición
Cohorte ordenada por hora. Primera mitad = elegir variante. Segunda mitad = probar **solo la elegida**.
Nada se cambia tras ver la segunda mitad.

## Regla de decisión (fijada antes)
Con ≥ 15 alertas con control en la segunda mitad:
- **SUPERA AL AZAR (provisional)** solo si exceso medio sobre el control > 0, mediana neta > 0 y p < 0,10 (prueba de
  permutación de signos, un lado).
- En cualquier otro caso: **DESCARTAR** y se documenta como idea descartada.
Con menos alertas: **SIN DATOS SUFICIENTES**; no se concluye nada.
Incluso «supera al azar» solo autoriza a seguir midiendo más semanas, nunca a usar dinero por sí solo.

## Lista cerrada de 12 variantes (`variants.json`)
V00 base (puntuación ≥ 70) · V01 ≥ 60 · V02 ≥ 80 · V03 base + curva ≥ 80 % · V04 base + curva ≥ 90 % ·
V05 base + 6 independientes · V06 base + 10 independientes · V07 base + 40 % wallets de calidad ·
V08 base + 60 % · V09 base + mayor clúster ≤ 15 % · V10 base + 25 compradores únicos · V11 combinada.

Con 12 variantes, una «ganadora» en la primera mitad aparece a veces solo por azar. Por eso la prueba se hace en la
segunda mitad y solo para la elegida. El inventario de variantes probadas es 12; no se añaden.

## Puntos que pueden invalidar la medición (a vigilar)
1. Formatos de las APIs sin verificar (`python -m radar check`). Si cambian, los campos faltan y se ve.
2. Cobertura de historial de wallets: si es baja, el criterio de historial puntúa bajo en vez de inventar.
3. Sesgo de supervivencia en el PnL de wallets: solo se mide ganancia realizada.
4. Falta de precio de salida (token muerto): cuenta como pérdida total.
5. Latencia real de aviso por correo: puede ser mayor que `latency_s`. Se mide con la hora del aviso vs. la del correo.

# Hipótesis v2 (escrita antes de medir; sustituye a HIPOTESIS.md solo en lo que dice aquí)

Fecha: 2026-10-14. Todavía no existe ninguna alerta real ni ningún dato real medido, así que este cambio no se
ha hecho mirando resultados. A partir de que el detector empiece a registrar datos reales, este archivo no se edita.

## Qué cambia
Se añade **GMGN** (API oficial, solo lectura) como fuente de datos. Cambia de dónde salen algunos datos; **no cambia**
la hipótesis, los criterios, los pesos, el umbral de aviso (70), las 12 variantes ni la regla de decisión.

| Dato | Antes (v1) | Ahora (v2, con clave de GMGN) |
|---|---|---|
| Lista de tokens, trades, volumen | pump.fun | igual |
| Mayores holders (hasta 100) | Helius, 20 cuentas | GMGN `token_top_holders`, con % del suministro |
| Fondeador de cada wallet (clústeres) | Helius, 1 llamada por wallet | GMGN, viene en la misma respuesta de holders |
| Historial de cada wallet | Helius, swaps parseados | GMGN `wallet_activity`, hasta 14 wallets por token |
| Mint y freeze renunciados | Helius | GMGN `token_security`, contrastado con Helius si hay clave (si Helius ve una autoridad, manda Helius) |
| Rugs previos del creador | pump.fun, sin pico máximo fiable | GMGN `created_tokens` (capitalización y máximo histórico) |

Las fórmulas de puntuación y los umbrales son idénticos. Lo que cambia es la calidad de los datos de entrada.
Como la fuente cambia, **cada observación guarda su fuente** (`data_source`) y no se mezclan fuentes dentro de una
misma medición sin decirlo: la medición debe partirse por fuente si ambas se usaron.

## Datos extra de GMGN: se registran, NO puntúan
Se guardan con cada observación (prefijo `gx_` en las características): número de wallets smart money y KOL que
lo tienen, snipers, bundlers, rat traders, ratio de riesgo de rug de GMGN, tasa de volumen de bundlers e insiders,
tasa de wallets nuevas y de bots.

No entran en la puntuación ni en las 12 variantes. Razón: la lista de variantes está cerrada y añadir criterios
ahora, sin datos, sería inventar pesos. Se miden en una tabla **exploratoria** (correlación de Spearman con el
retorno neto), marcada como solo descriptiva: son muchas pruebas sin corregir.

Si alguno parece útil, se pre-registra en `HIPOTESIS_v3.md` con su umbral y se prueba con datos nuevos, no con los
que lo sugirieron.

## Riesgo de contaminación a vigilar
Las etiquetas «smart money» y «KOL» de GMGN se calculan con el pasado y las ven todos. Por eso solo se usan
**registradas en el momento del aviso, midiendo hacia delante**. Nunca se aplican a datos históricos antiguos: la
etiqueta de hoy ya sabe quién ganó.

## Límites de uso y seguridad
- Plan gratuito de GMGN: cubo 5/5 con pesos por ruta (holders pesa 5, actividad de wallet 3). El cliente tiene un
  limitador local y, ante un bloqueo, **no reintenta** hasta que pase (repetir lo alarga).
- Solo lectura: lista cerrada de 6 rutas, sin clave privada ni firma. Una prueba automática vigila que no se pueda
  llamar a otra ruta ni leer `GMGN_PRIVATE_KEY`.

## Qué puede invalidar esta versión
1. Formatos de respuesta de GMGN leídos de su documentación, no de llamadas reales: `python -m radar check` lo prueba.
2. Que el fondeador `native_transfer` de GMGN sea con frecuencia un exchange: se ignoran los que traen nombre, pero
   puede haber exchanges sin etiquetar que fusionen wallets que no son hermanas.
3. Que el historial de GMGN cubra solo las últimas 50 operaciones de cada wallet: con wallets muy activas, los
   cierres de posiciones antiguas no aparecen y la cobertura baja (la puntuación de historial baja con ella).

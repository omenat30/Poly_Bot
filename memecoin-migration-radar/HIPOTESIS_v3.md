# Hipótesis v3 (escrita antes de medir; completa a v1 y v2)

Fecha: 2026-10-14. Sigue sin haber ninguna alerta real medida: estos cambios nacen de comprobar las APIs con datos
reales, no de mirar resultados. A partir de que el detector registre datos reales, este archivo no se edita.

## Qué cambia respecto a v1 y v2
La hipótesis, los 5 criterios, los pesos, el umbral de aviso (70), las 12 variantes y la regla de decisión **no
cambian**. Cambia de dónde salen los datos y cómo se trata la falta de datos.

| Tema | Antes | Ahora (verificado con datos reales) |
|---|---|---|
| Trades de la curva | endpoint de pump.fun (devuelve 400) | Helius: firmas de la curva + transacciones enriquecidas; compra o venta por el sentido del token, importe por el cambio de saldo de la curva |
| Historial de wallets | `events.swap` de Helius (viene vacío) | se deduce de `tokenTransfers` y del cambio de saldo de la wallet (más WSOL neto en pools) |
| Monedas del creador | ruta de pump.fun que da 404 | `/coins?creator=<dirección>` |
| Progreso de la curva | SOL reales / 85 | tokens vendidos / 793,1 M (como pump.fun; el de SOL subestimaba hasta 20 puntos) |
| Primeros compradores | primeros trades de la ventana | primeros trades **guardados** del token (no se desplazan entre ciclos); **no son los primeros reales**, solo los primeros vistos |
| Volumen con cobertura parcial | crecimiento y picos con ventana incompleta (inflaban o hundían la nota) | si no cubrimos la ventana anterior, **no se mide** crecimiento ni picos: la nota usa compradores únicos y ratio, reescalada a 100, y lo dice |

GMGN queda como fuente opcional: no hay clave (exige 100 USD de saldo y no se paga por datos en una fase sin dinero).

## Limitaciones conocidas de los datos nuevos
1. **Cobertura de trades**: tokens muy activos generan varias operaciones por segundo (casi la mitad de las firmas
   de la curva son transacciones fallidas de bots). Con el tope de 400 transacciones parseadas por token y ciclo, a veces
   solo se cubre el último minuto. En ese caso el volumen se puntúa sin crecimiento ni picos. Subir el tope cuesta
   créditos de Helius, que no están medidos.
2. **Importe de cada trade**: movimiento neto de la curva, hasta ~13 % por debajo del precio spot en operaciones grandes.
3. **Historial de wallets**: solo las últimas 100 transacciones de cada wallet; el parseo reconoce operaciones de un
   solo token y rutas simples, e ignora rutas complejas. Solo ganancia **realizada**.
4. **Velocidad**: un ciclo con 3 tokens tarda ~150 s por las consultas de wallets (con caché de 6 h baja). El ciclo no
   alcanza los 20 s de `poll_seconds` en frío; en la práctica se analizan pocos tokens por minuto.
5. **Sesgo posible**: si el aviso llega tarde por esta lentitud, la medición lo captura (entrada a `latency_s`
   segundos), pero no distingue lentitud del sistema de lentitud del correo.

## Qué puede invalidar esta versión
- Que el cambio de saldo de la curva deje de ser fiable como importe (p. ej. migración del programa de pump.fun).
- Que Helius cambie el formato enriquecido (ya difería de lo esperado una vez).
- Cobertura sistemáticamente parcial en los tokens que importan (los más activos), lo que dejaría el criterio de
  volumen reducido a compradores y ratio.

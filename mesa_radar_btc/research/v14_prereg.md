# v14 · pre-registro (19 oct 2026, escrito ANTES de mirar resultados)

**Encargo del usuario:** (1) rehacer la estrategia de la Mesa desde cero con las familias de las skills de trading, o (2) operar solo ETH con datos de OpenMarket. Se devuelve la mejor; si ninguna mejora a la v12, se cierra la Mesa.

## Opción 2 (ETH): no evaluable
OpenMarket sirve 167 h de velas con esta clave (364 días en Plus). El protocolo exige elegir con 2018-21 y probar en 2022-26. Con 7 días (o un año) de datos no hay prueba posible. Bitstamp ETH (`ff137/bitstamp-ethusd-minute-data`), Binance, data.binance.vision y Coinbase no son accesibles desde este entorno. Sin evidencia fuera de muestra, la opción 2 queda **descartada por falta de datos**, no por rendir mal.

## Opción 1: familias (lista cerrada, 8 variantes) sobre BTC
Datos: Bitstamp 1 h (velas cerradas), decisión al cierre de la vela, entrada a la apertura siguiente, solo horario de oficina (L-V 7-21 Madrid), costes de la Mesa (0,14% + 0,03% en stops) y funding. Un riesgo de 1R por operación, largos y cortos.
- **A · ruptura tras contracción (VCP):** ATR(24 h)/mediana(30 d) < θ y cierre fuera del máximo/mínimo de las 48 h previas. Stop 2 ATR, trailing 3 ATR (chandelier), máximo 72 h. A1 θ = 0,8; A2 θ = 0,6.
- **B · pullback en tendencia:** régimen diario (cierre > SMA50 d para largos; < para cortos) y EMA21 h > EMA100 h; entrada cuando el cierre recupera la EMA21 tras haber estado a más de 1 ATR por debajo en las 12 h previas (espejo para cortos). Stop bajo el mínimo de 12 h, objetivo 2R, máximo 72 h. B1 SMA50 d; B2 SMA100 d.
- **C · ráfaga de momento:** retorno de 1 h ≥ k × ATR(24 h) en dirección de la vela. Stop 1,5 ATR, trailing 2,5 ATR, máximo 48 h. C1 k = 3; C2 k = 4.
- **D · agotamiento (fade):** cierre fuera de la banda de Bollinger (48 h, 3σ) con volumen ≥ 2× su media y la vela siguiente cierra de vuelta dentro: se opera contra el exceso. Stop en el extremo, objetivo la media, máximo 48 h.
- **E · momento de varias semanas con volatilidad objetivo:** largos si retorno 20 d > 0 y 100 d > 0 (cortos si ambos < 0), una entrada por semana; trailing 4 ATR, máximo 336 h.

## Reglas de decisión (fijadas ahora)
1. Solo con 2018-21: se descartan variantes con < 0,4 ops/semana o R/op ≤ 0,10. De las restantes se elige la de mayor Sharpe ponderado por recencia. Las 8 suman al inventario.
2. La elegida pasa por el juez (`validar-estrategia`): (a) **sola**, frente a la v12 en las mismas métricas, y (b) **sumada** a la v12.
3. Se adopta una v14 solo si el juez da ADOPTAR o, como sustituta de la v12, si mejora R/año ponderado Y Sharpe en 2022-26 sin empeorar la caída más de 1,25×, con 3 de 5 años positivos.
4. No se retoca ningún umbral después de ver 2022-26. Si nada pasa, la Mesa se cierra (propuesta al usuario) y se documenta.

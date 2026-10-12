# Auditoría de Mesa Radar (9 oct 2026)

Esta auditoría contrasta lo que de verdad aporta Mesa Radar y su panel «Radar BTC 15m» con lo que prometían los históricos de la página.

## Pregunta

Todas las versiones del panel (de la v3 a la V20) y la «segunda entrada» de la mesa se diseñaron y ajustaron con datos de BTC de **2021 a 2026**. Por eso, un buen resultado en esos años no demuestra que haya ventaja. Para comprobarlo, aquí se pasa el **mismo motor, sin tocar nada** (`strat.js`, copiado de `alerts/radar_alert.js`), por **2017–2020**, cuatro años que ninguna regla había visto. Además, se añaden costes y retrasos realistas.

## Resultados (R por operación)

| Prueba | 2021–26 (ajuste) | t | 2017–20 (no visto) | t |
|---|---|---|---|---|
| Panel V20, como se anunciaba | +0,44 | 10,2 | **+0,10** | 1,8 |
| Panel V20, 17 min tarde y costes reales | +0,34 | 8,2 | **+0,07** | 1,2 |
| Núcleo v5 (pocas reglas, 1,65R) | +0,17 | 4,0 | **+0,12** | 2,1 |
| Señales de calidad A | +0,59 | 9,4 | +0,03 | 0,3 |
| Señales de calidad C | +0,22 | 2,2 | +0,27 | 2,2 |
| Segunda entrada, toque = lleno | +0,39 | 7,1 | +0,00 | 0,1 |
| Segunda entrada, perforando y con costes reales | +0,37 | 6,5 | **−0,01** | −0,1 |
| Segunda entrada, costes ×2 | +0,28 | 5,1 | −0,08 | −1,0 |

Por año, el núcleo v5 da: 2017 +0,24 · 2018 +0,16 · 2019 −0,12 · 2020 +0,17 · 2021 +0,26 · 2022 +0,15 · 2023 +0,09 · 2024 +0,26 · 2025 +0,08 · 2026 +0,16.

## Conclusiones

1. **Hay una ventaja real, pero es pequeña.** La ruptura de base gana en las dos épocas, con unos +0,10–0,12R por operación.
2. **Las capas de la v6 a la V20 son sobreajuste.** Triplican el resultado en 2021–2026, pero fuera de muestra no añaden nada, y las reversiones y los rebotes tras barrido pierden.
3. **La nota de calidad A/B/C no sirve para dimensionar.** Fuera de muestra las A son las peores, y arriesgar 1,5× en ellas reduce el R por unidad de riesgo de +0,10 a +0,07.
4. **La segunda entrada no tiene ventaja propia.** Vuelve a papel.
5. **El retraso del correo no es el problema.** Entrar 2–30 min tarde cuesta unos 0,03–0,06R.

## Cambios aplicados

- `alerts/radar_alert.js` (artefacto Radar BTC 15m): la segunda entrada sale del correo y solo se registra en papel (`mode: "papel"`). El riesgo pasa a ser fijo del 0,5%, sin multiplicar por la calidad, y se recuerda colocar el stop en el exchange.
- Página Radar BTC 15m: riesgo por defecto del 0,5% y «Igual en A, B y C», con un aviso de auditoría.
- Página Mesa Radar: nueva sección «Auditoría», límites de riesgo fijos y un **registro de operaciones reales** (colección `trades`) que calcula el R real, el slippage y las paradas (−3R en la semana, −10R desde el máximo).
- Calvo (auditor): ahora mide el panel en directo, lee `trades` y emite PARADA SEMANAL, PARADA TOTAL o SLIPPAGE ALTO. Pasar a real exige 60 cerradas, R ≥ +0,15, t ≥ 2, las dos mitades positivas y superar al panel.
- Paz (noticias): pasa de 4 a 2 ejecuciones al día, que son las que usa Vega.

## Cómo reproducirlo

```sh
cd mesa_radar_audit
./get_data.sh                                 # ~250 MB de Bitstamp, construye min.bin
node --max-old-space-size=8000 bt.js          # panel V20 2016-2026 -> panel_trades.json
node an1.js                                   # por año, dentro y fuera de muestra
node --max-old-space-size=8000 an2.js         # estrés: segunda entrada, costes y retrasos
node --max-old-space-size=8000 bt2.js         # variantes más simples y curves.json
```

Limitaciones: los datos son de Bitstamp spot y no de Binance futuros, aunque el panel ya calentaba sus indicadores con Bitstamp. El volumen anterior a 2021 sigue otra escala, lo que puede afectar a los filtros de volumen. ETH y SOL no se pueden probar, porque OpenMarket en el plan gratuito solo da 167 h de velas y este entorno no tiene acceso a otros históricos. Esos agentes se miden en directo.

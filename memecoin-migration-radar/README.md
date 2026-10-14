# Radar de Migración

Avisa de memecoins de Solana que están a punto de migrar de **pump.fun** a su pool de liquidez, los puntúa con cinco
criterios y mide después, sin dinero, si los avisos sirven de algo frente al azar.

> **Nada de este programa compra ni vende.** Solo detecta, puntúa, avisa y mide. No pide claves privadas ni frases
> semilla y no tiene ninguna función que firme transacciones.

## Qué hay que saber antes de empezar (la parte honesta)

1. **La mayoría de memecoins va a cero.** Un buen aviso no cambia eso.
2. **Llegas después que los bots.** Entre que un token cruza el umbral y migra pasan segundos o pocos minutos. El
   panel mide cuánto de la subida queda cuando llegas tarde (retraso de entrada de 30 s, comisión, deslizamiento).
3. **Muchas wallets «rentables» son bots o gente con información privilegiada.** El criterio de historial las marca
   como «probable bot» cuando hacen demasiadas operaciones, pero no se puede distinguir a una persona con información
   privilegiada de una que acierta.
4. **Esto está construido pero NO verificado contra las APIs reales.** Se desarrolló en un entorno sin acceso a
   pump.fun, DexScreener, Helius ni GMGN. La lógica está probada con datos sintéticos (61 pruebas). Los campos de
   GMGN se leyeron de su documentación oficial; los de pump.fun y Helius están escritos de memoria. **El primer paso es `python -m radar check`**: te dice, línea
   a línea, qué funciona y qué no. Lo que falle se arregla o se descarta; no se maquilla.
5. **Cuatro de los filtros de seguridad son débiles o triviales en pump.fun** y el panel lo dice en cada token:
   en pump.fun las autoridades de mint y freeze vienen renunciadas por diseño; «honeypot» antes de migrar casi no
   existe; y «liquidez retirable» no se puede verificar on-chain aquí (se anota como «por diseño»). Los filtros que
   sí discriminan son la concentración del top 10, los rugs previos del creador y la manipulación.
6. **Los datos del historial de wallets son una aproximación.** Solo se mide la ganancia **realizada**; las posiciones
   perdedoras sin vender no restan. Con poca cobertura, la puntuación de historial baja en vez de inventarse.

## Cómo se decide (resumen)

Un token entra en la tabla si tiene **≥ 30.000 USD** de capitalización y la curva entre **60 % y 99,5 %**. Se puntúa
de 0 a 100 con estos pesos (se pueden cambiar en `radar/config.py`):

| Criterio | Peso | Qué mide |
|---|---|---|
| Curva y capitalización | 15 | Cuánto falta para migrar |
| Volumen real | 25 | Compradores únicos en 5 min y su crecimiento, ratio compras/ventas, que no sea un solo pico |
| Wallets independientes | 25 | Entre los mayores holders y los primeros compradores: cuántas **entidades distintas** hay (clústeres por mismo fondeador de SOL, transferencias entre ellas y compras en el mismo slot) |
| Historial de wallets | 20 | Cuántas tienen ganancia realizada y no salen nada más entrar (tiempo de tenencia mediano, salidas rápidas) |
| Sin manipulación | 15 | Wash trading, compras circulares, creador o clúster dominando |

**Descartan el token** (puntuación 0, se muestra el motivo): mint o freeze sin renunciar, top 10 > 35 % del
circulante, creador con más de 1 rug previo, honeypot, y no poder verificarlo (lo que no se puede comprobar cuenta
como fallo). También lo descartan los umbrales duros de manipulación.

El aviso salta cuando un token no descartado llega a **70 puntos** (variante V00 de `variants.json`).

## Arquitectura

```
 pump.fun API ─┐                         ┌─ panel local  http://localhost:8787
 GMGN (lectura)┤                          │
 Helius RPC ───┼─►  detector (Python) ──►├─ correo (solo a ti, solo avisos reales)
 DexScreener ──┘    cada 20 s, SQLite    └─ registro de avisos + seguimiento 5 min / 1 h / 24 h + controles
```

- **Detector** (`python -m radar run`): lista los tokens de pump.fun, analiza a fondo los que pasan las puertas (máx.
  6 por ciclo, con caché de 2 min y de 6 h para wallets), guarda cada observación y sigue el precio de cada candidato
  y de unos controles al azar durante 25 h.
- **Base de datos**: un archivo SQLite (`data/radar.sqlite`). No hay que instalar nada.
- **Panel**: `dashboard/index.html`. Lo sirve el propio detector en local (solo lectura, solo tu ordenador). La misma
  página se publicó también como artefacto con **datos de ejemplo**; desde la página publicada no se puede leer tu
  ordenador, así que allí sirve para ver el diseño o para cargar un archivo exportado.
- **Sin dependencias**: solo Python 3.10+ y su biblioteca estándar.

## Puesta en marcha paso a paso

**Paso 1. Python.** Instala Python 3.10 o superior (https://www.python.org). Descarga este repositorio
(`git clone` o el botón «Code → Download ZIP») y abre una terminal dentro de la carpeta.

**Paso 2. Claves de datos.** Necesitas **al menos una** de las dos; con las dos funciona mejor.

*GMGN (recomendada).* En https://gmgn.ai/ai crea una API key y márcala de **solo lectura**. Pégala en `.env` como
`GMGN_API_KEY`. Con ella, una sola llamada trae los 100 mayores holders con su fondeador, y el historial de cada
wallet sale de GMGN. No hace falta ni se debe poner `GMGN_PRIVATE_KEY`: este programa no la lee, y el cliente solo
conoce 6 rutas de lectura (hay una prueba que lo vigila). El plan gratuito permite unas 1–2 consultas por segundo
con los pesos de cada ruta; el detector lo respeta y, si GMGN lo bloquea, se pone en pausa sin insistir.

*Helius (opcional si usas GMGN).* Entra en https://www.helius.dev, crea cuenta, copia tu *API key*. Copia
`.env.example` como `.env` y pega la clave tras `HELIUS_API_KEY=`. El archivo `.env` no se sube a GitHub. El plan
gratuito limita las consultas; si el detector se queda corto, verás errores de límite en el panel (abajo, «Últimos
errores»). Con GMGN, Helius solo contrasta mint y freeze. Nunca pongas claves privadas ni frases semilla de wallets en ningún sitio de este proyecto.

**Paso 3. Comprobar que todo funciona.**
```
python -m radar check        # prueba cada fuente y la forma de sus datos
python -m radar calibrate    # mide cuántos SOL tenía la curva al migrar (ahora asumo 85)
python -m unittest discover -s tests    # 61 pruebas de la lógica
```
Si `calibrate` da otro valor, pon `"curve_target_sol": <valor>` en `config.json`. Si `check` falla en algo, **pásame
la salida** y se arregla antes de seguir.

**Paso 4. Arrancar.**
```
python -m radar run
```
Abre http://localhost:8787. El detector corre mientras la terminal esté abierta. Para que funcione 24/7 hay que dejarlo
en un ordenador siempre encendido o en un servidor barato (un VPS pequeño o Railway/Fly.io, unos pocos euros al mes);
pídeme que prepare la configuración de despliegue cuando `check` dé todo en verde.

**Paso 5. Correo (opcional).** En Gmail activa la verificación en dos pasos y crea una «contraseña de aplicación»
(Cuenta de Google → Seguridad → Contraseñas de aplicaciones). Rellena `SMTP_USER` (tu Gmail) y `SMTP_PASSWORD` (esa
contraseña) en `.env` y pon `"enabled": true` en `config.json → email`. El único destinatario es
`albertomenat@gmail.com`; el programa se niega a enviar a más de una dirección. Solo se envía un correo por aviso real.
No hay correos de prueba: `python -m radar check` solo comprueba que las credenciales inician sesión.

**Paso 6. Ver una demostración sin claves.** `python -m radar demo` abre el panel con datos sintéticos.

## Cómo leer el panel

- **Tabla de candidatos.** La barra de 5 tramos de cada fila es el desglose: el ancho es el peso del criterio y el
  relleno su nota; rojo = puerta no superada. Pulsa una fila para ver cada criterio con su explicación, los chequeos de
  seguridad, las wallets enlazadas y los enlaces a pump.fun y DexScreener. «Mostrar descartados» enseña los que
  fallaron un filtro y por qué.
- **Registro de avisos.** Cada aviso guarda precio, capitalización y hora, y se rellena solo con el resultado **neto** a
  5 min, 1 h y 24 h, con la marca RUG si el precio cae un 90 % o más.
- **Medición frente al azar.** Aparece el veredicto automático. Hasta que haya suficientes avisos dirá «SIN DATOS
  SUFICIENTES», y eso es lo correcto: no hay conclusión.

## Datos extra de GMGN (se registran, no puntúan)

Smart money y KOL dentro del token, snipers, bundlers, insiders, riesgo de rug de GMGN, tasa de wallets nuevas. Se
guardan en cada observación y se miden en una tabla **exploratoria** del panel. No cuentan para el aviso ni para el
veredicto (ver `HIPOTESIS_v2.md`): sus etiquetas se calculan con el pasado y las ven todos los bots, así que solo
valen si se registran en el momento del aviso, midiendo hacia delante.

## Protocolo de medición (resumen; detalle en `HIPOTESIS.md` y `HIPOTESIS_v2.md`)

1. **Fase sin dinero, unas semanas.** El detector puntúa, avisa y sigue cada candidato. Ningún dinero.
2. **Hipótesis y 12 variantes fijadas antes de mirar** (`HIPOTESIS.md`, `variants.json`). No se tocan.
3. **Primera mitad de los avisos para elegir, segunda para probar** solo la elegida.
4. **Costes reales**: retraso de entrada, comisión, deslizamiento de la curva o del pool, comisión de red; sin precio de
   salida = pérdida total.
5. **Comparación con el azar**: tokens sin aviso con la misma capitalización (±25 %), seguidos igual. Si no hay
   diferencia clara, se descarta y se documenta.

`python -m radar analyze` imprime el informe completo. Para comprobar que el análisis no se inventa ventajas, las
pruebas incluyen una con precios al azar (debe salir «descartar» o «sin datos») y otra con una ventaja plantada (debe
detectarla).

## Comandos

| Comando | Qué hace |
|---|---|
| `python -m radar check` | Prueba cada fuente y el formato de sus datos |
| `python -m radar calibrate` | Mide el umbral real de migración con tokens migrados |
| `python -m radar run` | Detector + panel en http://localhost:8787 |
| `python -m radar serve` | Solo el panel, con la base de datos existente |
| `python -m radar demo` | Panel con datos sintéticos |
| `python -m radar analyze` | Informe de medición frente al azar |
| `python -m radar export estado.json` | Exporta el estado para cargarlo en el artefacto |

## Mapa de archivos

`radar/evaluate.py` puntuación · `clusters.py` entidades · `wallet_history.py` historial · `security.py` filtros ·
`manipulation.py` wash/circular · `costs.py` costes · `analysis.py` + `stats.py` medición · `engine.py` bucle ·
`alerts.py` avisos y correo · `sources/` pump.fun, GMGN, Helius, DexScreener · `variants.json` las 12 variantes ·
`HIPOTESIS.md` y `HIPOTESIS_v2.md` · `tests/`.

## Seguridad del propio programa

- Todo lo que viene de APIs y de la web (nombres de tokens, textos) se trata como **dato**, se limpia y se pinta con
  `textContent`; nunca se interpreta como instrucción ni como HTML.
- Las claves de API se ocultan en cualquier mensaje de error (`util.redact`).
- El servidor del panel escucha solo en `127.0.0.1` y es de solo lectura.
- Photon y GMGN no se usan: no tienen API pública fiable.
- GMGN: clave de solo lectura, lista cerrada de rutas, sin clave privada; las habilidades de GMGN para agentes (que
  incluyen comandos de operar) no se usan.
- Fuentes descartadas por ahora: Birdeye y Bitquery (se pueden añadir si hace falta).

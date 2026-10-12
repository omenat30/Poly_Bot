---
name: post-mortem
description: Investiga un incidente de la oficina Mesa Radar (correo raro, aviso sin su entrada, ronda caída o bloqueada, señal que no llegó, marcador que no cuadra) hasta la causa, lo arregla y deja una prueba para que no se repita. Úsalo en cuanto el usuario o el control diario reporten algo anómalo.
---

# post-mortem

## 1. Fijar los hechos (sin suponer)
- **Qué** pasó exactamente, **cuándo** (hora de Madrid y UTC) y **qué vio el usuario**: asunto del correo o texto del panel.
- **Ronda:**
  - `list_triggers` → las 4 rutinas «Mesa Radar · ronda …» y su `last_run`;
  - la sesión de la hora del incidente, con `list_events` kinds ["assistant","user"], limit 100.
- **Base de datos:** ArtifactData en `signals`, buscando los ids implicados y sus vecinos (misma etiqueta de hora y mismo agente).
- **Si es delegable** (muchas sesiones), usa un subagente que solo lea y reporte, como se hizo con el correo «placeholder».

## 2. Clasificar la causa
| Tipo | Ejemplo real | Dónde se arregla |
|---|---|---|
| Rutina (el modelo que ejecuta la ronda) | correo «placeholder» enviado fuera de paso | instrucción de las 4 rutinas (`rutina_mesa.txt`) |
| Código de la oficina | salida de una entrada nunca avisada (señal de fin de semana) | `office/mesa_tick.js` |
| Datos | velas viejas, solape Bitstamp/Binance | `radar_desk.js` / avisos `DATOS:` |
| Permisos o plataforma | ronda bloqueada al ejecutar node | `.claude/settings.json` o instrucción de la rutina |
| Herramienta de prueba | cierre de velas de `mklive_bs.js` | `page/mklive_bs.js` |

## 3. Reproducir y arreglar
1. Reproduce con `simular-ronda` en el día del incidente (y, si hace falta, `--inicio` antes del origen del problema). Debe salir ‼️.
2. Arregla lo mínimo. Vuelve a ejecutarlo hasta que salga ✅ y comprueba que los días de regresión siguen en ✅.
3. Publica con el flujo B de `mesa-radar`.
4. Limpia los datos erróneos que haya dejado el incidente en `signals` (solo los de la Mesa, nunca `trades`) y díselo al usuario.

## 4. Que no se repita
- Añade el día a «Días de regresión» de `simular-ronda/SKILL.md`. Si la comprobación no existía, amplía `simulate.py`.
- Añade una línea a «Errores ya cometidos» de `CLAUDE.md`.
- Commit con el informe: qué pasó, causa, arreglo y prueba.

## 5. Informe al usuario
En corto:
- qué pasó y por qué;
- si tuvo impacto real (alguna posición o dinero afectado);
- qué se ha cambiado;
- cómo se evita en adelante.

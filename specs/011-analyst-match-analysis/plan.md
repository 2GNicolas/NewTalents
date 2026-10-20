# Implementation Plan: Registro de análisis de partido del Analista

**Decisiones del titular 2026-10-20**: Gol y Asistencia omiten control de resultado y medición guiada; `NONE` queda como valor interno. Un resultado explícito `FAILURE` omite mediciones y, para atajada fallida, detalle de manos. Se guardan con contexto/complejidad `{}` tras minuto válido. El resto conserva cinco contextos/siete criterios. No se muestra observación ni «Añadir otro evento»; guardar devuelve al botón circular. La participación se decide en captura, es de solo lectura en datos finales y no puede cambiarse a «No participó» con eventos guardados. La lista y revisión ordenan visualmente por tiempo numérico con empate estable, conservando secuencia de captura y constancia. Esta decisión prevalece sobre generalizaciones anteriores de este plan.

**Branch**: `feature/011-analyst-match-analysis` | **Date**: 2026-10-16 | **Spec**: `specs/011-analyst-match-analysis/spec.md`

**Input**: especificación aprobada por el propietario el 2026-10-16, incluida la interacción de FR-018/019 y SC-006. Esta revisión reconcilia el diseño; no implementa código ni regenera tareas.

## Summary

Añadir desde el detalle autorizado de Partidos de Feature 010 un flujo web/móvil de captura de eventos, revisión y paso final con participación de solo lectura, total entero de minutos jugados (incluido añadido, sin tope fijo de 90) y enlace HTTPS de YouTube. La participación se decide en captura sin poder borrar eventos guardados. Cada evento se elige mediante rueda abierta por botón circular; Gol/Asistencia no muestran resultado y `FAILURE` no requiere medición. Los demás resultados recorren explícitamente cinco contextos y siete criterios, un grupo por vez, con progreso corregible. Tras los campos aplicables aparece «Guardar evento», sin observación ni «Añadir otro evento» en la UI; guardar modifica solo «Eventos capturados» y devuelve al botón circular. La confirmación final válida crea una carga duradera sin evaluación FEM y, para `FirstMatch`, invoca el puerto transaccional de Feature 009 para `WAITING/RESERVED → LOADED/USED`. Los errores de validación conservan entradas efímeras; revocación las elimina. «Análisis realizados» de Feature 010 no cambia de fuente ni se llena con estas cargas.

## Technical Context

**Language/Version**: TypeScript 5.9 backend, TypeScript 6.0 frontend, Node 24 y npm 10 del repositorio.

**Primary Dependencies**: NestJS 11, Prisma 7, PostgreSQL, Zod 4; Expo 57, Expo Router, React 19 y React Native Web. Reutilizar autenticación, custodia Feature 007, `ConfirmedLoadService` Feature 009 y shell/lectura Feature 010.

**Storage**: PostgreSQL existente, con migración acotada para carga confirmada y eventos observados, incluida la observación textual opcional por evento. Sin tabla de borrador o nota independiente, evaluación FEM ni publicación. La URL del video se conserva junto a la carga autorizada, no en el DTO público del pasaporte.

**Testing**: Vitest/Supertest para dominio, contrato y PostgreSQL; suites de base temporal aislada y secuencial; Jest/React Native Testing Library para rueda, selección explícita, avance/corrección, guardado local, flujo/rutas/limpieza; comparación de web autenticada en escritorio y viewport móvil, teclado, foco y árbol accesible. Ambos typechecks.

**Target Platform**: API NestJS, Expo Router web escritorio/móvil; comportamiento equivalente en Android/iOS sin prometer prueba nativa de lector de pantalla en esta fase.

**Project Type**: monorepo `apps/backend` + `apps/frontend`.

**Performance Goals**: sin SLA inventado; confirmar un partido en una operación transaccional y leer una sola carga por partido. Acotar cuerpo HTTP por seguridad sin imponer una cuota deportiva de eventos no aprobada.

**Constraints**: solo `FIRST_MATCH` tiene hoy fuente y puerto de confirmación; ninguna captura de partido posterior fabricado. La rueda y los indicadores no son deslizadores arrastrables; imágenes ilustrativas no introducen segundos, porcentajes, valores inferidos ni reglas FEM. Privacidad por identidad/rol/perfil, pasaporte `ACTIVE` y custodia actual. Idempotencia y consistencia de versión; respuesta `no-store`; URL no publicada ni verificada por red; sin rating, valor manual, FEM ni tarjetas de realizados. Entradas efímeras se conservan durante correcciones/validación y se limpian ante denegación/revocación.

**Scale/Scope**: un flujo de tres etapas, una carga inmutable por primer partido, eventos de ese jugador/partido. No se presume volumen de producción ni catálogo de fuentes futuras.

## Constitution Check

*GATE previo a investigación: PASS. La aprobación figura en `spec.md`; no hay aclaración material abierta para este alcance.*

| Principio | Decisión de planificación |
|---|---|
| I–II, X–XI. Alcance y autoridad | Spec aprobada; cambios de Feature 011 acotados a captura/carga. La guía FEM aporta términos, no sus matrices pendientes ni cálculo. RF-VID-02 del documento funcional ya distingue administración por New Talents e introducción por el Analista. |
| III–V. Pasaporte y FEM separados | Eventos permanecen internos y vinculados al jugador/partido; `LOADED` y carga no son evaluación completada. No estadísticas o nota pública. |
| VI. Privacidad | Autorización backend por recurso y revalidación en transacción; URL/eventos internos, `404` ajeno/inexistente uniforme, `no-store`, limpieza cliente tras revocación. |
| VII. Arquitectura | Reutilizar el puerto Feature 009 y PostgreSQL del monorepo. La extensión para fuentes futuras es interfaz, no persistencia o datos ficticios. |
| VIII. Web/móvil accesibles | Rueda con apertura/cierre y retorno de foco, opciones táctiles rotuladas y operables por teclado, progreso corregible y guardado local → revisión → paso final; sin deslizadores ni inferencias. |
| IX. Verificación | Contrato, PostgreSQL serializable, carreras/reintentos, privacidad, frontend y web autenticada están en `quickstart.md`. |

## Project Structure

### Documentation (this feature)

```text
specs/011-analyst-match-analysis/
├── spec.md
├── checklists/requirements.md
├── plan.md
├── research.md
├── data-model.md
├── contracts/analyst-match-upload.openapi.yaml
├── contracts/analyst-match-upload-ui.md
└── quickstart.md
```

`tasks.md` ya existe y refleja la interacción anterior; esta revisión **no** lo regenera ni lo modifica. Antes de continuar la implementación se debe reconciliar su cobertura con FR-018/019 y SC-006.

### Source Code (boundaries; implementación parcial existente)

```text
apps/backend/
├── prisma/schema.prisma                  # entidades de carga/evento y migración
├── src/analyst-match-upload/             # catálogo, validación, autorización, transacción, HTTP
├── src/first-match/                      # reutilizar puerto interno confirmado de Feature 009
├── src/analyst-workspace/                # lectura/contexto de partido Feature 010
└── test/{contract,integration}/          # contrato, PostgreSQL y carreras
apps/frontend/
├── app/(authenticated)/analyst/matches/  # detalle existente y flujo nuevo por matchId
└── src/analyst-match-upload/             # cliente, estado efímero y tres etapas
```

**Structure Decision**: Feature 011 posee módulo y tablas propios; no injerta eventos en `FirstMatch` ni muta el DTO de consulta de Feature 010 para exponer datos privados. Un CTA en el detalle autorizado abre el flujo nuevo solo cuando la fuente `FIRST_MATCH` está `WAITING`; detalle `LOADED` con carga propia permite lectura autorizada. Rutas futuras no se activan sin fuente/puerto reales. No se edita `apps/frontend/app/_layout.tsx` para integrar la navegación.

**Estado parcial histórico al redactar el plan (2026-10-16)**: la UI anterior era un formulario plano e incorporaba borradores antes del guardado explícito; no verificaba FR-018/019 ni SC-006. Esa brecha se cerró posteriormente conforme a las decisiones vigentes del titular. Los resultados y límites actuales están en `verification/acceptance.md` y `verification/visual-review.md`; este párrafo no describe el código actual.

## Phase 0: Research decisions

`research.md` resuelve frontera transaccional, digest/idempotencia, forma de observaciones, URL y privacidad, integración de rutas, estado local guiado y verificación. No hay `NEEDS CLARIFICATION`; cualquier FEM, partido posterior o publicación exige otro alcance. El riesgo técnico principal es invocar el puerto después de crear prueba duradera **dentro de la misma transacción**, con orden de bloqueo compatible con Feature 009.

## Phase 1: Data model, contracts and UX

- `data-model.md` distingue evento en edición, «Eventos capturados» efímeros y evento confirmado con observación opcional. Unicidad por partido y `loadId`; ningún borrador persistente.
- `contracts/analyst-match-upload.openapi.yaml` delimita lectura privada y confirmación con versión, intención, participación, total, URL, eventos y observación opcional, `no-store`, idempotencia y errores seguros. «Guardar evento» no es una ruta HTTP; la entrada no concede autoridad.
- `contracts/analyst-match-upload-ui.md` fija rueda, selección por fila, avance y corrección por progreso, guardado local, etapas, foco y limpieza de datos ante revocación.
- `quickstart.md` documenta evidencia esperada de FR-018/019 y SC-006 además de contrato, integración aislada/secuencial, frontend, accesibilidad y separación de FEM/Feature 010. Son instrucciones futuras de validación, no resultados ejecutados.

## Re-check post-design

**PASS de diseño**: los contratos limitan escritura a carga final de `FIRST_MATCH` y no publican URL/eventos al responsable; el modelo no tiene puntuaciones ni evaluación; la prueba transaccional que exige Feature 009 está especificada. FR-018/019 y SC-006 quedan trazados en diseño y guía de verificación, pero el código parcial y `tasks.md` siguen pendientes de reconciliación; no se les atribuye cumplimiento. La guía de valoración manual permanece intacta. La implementación deberá revalidar este gate y producir evidencias reales; el plan no las sustituye.

## Complexity Tracking

No hay violación de la constitución que requiera excepción. La transacción serializable y dos entidades persistentes responden a la atomicidad explícita del puerto Feature 009; una simple actualización de estado sin constancia deportiva fue descartada.

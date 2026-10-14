# Feature 009 — conciliación con quickstart (2026-10-13)

Estados: **P** = comprobación enfocada satisfactoria; **F** = defecto observado; **NV** = no verificado plenamente. P no equivale a una prueba de usuario de extremo a extremo ni a cobertura exhaustiva de todos los dispositivos.

## Cuatro historias

| Historia | Estado | Evidencia y límite |
|---|---|---|
| US1, invitar/programar | P / NV | PostgreSQL: programación sin custodia, unicidad, reserva, reintento y límites de período (`first-match-scheduling.integration.spec.ts`); además, inicio de sesión sintético y recorrido real invitación → formulario → espera en web escritorio/móvil. Ejercicio cronometrado: NV. |
| US2, corregir/cancelar | P / NV | PostgreSQL: movimiento válido, rechazo sin mutación, versión e idempotencia, liberación una vez (`first-match-correction.integration.spec.ts`); reagendamiento y cancelación reales comprobados en Chrome de escritorio y móvil, incluida la confirmación separada. Área segura/lector de pantalla nativos: NV y fuera de esta revisión web. El texto móvil duplicado/truncado se corrigió y recapturó. |
| US3, continuación administrativa | P / NV | Pruebas de navegación de aprobación/activación y regresión manual de custodia (`admin-dossier-approval.spec.tsx`, `passport-activation-custody.spec.tsx`). No se ejercitó una sesión administrativa real en navegador: NV. |
| US4, fin de espera | P / NV | Contrato e integración PostgreSQL con confirmación durable exclusivamente de prueba (`confirmed-load.service.spec.ts`, `first-match-load.integration.spec.ts`), más frontend de `LOADED`. No existe productor real de carga deportiva, deliberadamente fuera de alcance: NV extremo a extremo. |

## FR-001–018

| FR | Estado | Evidencia o límite concreto |
|---|---|---|
| 001 | P | Programación `ACTIVE` sin custodia, contrato e integración. |
| 002 | P / NV | Autorización viva y denegación de ID ajeno en pruebas de backend; no sesión real de cada tipo de responsable. |
| 003 | P / NV | Invitación y ruta sin menú en seis capturas web autenticadas; área segura nativa pendiente. |
| 004 | P / NV | Validación y alertas accesibles de cinco campos en web autenticada; recorte móvil duplicado corregido; presentación nativa pendiente. |
| 005 | P | Asociación durable de partido/jugador/responsable y espera, sin resultados deportivos inventados. |
| 006 | P | Reserva y conteo `RESERVED + USED` con resolución Feature 008 en PostgreSQL. |
| 007 | P / NV | Rechazos de elegibilidad/configuración/cupo y carreras; rama de sobrecupo mixto solo con conteos sintéticos, no con filas PostgreSQL válidas. |
| 008 | P | Un partido vigente por pasaporte, una unidad, intención idempotente y conflicto obsoleto; constraints e integración. |
| 009 | P / NV | Reagendamiento atómico y rollback en PostgreSQL; acción debajo de detalles activada por teclado en ruta web autenticada. Dispositivo nativo pendiente. |
| 010 | P / NV | Liberación una vez e invitación restaurada en PostgreSQL; confirmación separada observada por teclado en ruta web autenticada. Dispositivo nativo pendiente. |
| 011 | P / NV | Estado persistido y lectura del servidor en pruebas; una recarga autenticada recuperó el mismo partido. Nueva sesión y dispositivo físico siguen pendientes. |
| 012 | P / NV | Puerto interno y transición `RESERVED → USED` probados con productor de prueba; productor deportivo real no incluido. |
| 013 | P | Sin interfaz/productor sustituto de carga, FEM ni publicación en Feature 009. |
| 014 | P / NV | Navegación probada con resultados finales; falta recorrido real de Administrador. |
| 015 | P / NV | Custodia/rol/identidad revalidados en pruebas de carga y regresión de custodia; no prueba manual integral de revocación. |
| 016 | P | Auditoría PostgreSQL de actor/momento/intención/transición; respuesta responsable sin campos internos en prueba de privacidad. |
| 017 | P | No se añadieron pagos, planes, FEM, publicación ni partidos posteriores. |
| 018 | P / NV | Revisiones válidas preservan unidad y fechas en PostgreSQL; rechazo preventivo mixto `RESERVED + USED` cubierto por guarda unitaria sintética, no reproducible aquí con filas válidas. |

## Criterios de éxito y alcance de la evidencia

| SC | Estado | Evidencia o pendiente |
|---|---|---|
| 001 | NV | No se realizó ejercicio cronometrado con responsables en web y móvil; no se afirma el 90 % en tres minutos. |
| 002 | P / NV | Invariantes y carreras enfocadas pasaron; el 100 % de escenarios posibles no está demostrado y el sobrecupo mixto tiene solo prueba unitaria sintética. |
| 003 | P | Reagendamiento rechazado conserva fila; cancelación libera una vez e invita de nuevo, en integración enfocada. |
| 004 | P / NV | Relectura/estado y conversión válida probados; recarga autenticada verificada. Cierre de sesión y cambio de dispositivo reales pendientes. |
| 005 | P / NV | Navegación y ausencia de asignación automática probadas en frontend; recorrido administrativo real pendiente. |
| 006 | P / NV | Contrato de privacidad y denegación enfocados; inspección de red en sesión real pendiente. |
| 007 | P / NV | Conservación de revisiones/partidos válidos en PostgreSQL; rechazo por sobrecupo solo sintético por límite del modelo. |

## Comprobaciones ejecutadas en esta pasada

- Siete suites PostgreSQL de Feature 009, **26/26** casos, una tras otra en base local aislada creada y eliminada por `run-feature-009-foundation.mjs`; incluyen concurrencia **4/4** y privacidad **2/2**. No se aplicaron migraciones a la base de trabajo.
- Cuatro suites enfocadas sin PostgreSQL, **18/18** casos, incluidas serialización del adaptador y guarda sintética de cupo; cinco suites frontend, **30/30** casos. Typechecks backend y frontend: correctos.
- Comparación web **autenticada** con los seis PNG: [revisión visual](visual-review.md). Incluye programación, recarga, reagendamiento y cancelación reales en Chrome, teclado, foco, árbol de accesibilidad y estados de carga/error/restricción/indisponibilidad. Tras corregir el payload de reagendamiento y el refresco del cupo, cuatro suites enfocadas de frontend pasaron **21/21** casos y el typecheck pasó. T032 quedó verificado para el alcance web solicitado; no se atribuyen áreas seguras nativas ni locución de lector de pantalla a Chrome móvil.

Límite del modelo: una sola fila `WAITING`/`LOADED` vigente por pasaporte y límite Feature 008 positivo impiden fabricar legalmente un segundo primer partido que colme el período o una combinación mixta que sobrepase una nueva regla. No se insertaron filas inválidas ni se debilitó el esquema. El rechazo defensivo se comprueba con conteos sintéticos etiquetados como prueba unitaria.

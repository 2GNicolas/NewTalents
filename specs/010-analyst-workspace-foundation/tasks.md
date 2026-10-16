# Tasks: Espacio de trabajo del Analista

**Input**: `specs/010-analyst-workspace-foundation/spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/analyst-workspace.openapi.yaml`, `contracts/analyst-workspace-ui.md` y `quickstart.md`.

**Scope**: Lectura autenticada de Inicio, Pasaportes y Partidos de pasaportes `ACTIVE` bajo custodia vigente del Analista. Feature 009 es la fuente de partidos disponible hoy; no se crean partidos posteriores, análisis, borradores ni acciones de captura, carga, programación, aprobación, continuación o historial.

**Tests**: La especificación y el plan exigen contrato, integración PostgreSQL, privacidad, revocación, frontend y comparación web autenticada en escritorio/viewport móvil. Escribir pruebas enfocadas antes de implementar cada historia. Las suites que usan PostgreSQL se ejecutan secuencialmente con una base temporal aislada. Generar esta lista no ejecuta pruebas.

## Phase 1: Setup (infraestructura de prueba compartida)

**Purpose**: Preparar datos sintéticos y verificación aislada sin crear entidades persistentes nuevas.

- [X] T001 Preparar fixtures de Analista activo/inactivo, rol vigente/revocado, pasaportes `ACTIVE` propios/ajenos/sin custodia, `FirstMatch` `WAITING`/`LOADED`/`CANCELED`, adulto `SELF`, menor personal con representante y academia adulta/menor con responsable y cuenta adicional en `apps/backend/test/analyst-workspace-test-helpers.ts`; completion: ninguna fixture requiere datos personales reales ni filas inválidas.
- [X] T002 Adaptar el patrón de base PostgreSQL temporal de `apps/backend/test/integration/run-feature-009-foundation.mjs` a un runner exclusivo de Feature 010 en `apps/backend/test/integration/run-feature-010-workspace.mjs`; completion: aplica migraciones existentes a la base aislada, ejecuta suites Feature 010 secuencialmente y elimina solo esa base al terminar.

---

## Phase 2: Foundational (bloquea las cuatro historias)

**Purpose**: Establecer autorización de lectura por recurso, proyección mínima y fuente de partidos independiente del orden.

### Focused tests (antes de la base de implementación)

- [X] T003 [P] Probar identidad `ACTIVE`, rol `ANALYST` vigente, perfil operativo, pasaporte `ACTIVE`, custodia actual y denegación uniforme para ID ajeno/inexistente en `apps/backend/src/analyst-workspace/application/analyst-workspace-access.spec.ts`; completion: rol visual, sesión previa, responsabilidad Feature 005 o custodia histórica no conceden acceso.
- [X] T004 [P] Probar el adaptador de `FirstMatch` y su interfaz de fuente extensible en `apps/backend/src/analyst-workspace/persistence/confirmed-match-source.spec.ts`; completion: `WAITING`/`LOADED` confirmados son legibles, `CANCELED` no entra en agenda, una fuente posterior sintética solo prueba la interfaz y ningún `findCurrent` restringe semánticamente la lectura al primer partido.

### Shared implementation

- [X] T005 Implementar lectura consistente con sesión/identidad/rol/perfil y `PlayerPassport.state = ACTIVE` + `PassportCustody.currentAnalystIdentityId = actor` en `apps/backend/src/analyst-workspace/application/analyst-workspace-access.ts`; completion: cada colección y enlace directo revalida autoridad, y los IDs ajenos, inexistentes o no vigentes comparten `404` mínimo sin reutilizar autorización del responsable ni DTO administrativo de Feature 007.
- [X] T006 Implementar proyección de partido confirmada y paginable a partir de `FirstMatch` en `apps/backend/src/analyst-workspace/persistence/confirmed-match-source.ts`; completion: conserva identidad de fuente y partido, `matchDate: YYYY-MM-DD`, `matchTime: HH:mm`, rival/competencia/sede con `maxLength: 160`, estado seguro `WAITING | LOADED`, no expone unidad/cupo/carga y admite futuras fuentes autoritativas sin fabricar filas ni programar partidos.
- [X] T007 Registrar el módulo de lectura y reutilizar únicamente servicios/hechos necesarios de custodia, identidad y Feature 009 en `apps/backend/src/analyst-workspace/analyst-workspace.module.ts` y `apps/backend/src/app.module.ts`; completion: no hay ruta de escritura, tabla, migración ni cambio en autorización de Features 005/007/009.

**Checkpoint**: Existe una frontera de lectura mínima y autorizada por pasaporte antes de construir las tres vistas.

---

## Phase 3: User Story 1 — Entrar y consultar Inicio (P1, MVP)

**Goal**: Entrada autenticada con Análisis pendientes, Próximos partidos y Análisis realizados honestamente no disponible.

**Independent test**: Un `WAITING` propio aparece solo en Próximos antes de `matchDate + matchTime` en `America/Bogota`, solo en Pendientes desde ese instante y en ninguna tras carga válida; el Analista llega desde su entrada sin abrir administración.

### Focused tests (escribir antes de implementar)

- [X] T008 [P] [US1] Añadir contrato de `GET /analyst/workspace/overview` en `apps/backend/test/contract/analyst-workspace-overview.contract.spec.ts`; completion: `timeZone: America/Bogota`, secciones `pending`/`upcoming`/`completed`, `completed.availability: UNAVAILABLE`, `no-store`, errores seguros y ausencia de métricas, borradores o datos de contacto coinciden con `contracts/analyst-workspace.openapi.yaml`.
- [X] T009 [P] [US1] Añadir pruebas de reloj inyectado y clasificación por ID en `apps/backend/src/analyst-workspace/application/analyst-overview.spec.ts`; completion: `WAITING` justo antes, en y después de la hora local pasa de `UPCOMING` a `PENDING` sin doble conteo; `LOADED`/`CANCELED` no son pendientes ni realizados; página parcial no se presenta como total global.
- [X] T010 [P] [US1] Añadir pruebas de entrada/ruta y tres secciones en `apps/frontend/src/analyst-workspace/analyst-overview.spec.tsx`; completion: una identidad Analista activa abre Inicio; sin fuente de análisis confirmado no aparecen tarjetas, “Borrador guardado”, “Continuar” ni “Ver historial” funcionales.

### Implementation

- [X] T011 [US1] Implementar clasificación de fecha `YYYY-MM-DD` y hora `HH:mm` de `WAITING` con reloj actual en `America/Bogota` en `apps/backend/src/analyst-workspace/application/analyst-overview.ts`; completion: igualdad pertenece a Pendientes, `LOADED`/`CANCELED` quedan fuera, un ID se cuenta una vez y la zona del dispositivo no influye.
- [X] T012 [US1] Exponer el resumen de solo lectura con `Cache-Control: no-store` en `apps/backend/src/analyst-workspace/http/analyst-workspace.controller.ts`; completion: `GET /analyst/workspace/overview` usa T005/T006/T011, devuelve vistas vacías/no disponibles veraces y no usa el HTTP del responsable Feature 009.
- [X] T013 [US1] Añadir cliente tipado y estado efímero del resumen en `apps/frontend/src/analyst-workspace/analyst-workspace-api.ts` y `apps/frontend/src/analyst-workspace/analyst-workspace-state.ts`; completion: la clasificación viene del servidor, recarga/regreso reconsulta y `401/403/404` retiran datos protegidos previos.
- [X] T014 [US1] Integrar la entrada de Analista en `apps/frontend/src/authentication/authenticated-route-policy.ts`, `apps/frontend/app/(authenticated)/index.tsx` y `apps/frontend/app/(authenticated)/analyst/index.tsx`; completion: la ruta web real llega a Inicio con rol vigente, sin usar `_layout.tsx` ajeno como lugar de edición y sin tratar navegación cliente como permiso backend.
- [X] T015 [US1] Crear shell responsive e Inicio en `apps/frontend/src/analyst-workspace/analyst-workspace-shell.tsx` y `apps/frontend/src/analyst-workspace/analyst-overview.tsx`; completion: conserva jerarquía de `New Talents analyst workload overview-1.png` y `Mobile analyst dashboard with pending analyses-2.png`, sidebar escritorio/barra inferior móvil, “Ver calendario”, estados honestos y sin controles de análisis inexistentes.

  Verificación T015 (Chrome autenticado, 2026-10-15): a 1440 × 900 y 390 × 844 se compararon ambas referencias con una cuenta/pasaporte sintéticos en PostgreSQL aislado; saludo personalizado, tres secciones y navegación lateral/inferior presentes. “Ver calendario” abrió `/analyst/matches` con el partido autorizado; la sección de realizados indicó indisponibilidad y no hubo “Continuar” ni “Ver historial”. La última tarjeta móvil se alcanzó mediante desplazamiento. Diferencias visuales restantes: no se reproduce la fotografía de estadio ni la textura luminosa de los PNG, y el pie de la barra lateral no incluye avatar/cierre de sesión; los nombres, conteos y tarjetas ilustrativos no se copian por carecer de fuente. La base sintética se eliminó tras la comparación.

**Checkpoint**: US1 se verifica desde la entrada autenticada con Feature 009 como única fuente real; no depende de una lista de partidos posteriores.

---

## Phase 4: User Story 2 — Consultar Pasaportes bajo mi custodia (P1)

**Goal**: Mostrar solo pasaportes propios `ACTIVE`, nombre autorizado y contacto correcto únicamente en el detalle.

**Independent test**: Listar pasaportes propios/ajenos con estados de enriquecimiento distintos, abrir uno y comprobar teléfono/correo de la persona correspondiente; ausencia o ambigüedad da «Contacto no disponible» y retirar custodia niega el detalle.

### Focused tests (escribir antes de implementar)

- [X] T016 [P] [US2] Añadir contrato de `GET /analyst/workspace/passports` y `GET /analyst/workspace/passports/{passportId}` en `apps/backend/test/contract/analyst-workspace-passports.contract.spec.ts`; completion: cursor `maxLength: 500`, limit `minimum: 1`, `maximum: 50`, `default: 20`, `playerName minLength: 1`, `ACTIVE`, `ASSIGNED_TO_ACTOR`, contacto solo en detalle, `AVAILABLE` con al menos `phone` o `email`, `UNAVAILABLE` sin ambos y `no-store`/`404` seguro cumplen OpenAPI.
- [X] T017 [P] [US2] Añadir integración PostgreSQL de lista/detalle y nombre en `apps/backend/test/integration/analyst-workspace-passports.integration.spec.ts`; completion: incluye todos los `ACTIVE` propios aunque no estén `AWAITING_ANALYST_ENRICHMENT`, excluye ajenos/no activos, proyecta solo el nombre de `PlayerPrivateIdentity.encryptedLegalName` tras autorizar y no modifica pasaporte/custodia.
- [X] T018 [P] [US2] Añadir pruebas de selección de contacto para titular `SELF`, representante legal de menor personal y responsable de academia adulta/menor en `apps/backend/test/integration/analyst-workspace-contact.integration.spec.ts`; completion: ambos canales o solo uno corresponden a la misma identidad vigente, la cuenta adicional y el representante de menor de academia nunca sustituyen al responsable, persona ausente/ambigua o sin canales produce `UNAVAILABLE`, y no se usa un teléfono de solicitud no atribuible.
- [X] T019 [P] [US2] Añadir pruebas de tarjetas, detalle y contacto seguro en `apps/frontend/src/analyst-workspace/analyst-passports.spec.tsx`; completion: nombre autorizado en tarjeta, referencia complementaria, teléfono/correo solo en detalle, “Contacto no disponible” sin filtración y ningún control de asignación o decisión administrativa.

### Implementation

- [X] T020 [US2] Implementar colección paginada de `PlayerPassport` `ACTIVE` con custodia actual y proyección de nombre en `apps/backend/src/analyst-workspace/persistence/analyst-passport-read.repository.ts`; completion: no reutiliza el DTO administrativo ni filtra por `enrichmentStatus`, no serializa documento/fecha de nacimiento y obtiene `nextMatch?` solo de `WAITING` futuro autoritativo.
- [X] T021 [US2] Implementar selección de persona y canales en `apps/backend/src/analyst-workspace/application/analyst-work-contact.ts`; completion: origen personal adulto exige `SELF` único, personal menor `LEGAL_REPRESENTATIVE` actual único, origen academia responsable de `originAcademyId` identificable por solicitud aprobada y relación vigente; correo de credencial vigente y teléfono de solicitante aprobado atribuible a esa misma persona, ambos si existen, sin tomar creador del pasaporte, primera membresía, cuenta adicional o contacto directo del menor; ante ambigüedad/ausencia devuelve `UNAVAILABLE` sin valores.
- [X] T022 [US2] Exponer lista y detalle autorizados en `apps/backend/src/analyst-workspace/http/analyst-workspace.controller.ts`; completion: aplica T005/T020/T021 a ambos `GET`, restringe contacto a detalle, usa `no-store`, paginación acotada y `404` indistinguible para pasaporte inexistente/ajeno.
- [X] T023 [US2] Construir Pasaportes, tarjetas y detalle de solo lectura en `apps/frontend/app/(authenticated)/analyst/passports/index.tsx`, `apps/frontend/app/(authenticated)/analyst/passports/[passportId].tsx` y `apps/frontend/src/analyst-workspace/analyst-passports.tsx`; completion: sigue `Analyst passport custody dashboard.png` y `Active passport custody dashboard.png`, muestra nombre real/referencia/próximo partido confirmado, “Abrir pasaporte” y contacto correcto o no disponible sin datos administrativos.

**Checkpoint**: US2 presenta únicamente pasaportes bajo custodia actual; el dato privado de contacto nunca sale en una tarjeta, Inicio o agenda.

---

## Phase 5: User Story 3 — Consultar Partidos y abrir un partido (P1)

**Goal**: Agenda y detalle de todos los partidos confirmados disponibles bajo custodia, sin limitarse por orden ni crear una fuente posterior.

**Independent test**: Leer un primer partido `WAITING` de Feature 009, reagendar/cancelar/cargar mediante los dueños existentes y recargar; el estado visible se actualiza sin mutación por lectura ni datos deportivos inéditos.

### Focused tests (escribir antes de implementar)

- [X] T024 [P] [US3] Añadir contrato de `GET /analyst/workspace/matches` y `GET /analyst/workspace/matches/{matchId}` en `apps/backend/test/contract/analyst-workspace-matches.contract.spec.ts`; completion: cursor `maxLength: 500`, limit `minimum: 1`, `maximum: 50`, `default: 20`, `sourceKind: FIRST_MATCH`, `matchDate` fecha, `matchTime` `HH:mm`, rival/competencia/sede `maxLength: 160`, estado `WAITING | LOADED`, `no-store` y `404` seguro cumplen OpenAPI.
- [X] T025 [P] [US3] Añadir integración PostgreSQL de agenda/detalle en `apps/backend/test/integration/analyst-workspace-matches.integration.spec.ts`; completion: `WAITING` propio aparece, reagendamiento conserva ID y actualiza hora/datos, cancelación retira fila, `LOADED` muestra solo estado permitido, ajeno/inexistente se ocultan y los `GET` no crean partidos, cupo ni carga.
- [X] T026 [P] [US3] Añadir pruebas de agenda, agrupación y detalle en `apps/frontend/src/analyst-workspace/analyst-matches.spec.tsx`; completion: fecha/hora local, rival, competencia, sede, estado y “Ver partido” provienen de API, no hay filas posteriores ilustrativas ni botones de programación/captura.

### Implementation

- [X] T027 [US3] Implementar consulta paginada/detalle por ID sobre T006 con autorización del pasaporte en `apps/backend/src/analyst-workspace/application/analyst-matches.ts`; completion: no impone `findCurrent` como límite de alcance, filtra `CANCELED` de agenda, minimiza campos de `LOADED` y deja una interfaz para futuras fuentes autorizadas sin registrarlas ni simularlas.
- [X] T028 [US3] Añadir handlers de agenda y detalle en `apps/backend/src/analyst-workspace/http/analyst-workspace.controller.ts`; completion: `GET /analyst/workspace/matches` y `/{matchId}` revalidan custodia e identidad, devuelven solo proyección segura `no-store` y no exponen métodos de modificación.
- [X] T029 [US3] Construir Partidos y detalle en `apps/frontend/app/(authenticated)/analyst/matches/index.tsx`, `apps/frontend/app/(authenticated)/analyst/matches/[matchId].tsx` y `apps/frontend/src/analyst-workspace/analyst-matches.tsx`; completion: agenda agrupada por fecha y navegación de solo lectura siguen `Emerald Match Agenda for Analysts.png` y `New Talents match agenda.png`, sin priorización/filtros no aprobados, datos ficticios o métricas no publicadas.

**Checkpoint**: US3 funciona con Feature 009 hoy y no convierte esa fuente en límite de producto para registros autoritativos posteriores.

---

## Phase 6: User Story 4 — Revocación y privacidad en todas las vistas (P1)

**Goal**: Pérdida de custodia, rol o identidad retira lista, resúmenes y detalles en la siguiente consulta sin distinguir ID ajeno de inexistente.

**Independent test**: Con Inicio, Pasaportes, Partidos y un enlace directo visibles, retirar/cambiar custodia o revocar rol/identidad; refrescar con la misma sesión y comprobar denegación y eliminación local de nombre/contacto/partido.

### Focused tests (escribir antes de implementar)

- [X] T030 [P] [US4] Añadir contrato transversal de errores y minimización en `apps/backend/test/contract/analyst-workspace-privacy.contract.spec.ts`; completion: `401/403/404/503` y consulta inválida no filtran existencia ni datos civiles; cuerpos de éxito contienen solo nombre y contacto permitidos, no documento, evidencia, actor, historial de custodia, cupo, carga interna ni métricas; todos llevan `no-store` y no hay endpoints de escritura.
- [X] T031 [P] [US4] Añadir integración PostgreSQL de cambio/retiro de custodia, revocación de rol e inactivación en `apps/backend/test/integration/analyst-workspace-revocation.integration.spec.ts`; completion: siguiente petición de colección/detalle/enlace directo ya no devuelve nombre, contacto o partido; recursos ajenos e inexistentes responden igual y no hay efectos de lectura en el estado persistido.
- [X] T032 [P] [US4] Añadir pruebas de limpieza del cliente y retorno seguro en `apps/frontend/src/analyst-workspace/analyst-workspace-revocation.spec.tsx`; completion: `401/403/404`, cambio de contexto, recarga y regreso no mantienen tarjetas, detalle ni contacto previo en ninguna de las tres vistas.

### Implementation

- [X] T033 [US4] Completar denegaciones seguras y proyección de campos mínimos para todas las rutas en `apps/backend/src/analyst-workspace/application/analyst-workspace-access.ts` y `apps/backend/src/analyst-workspace/http/analyst-workspace.controller.ts`; completion: cada respuesta revalida hechos actuales, ID ajeno/inexistente es indistinguible y no se serializan filas Prisma completas o mensajes de error internos.
- [X] T034 [US4] Completar invalidación efímera y estados de restricción/error en `apps/frontend/src/analyst-workspace/analyst-workspace-state.ts` y `apps/frontend/src/analyst-workspace/analyst-workspace-shell.tsx`; completion: al perder acceso se borra nombre/contacto/partido antes de navegar, sin caché local protegida ni reutilizar una respuesta previa como autoridad.

**Checkpoint**: US4 protege independientemente las tres vistas y enlaces directos tras cambios de autoridad.

---

## Final phase: Verificación transversal y cierre de evidencia

**Purpose**: Comparar la experiencia real con diseño y reconciliar todos los criterios sin afirmar fuentes o acciones futuras.

- [X] T035 [P] Ejecutar las suites de contrato e integración Feature 010 mediante `apps/backend/test/integration/run-feature-010-workspace.mjs` y registrar resultados en `specs/010-analyst-workspace-foundation/verification/backend.md`; completion: PostgreSQL temporal y suites secuenciales, autorización, contacto, límites `America/Bogota`, lectura sin mutación y respuestas privadas con resultados pasados/fallidos explícitos.
- [X] T036 [P] Ejecutar pruebas frontend enfocadas y typechecks indicados por `specs/010-analyst-workspace-foundation/quickstart.md` y registrar resultados en `specs/010-analyst-workspace-foundation/verification/frontend.md`; completion: navegación y estados por ruta, limpieza tras revocación y ausencia de acciones futuras tienen evidencia reproducible; el cambio ajeno en `apps/frontend/app/_layout.tsx` permanece intacto.
- [X] T037 Comparar la ruta autenticada real de Inicio, Pasaportes y Partidos en escritorio/viewport móvil con `docs/design/analist/New Talents analyst workload overview-1.png`, `docs/design/analist/Mobile analyst dashboard with pending analyses-2.png`, `docs/design/analist/Analyst passport custody dashboard.png`, `docs/design/analist/Active passport custody dashboard.png`, `docs/design/analist/Emerald Match Agenda for Analysts.png` y `docs/design/analist/New Talents match agenda.png`, y registrar capturas/hallazgos en `specs/010-analyst-workspace-foundation/verification/visual-review.md`; completion: sidebar/barra inferior, safe areas, teclado/foco/árbol de accesibilidad, estados carga/vacío/error/restricción/indisponibilidad y ausencia de acciones falsas se comprueban en runtime; tests unitarios, typecheck o export web no sustituyen comparación visual y no se alteran los PNG.
- [X] T038 Reconciliar US1–US4, FR-001–014 y SC-001–007 contra `specs/010-analyst-workspace-foundation/quickstart.md` en `specs/010-analyst-workspace-foundation/verification/acceptance.md`; completion: cada criterio consta como pasó/falló/no verificado con evidencia, la limitación de teléfono histórico y responsable de academia no identificable se declara sin atribución ajena, y no se afirma existencia de análisis, borradores, historial ni partidos posteriores.

---

## Dependencies & execution order

| Phase | Prerequisite | Independent outcome |
|---|---|---|
| Setup | None | Fixtures y runner PostgreSQL aislado |
| Foundation | T001–T002 | Autorización por recurso y fuente de partidos reutilizables |
| US1 | T003–T007 | Inicio autenticado, categorías temporales y estados honestos |
| US2 | Foundation; shell/cliente de US1 para navegación | Cartera propia y contacto seguro en detalle |
| US3 | Foundation; shell/cliente de US1 para navegación | Agenda y detalle de partidos disponibles |
| US4 | US1–US3 para comprobar todas las superficies | Revocación transversal sin datos retenidos |
| Final | Historias pertinentes completas | Evidencia PostgreSQL, frontend, visual y aceptación |

Dentro de cada historia, escribir primero sus pruebas enfocadas; después implementar persistencia/consulta, aplicación, HTTP y UI. US2 y US3 pueden avanzar en paralelo después de la base y el shell compartidos, evitando ediciones concurrentes del controlador. Las pruebas que comparten PostgreSQL se ejecutan **secuencialmente**. `T037` exige navegador autenticado real, no inferencia visual por tests. No editar `apps/frontend/app/_layout.tsx` ni convertir datos ilustrativos en registros.

## Parallel examples

- **Foundation**: T003 y T004 usan archivos de prueba distintos; T005 y T006 usan módulos distintos después de ellas.
- **US1**: T008, T009 y T010 prueban contrato, clasificación y frontend en archivos distintos antes de T011–T015.
- **US2**: T016–T019 pueden escribirse en paralelo; T020 y T021 se separan en consulta de pasaportes y selección de contacto antes de T022–T023.
- **US3**: T024–T026 pueden escribirse en paralelo; T027 precede T028 y T029.
- **US4**: T030–T032 se escriben en archivos independientes antes de cerrar T033–T034.
- **Final**: T035 y T036 registran evidencias distintas; T037 requiere la aplicación funcional, y T038 consolida las tres fuentes de evidencia.

## Implementation strategy

1. Completar Setup/Foundation, luego US1 como MVP verificable: entrada autenticada, clasificación correcta y tres secciones sin datos inventados.
2. Añadir US2 y US3 como lecturas independientes sobre la misma frontera de custodia; contacto solo en detalle del pasaporte y agenda sin restricción por orden.
3. Completar US4 y verificación enfocada. Ninguna tarea incorpora captura, programación posterior, FEM, pagos, publicación, borradores, “Continuar” o “Ver historial”.

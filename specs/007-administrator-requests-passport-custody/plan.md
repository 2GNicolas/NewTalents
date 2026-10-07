# Implementation Plan: Interfaz administrativa de solicitudes y custodia de pasaportes

**Branch**: `feature/007-administrator-requests-passport-custody` | **Date**: 2026-09-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-administrator-requests-passport-custody/spec.md`

## Summary

Feature 007 reorganiza la operación administrativa existente sin alterar el ciclo de registro y aprobación de Feature 006, añade una consulta independiente y de solo lectura para expedientes confirmados, y crea una custodia explícita entre cada pasaporte básico activo y como máximo un Analista elegible. La solución conserva NestJS, Prisma/PostgreSQL y Expo Router; añade modelos aditivos para progreso operativo, perfil visible del Analista, estado de custodia e historial inmutable; extiende contratos y autorización con hechos de recurso; y hace que la lista y apertura de pasaportes del Analista dependan en tiempo real de la custodia vigente.

La interfaz reutiliza las operaciones de revisión, corrección, rechazo, expediente, eliminación y aprobación existentes. `docs/design/admin-custody/` es la única autoridad visual: proporciona el shell administrativo, la jerarquía, la composición responsiva y la interacción de selección por arrastre. Cuando una referencia muestra acciones sobre expedientes pendientes que la especificación excluye, se conserva su lenguaje visual pero prevalece el alcance funcional aprobado: Expedientes es una consulta de registros ya confirmados, sin edición ni confirmación nueva.

## Technical Context

**Language/Version**: Node.js `>=24.11 <25`; TypeScript 5.9 en backend y TypeScript 6.0 en frontend

**Primary Dependencies**: NestJS 11, Prisma 7, PostgreSQL/`pg` 8, Zod 4, Expo 57, Expo Router 57, React 19, React Native 0.86 y React Native Web 0.21

**Storage**: PostgreSQL para solicitudes, expedientes confirmados, perfiles operativos, custodia e historial; sin nuevo almacenamiento de documentos

**Testing**: Vitest para unidad/contrato/integración PostgreSQL; Jest y React Native Testing Library para estado/componentes Expo; validación web y móvil proporcional

**Target Platform**: API NestJS en Node.js; Expo web y aplicaciones iOS/Android

**Project Type**: Monorepo de aplicación móvil/web más API

**Performance Goals**: búsqueda y apertura de solicitud, expediente o pasaporte en menos de 30 segundos con hasta 1.000 registros; páginas estables de 20 elementos por defecto y máximo 50; recuentos de carga obtenidos de custodias vigentes

**Constraints**: autorización backend por capacidades y hechos; respuestas administrativas `no-store`; una sola custodia vigente; concesión/revocación inmediata sin depender de JWT; confirmación obligatoria antes de mutar; cero exposición de evidencias eliminadas, documentos civiles, contactos o credenciales; ningún cambio a las reglas de Feature 006
**Scale/Scope**: siete tipos de solicitud existentes, cinco grupos operativos, consulta lista/detalle de expedientes confirmados, pasaportes activos pendientes de enriquecimiento, Analistas elegibles y cuatro destinos administrativos (`Inicio`, `Solicitudes`, `Expedientes`, `Custodia`)

## Constitution Check

*GATE: evaluado antes de Phase 0 y revalidado después de Phase 1.*

| Gate | Resultado | Evidencia del plan |
|---|---|---|
| Especificación aprobada y alcance acotado | PASS | Se planifica únicamente `spec.md`; no se añade edición de expedientes, enriquecimiento, asignación automática ni cambios de aprobación. |
| Pasaporte como objeto central | PASS | La custodia es una relación de autoridad sobre el pasaporte existente; no crea otro pasaporte ni información deportiva. |
| Privacidad y autorización explícita | PASS | Dossier y custodia tienen capacidades propias; el acceso del Analista requiere rol activo **y** custodia vigente; las proyecciones son mínimas. |
| Arquitectura explícita y simple | PASS | Se mantienen NestJS/Prisma/Expo y módulos existentes; solo se añaden modelos y servicios requeridos por brechas comprobadas. |
| Consistencia web/móvil y accesibilidad | PASS | Arrastre es una mejora de escritorio; móvil, teclado y lector usan la misma selección/confirmación mediante acciones semánticas. |
| Verificación proporcional | PASS | Quickstart y contratos cubren regresión de Feature 006, privacidad, concurrencia, idempotencia, accesibilidad y navegación estable. |
| Autoridad documental | PASS | `spec.md` gobierna funcionalidad; `docs/design/admin-custody/` gobierna únicamente la presentación. Las imágenes de Feature 006 no se usan. |
| Cambio controlado | PASS | Las nuevas capacidades y persistencia quedan documentadas aquí y en contratos/modelo antes de tareas o implementación. |

**Revisión posterior al diseño**: PASS. Los contratos mantienen las mutaciones de Feature 006 intactas, el modelo es aditivo y las decisiones de privacidad y concurrencia están expresadas en artefactos versionables. No se requiere excepción constitucional.

## Existing Baseline and Confirmed Gaps

### Reutilización obligatoria

- `AdminRegistrationReviewController`, `AdminRegistrationReviewService`, `AdminRegistrationDecisionService` y `ApprovalExecutionService` continúan siendo los únicos límites para revisar, corregir, rechazar, confirmar expediente, eliminar evidencias y aprobar.
- `RegistrationManualDossierConfirmation`, `RegistrationApprovalExecution`, eventos y registros de eliminación son la fuente de la consulta de expedientes; la consulta no crea ni modifica esos registros.
- `PlayerPassport`, `PlayerPrivateIdentity`, `PassportAuthorizationAdapter` y las proyecciones existentes siguen siendo la fuente del pasaporte. Los enlaces solicitud–jugador–pasaporte se obtienen de `RegistrationRequestPlayer.linkedPlayerId` y `Player.passport`.
- El evaluador de Feature 002 continúa siendo la autoridad; la UI solo consume capacidades proyectadas.

### Brechas que requieren diseño aditivo

1. No existen endpoints ni servicio de lista/detalle para expedientes confirmados.
2. No existe una relación de custodia vigente, su versión optimista ni un historial inmutable de asignación/cambio/retiro.
3. `passport.review` y `PlayerPassportService.listAccessible` conceden actualmente acceso general a identidades con rol `ANALYST`; deben exigir custodia activa para cada pasaporte.
4. La solicitud no conserva progreso operativo de revisión, por lo que `SUBMITTED` no basta para separar de forma autoritativa `NEW` de `CONTINUE_REVIEW` o `READY_FOR_DECISION`.
5. `Identity` no dispone de una etiqueta operativa mínima para mostrar Analistas. Se requiere un perfil administrativo explícito; no se usará correo, credencial ni identidad civil como sustituto.
6. `RegistrationApprovalExecution.resultReferences` es JSON y no todos los siete resultados crean pasaporte. La navegación de expedientes usará la relación tipada solicitud–jugador–pasaporte cuando exista y proyectará `notApplicable` cuando el tipo aprobado no produzca pasaporte; nunca inventará uno.

## Architecture and Integration Plan

### 1. Solicitudes administrativas

- Extender la consulta administrativa con una proyección `operationalGroup`, `nextAction`, referencia enmascarada, etiqueta visible permitida y contexto mínimo.
- Persistir `RegistrationAdminReviewProgress` separado del historial de ciclo de vida. Solo registra `OPENED` o `REVIEWED`; no cambia estado, versión de negocio, capacidades de decisión ni historial visible de Feature 006.
- Derivar los cinco grupos combinando estado de solicitud, progreso operativo y estado técnico de aprobación/eliminación. Las acciones siguen navegando a las pantallas y endpoints existentes.
- Mantener la vista completa con cursor estable y filtros; el panel agrupado es una proyección secundaria, no otro flujo de decisión.

### 2. Consulta independiente de expedientes

- Corrección de aceptación: añadir `dossierName` opcional a `RegistrationManualDossierConfirmation` para compatibilidad histórica; exigir un nombre acotado y no vacío en nuevas aprobaciones, grabarlo en la misma transacción de confirmación y proyectarlo solo en consultas administrativas autorizadas. Mantener `displayLabel` de persona separado. Ampliar búsqueda por nombre de expediente sin cambiar la paginación ni las decisiones de aprobación.

- Crear un servicio de lectura dentro de `registration-requests` que consulte únicamente `RegistrationManualDossierConfirmation` existentes y autorizadas.
- Derivar estado e historial seguro desde confirmación, ejecución de aprobación, eventos de solicitud y estado agregado de eliminación. No leer ni devolver `RegistrationEvidenceItem.objectKey`, bytes, nombres originales ni evidencias borradas.
- Usar cursor `(confirmedAt, id)` descendente. El frontend mantiene una pila de cursores para navegación anterior/siguiente y restaura búsqueda, filtros, cursor y desplazamiento al volver desde detalle.
- Resolver búsqueda de nombres permitidos en el backend mediante lectura por bloques con descifrado únicamente después de autorización; filtrar y continuar bloques hasta completar la página. Así no se introduce un índice en texto claro sobre identidad protegida.
- Proyectar enlaces seguros a solicitud y, solo cuando el resultado tipado produjo uno, al pasaporte existente. Los tipos sin pasaporte muestran vínculo no aplicable.

### 3. Custodia de pasaportes

- Crear un módulo acotado `passport-custody` que dependa de `PlayerPassportModule`, `AuthorizationModule` y `DatabaseModule`, sin introducir lógica deportiva ni de aprobación.
- Tratar como elegible para recibir custodia a una identidad `ACTIVE` con asignación `ANALYST` activa y `AnalystOperationalProfile`; revalidar estos hechos dentro de cada transacción.
- Representar la autoridad vigente en una fila única por pasaporte (`PassportCustody`) y cada mutación confirmada en `PassportCustodyEvent` inmutable.
- Bloquear la fila del `PlayerPassport`, comparar `expectedVersion`, revalidar pasaporte/Analista, actualizar estado e insertar exactamente un evento en una sola transacción serializable. Reintentar únicamente conflictos serializables acotados; un estado vencido produce conflicto recuperable.
- Usar `idempotencyKey` único en el evento. Una repetición con la misma intención devuelve la proyección ya aplicada; reutilizar la clave con otro contenido produce conflicto sin mutación.
- Calcular cargas mediante conteo de `PassportCustody.currentAnalystIdentityId` no nulo; no mantener contadores duplicados.

### 4. Acceso inmediato del Analista

- Añadir el hecho `analystCustodyActive` al adaptador de autorización de pasaportes.
- Para `passport.review`, detalle, presentación, historial interno y lista de trabajo del Analista, exigir identidad/rol activos y custodia actual coincidente. Administrador conserva sus capacidades administrativas explícitas por reglas separadas.
- Consultar la custodia en cada petición protegida. Asignar concede acceso al confirmar; cambiar o retirar lo revoca inmediatamente, sin esperar refresco de token ni decodificar roles en frontend.
- Actualizar `PlayerPassportService.listAccessible` para que la rama Analista filtre por custodia, mientras los accesos USER, academia, representante y Administrador mantienen sus reglas actuales.

### 5. Expo y autoridad visual

- Añadir un shell administrativo compartido con rutas para Inicio, Solicitudes, Expedientes y Custodia; escritorio usa navegación lateral y móvil navegación inferior según `docs/design/admin-custody/`.
- Adaptar el inbox existente a grupos operativos y conservar los componentes/estados de decisión de Feature 006.
- Implementar estados dedicados para lista/detalle de expedientes y workspace/detalle de custodia, con carga, vacío, restringido, conflicto, error recuperable e indisponible.
- En web de escritorio, el gesto de arrastre solo selecciona un Analista y abre confirmación. La selección se implementa como mejora progresiva sobre la misma acción semántica; botones, teclado y lector abren el selector equivalente. En móvil se muestran `Asignar Analista`/`Cambiar Analista`; no se exige arrastre.
- Mantener la selección temporal solo en memoria; el motivo aplica únicamente a cambio o retiro. Cancelar o desmontar limpia esos valores sin llamar al comando.

## Contract Strategy

- [admin-custody.openapi.yaml](./contracts/admin-custody.openapi.yaml): lista/grupos de solicitudes, progreso operativo, expedientes, Analistas, pasaportes en custodia, detalle/historial y comandos confirmados.
- [authorization.md](./contracts/authorization.md): capacidades, hechos de recurso y matriz de acceso para Administrador y Analista.
- [frontend-state.md](./contracts/frontend-state.md): estados, restauración de navegación, selección temporal, confirmación, conflicto e interacción accesible.
- Los contratos de Feature 006 no cambian. Los nuevos endpoints llaman o enlazan sus resultados, pero no duplican sus reglas.

## Verification Strategy

- Unidad: derivación de grupos, estado de expediente, referencias enmascaradas, validación de motivo para cambio/retiro, elegibilidad, transición de custodia e idempotencia.
- Autorización: capacidades administrativas, dossier de solo lectura, custodia por recurso, denegación por rol sin hechos y revocación inmediata.
- Contrato: OpenAPI cerrado, límites de cursor/motivo, respuestas `no-store`, errores indistinguibles y ausencia de campos protegidos.
- Integración PostgreSQL secuencial: unicidad por pasaporte, carreras entre Administradores, reintento serializable, idempotencia, cargas activas, historial único y enlaces de expediente.
- Frontend: grupos y filtros, restauración de lista, selección por arrastre sin persistencia, alternativa móvil/teclado, confirmación/cancelación, conflicto y estados vacíos/error.
- Regresión enfocada: decisiones y eliminación de Feature 006 producen los mismos resultados; acceso USER/academia/representante/Administrador de Feature 005 no cambia; solo se restringe la rama Analista al pasaporte bajo custodia.
- Visual/accesibilidad: comparación uno a uno únicamente con las 12 referencias de `docs/design/admin-custody/`, documentando los elementos visuales fuera de alcance funcional como no interactivos/no implementados.

## Project Structure

### Documentation (this feature)

```text
specs/007-administrator-requests-passport-custody/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── admin-custody.openapi.yaml
│   ├── authorization.md
│   └── frontend-state.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
apps/backend/
├── prisma/
│   ├── schema.prisma
│   └── migrations/                         # created later during implementation
├── src/
│   ├── authorization/
│   │   ├── authorization.contract.ts
│   │   ├── authorization.service.ts
│   │   └── permission-catalog.ts
│   ├── registration-requests/
│   │   ├── http/admin-registration-review.controller.ts
│   │   ├── persistence/registration-request.repository.ts
│   │   └── review/
│   │       ├── admin-registration-query.service.ts
│   │       ├── admin-registration-review.service.ts
│   │       ├── admin-review-progress.service.ts
│   │       └── admin-dossier-query.service.ts
│   ├── passport-custody/
│   │   ├── domain/
│   │   ├── application/
│   │   ├── persistence/
│   │   ├── authorization/
│   │   └── http/
│   └── player-passport/
│       ├── passport-authorization/passport-authorization.adapter.ts
│       └── player-passport.service.ts
└── test/
    ├── contract/
    └── integration/

apps/frontend/
├── app/(admin)/admin/
│   ├── index.tsx
│   ├── registration/
│   ├── dossiers/
│   └── custody/
└── src/administrator/
    ├── shell/
    ├── requests/
    ├── dossiers/
    └── custody/
```

**Structure Decision**: Se mantienen los dos workspaces existentes. Las consultas de solicitudes y expedientes permanecen en el contexto `registration-requests`; la custodia recibe un módulo backend propio por ser una autoridad nueva sobre pasaportes. El frontend reúne el shell y las nuevas vistas bajo `src/administrator`, mientras los componentes de decisión de Feature 006 se reutilizan desde `src/registration-requests/admin`.

## Complexity Tracking

No hay violaciones constitucionales que requieran excepción. El nuevo módulo de custodia y sus cuatro modelos son necesarios para autoridad por recurso, concurrencia, idempotencia, etiqueta operativa y auditoría; no se introduce otro servicio desplegable, caché, cola ni dependencia de UI.

# Data Model: Feature 007

## Principles

- Los modelos son aditivos; no se reescriben solicitudes, confirmaciones, ejecuciones, pasaportes, responsabilidades ni eventos existentes.
- `RegistrationRequest` conserva su estado y versión de negocio de Feature 006.
- `PlayerPassport` continúa siendo el recurso protegido. La custodia no crea pasaportes ni datos deportivos.
- La autoridad actual se consulta desde estado relacional; la auditoría se conserva en eventos inmutables.
- Ausencia de hechos suficientes deniega acceso.

## Existing entities reused

### RegistrationManualDossierConfirmation

Corrección de aceptación: `dossierName String? @db.VarChar(180)` almacena el nombre propio introducido por el Administrador. Es nullable únicamente para expedientes anteriores a esta corrección; no se rellena a partir de nombres de personas ni referencias. Las nuevas confirmaciones requieren nombre no vacío de máximo 180 caracteres.

Fuente autoritativa de que un expediente manual fue confirmado para una versión de solicitud. Se reutilizan `id`, `requestId`, `requestVersion`, `administratorIdentityId` y `confirmedAt`. `transferredCategories` y `declarationVersion` no se incluyen en la consulta independiente salvo que una futura especificación los autorice.

### RegistrationApprovalExecution

Proporciona estado técnico y momento de finalización. `resultReferences` no se trata como relación autoritativa; la navegación al pasaporte usa relaciones tipadas.

### RegistrationRequest / RegistrationRequestPlayer / Player / PlayerPassport

Proporcionan tipo, estado, referencia enmascarable, jugador vinculado y pasaporte producido. `RegistrationRequestPlayer.linkedPlayerId` puede ser nulo antes de la aprobación y los tipos sin jugador no producen pasaporte.

### RegistrationEvidenceDeletionRecord / RegistrationRequestEvent

Proporcionan hitos seguros de eliminación y aprobación. La consulta no recupera objetos eliminados ni metadatos privados de evidencia.

## New entity: RegistrationAdminReviewProgress

Estado de presentación para agrupar solicitudes sin modificar el agregado de Feature 006.

| Field | Type | Rules |
|---|---|---|
| `requestId` | UUID, PK/FK | Una fila por `RegistrationRequest`; `ON DELETE RESTRICT`. |
| `stage` | enum | `OPENED` o `REVIEWED`. Monótono dentro de la misma versión observada. |
| `observedRequestVersion` | integer | Versión sobre la que se registró el progreso. |
| `startedByIdentityId` | UUID FK | Administrador que inició la revisión. |
| `lastUpdatedByIdentityId` | UUID FK | Administrador de la última actualización operativa. |
| `startedAt` | timestamp | Inmutable. |
| `updatedAt` | timestamp | Último progreso. |

Cuando `RegistrationRequest.version` cambia por corrección/resubmisión, el progreso previo no se reutiliza para presentar la nueva versión como revisada; la proyección lo trata como `NEW` hasta registrar progreso para la versión actual.

### Operational group derivation

1. `WAITING_EVIDENCE_DELETION`: `approvalExecutionStatus` es `DELETING_EVIDENCE` o `RECOVERY_REQUIRED`.
2. `REQUIRES_CORRECTION`: solicitud en `REQUIRES_CORRECTION`.
3. `READY_FOR_DECISION`: solicitud `SUBMITTED` y progreso actual `REVIEWED`.
4. `CONTINUE_REVIEW`: solicitud `SUBMITTED` y progreso actual `OPENED`.
5. `NEW`: solicitud `SUBMITTED` sin progreso para la versión actual.

Las solicitudes terminales permanecen en la vista completa, no en la cola operativa.

## New entity: AnalystOperationalProfile

Etiqueta mínima autorizada para operación administrativa.

| Field | Type | Rules |
|---|---|---|
| `identityId` | UUID, PK/FK | Una fila por `Identity`; `ON DELETE RESTRICT`. |
| `displayLabel` | varchar(120) | Etiqueta operativa no vacía, por ejemplo `Laura M.`; no correo ni documento. |
| `normalizedLabel` | varchar(120) | Normalización para búsqueda/orden; visible solo al backend. |
| `createdAt` | timestamp | Creación. |
| `updatedAt` | timestamp | Última actualización. |

La elegibilidad no se almacena en el perfil: se deriva en tiempo real de identidad activa + rol ANALYST activo + perfil existente.

## New entity: PassportCustody

Estado actual de autoridad del Analista sobre un pasaporte.

| Field | Type | Rules |
|---|---|---|
| `id` | UUID PK | Identificador interno. |
| `passportId` | UUID FK, unique | Como máximo una fila de estado por `PlayerPassport`; `ON DELETE RESTRICT`. |
| `currentAnalystIdentityId` | UUID FK nullable | Nulo significa `UNASSIGNED`; nunca se acepta sin elegibilidad revalidada. |
| `version` | integer | Comienza en 0; incrementa exactamente una vez por asignar, cambiar o retirar. |
| `assignedAt` | timestamp nullable | Momento de la asignación vigente; nulo sin custodia. |
| `updatedAt` | timestamp | Última transición. |

Índices:

- unique `passportId`.
- `(currentAnalystIdentityId, updatedAt, passportId)` para carga/listas.
- `(updatedAt, passportId)` para navegación estable.

Los pasaportes existentes sin fila se proyectan como `UNASSIGNED`, versión 0. La primera mutación crea la fila dentro de la transacción bloqueada. Esto evita modificar la aprobación de Feature 006.

## New entity: PassportCustodyEvent

Auditoría append-only y registro de idempotencia de comandos aplicados.

| Field | Type | Rules |
|---|---|---|
| `id` | UUID PK | Identificador del evento. |
| `passportId` | UUID FK | Recurso afectado. |
| `sequence` | integer | Secuencia creciente por pasaporte; unique `(passportId, sequence)`. |
| `action` | enum | `ASSIGNED`, `CHANGED`, `REMOVED`. |
| `administratorIdentityId` | UUID FK | Actor autorizado. |
| `previousAnalystIdentityId` | UUID FK nullable | Destino anterior mínimo. |
| `nextAnalystIdentityId` | UUID FK nullable | Destino nuevo; nulo solo para `REMOVED`. |
| `safeReason` | varchar(500), nullable | Nulo para `ASSIGNED`; obligatorio, recortado y sin datos personales innecesarios para `CHANGED` y `REMOVED`. |
| `expectedVersion` | integer | Versión presentada por el cliente. |
| `resultingVersion` | integer | Versión posterior; `expectedVersion + 1`. |
| `idempotencyKey` | UUID unique | Una intención aplicada una sola vez. |
| `createdAt` | timestamp | Momento autoritativo del servidor. |

Índices:

- unique `idempotencyKey`.
- unique `(passportId, sequence)`.
- `(passportId, createdAt, id)` para historial estable.
- `(administratorIdentityId, createdAt)` para auditoría interna.

No se registra evento para selección, cancelación, validación fallida ni error transaccional. El hito “pasaporte creado — sin asignar” se deriva de `PlayerPassport.createdAt`, no se inventa como evento de custodia.

## State transitions

```text
UNASSIGNED vN
  -- ASSIGN(eligible analyst, expectedVersion=N) --> ASSIGNED vN+1

ASSIGNED(A) vN
  -- CHANGE(B != A, eligible, reason, expectedVersion=N) --> ASSIGNED(B) vN+1

ASSIGNED(A) vN
  -- REMOVE(reason, expectedVersion=N) --> UNASSIGNED vN+1
```

Invalid transitions:

- asignar cuando ya existe Analista;
- cambiar a nulo, al mismo Analista o a uno no elegible;
- retirar cuando no existe custodia;
- cualquier comando con versión vencida;
- cualquier comando cuando el pasaporte no cumple el estado elegible exigido por la especificación;
- reutilizar una clave idempotente con intención diferente.

## Transaction invariant

Para cada comando confirmado:

1. Autorizar capacidad administrativa.
2. Abrir transacción serializable y bloquear `PlayerPassport` por UUID.
3. Leer/crear `PassportCustody`; comparar versión.
4. Revalidar `PlayerPassport.state = ACTIVE`, `enrichmentStatus = AWAITING_ANALYST_ENRICHMENT` y Analista destino cuando aplica.
5. Comprobar idempotency key/intención.
6. Actualizar estado e insertar un evento.
7. Commit único.

Después del commit, autorización y listas leen el mismo estado; no hay propagación asíncrona.

## Derived projections

### DossierSummary

- `dossierReference`: derivada de UUID y enmascarada.
- `displayLabel`: nombre permitido o referencia.
- `status`: derivado de confirmación/ejecución/eliminación.
- `confirmedAt`.
- `originRequest`: referencia, tipo y estado mínimos.
- `linkedPassport`: referencia/estado o `notApplicable`.

### DossierDetail

Añade historial seguro de confirmación/eliminación/finalización y enlaces autorizados. No incluye categorías de evidencia, documentos, contactos, credenciales ni objetos eliminados.

### CustodyPassportSummary

- referencia enmascarada y nombre visible permitido;
- ciclo de vida/enriquecimiento;
- academia visible permitida cuando aplica;
- custodia actual mínima;
- `custodyVersion` y capacidades proyectadas.

### EligibleAnalystSummary

- `identityId` opaco;
- `displayLabel`;
- `activeCustodyCount` calculado;
- capacidad de selección derivada.

### CustodyHistoryEntry

- fecha, acción, actor administrativo con etiqueta genérica/permitida;
- destino anterior/nuevo mediante etiquetas operativas;
- motivo seguro cuando la acción es cambio o retiro;
- ninguna identidad civil o credencial.

## Retention and privacy

- Los eventos de custodia son inmutables y no contienen documentos, correo, teléfono, hashes ni datos deportivos.
- Las respuestas administrativas usan `Cache-Control: no-store`.
- Los motivos de cambio y retiro se validan por longitud/contenido seguro y nunca se copian a logs de error; la asignación inicial persiste `safeReason = null`.
- El retiro no borra historial; revoca la relación vigente poniendo `currentAnalystIdentityId = null`.
- La consulta de expedientes nunca intenta recuperar evidencia marcada/eliminada.

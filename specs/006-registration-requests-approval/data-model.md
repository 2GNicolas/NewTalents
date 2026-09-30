# Data Model: Solicitudes de registro y aprobación

Este modelo es conceptual. No modifica Prisma ni prescribe nombres físicos. Los valores privados reutilizan normalización, cifrado y huellas de Feature 005; nunca se duplican en auditoría, DTOs ordinarios o evidencia.

## Enumerations

### RegistrationRequestType

`PERSONAL_ADULT`, `REPRESENTED_MINOR`, `FORMAL_ACADEMY`, `NATURAL_PERSON_ACADEMY`, `ADDITIONAL_ACADEMY_ACCOUNT`, `ACADEMY_ADULT_PLAYER`, `ACADEMY_MINOR_PLAYER`.

### RegistrationRequestStatus

`DRAFT`, `SUBMITTED`, `REQUIRES_CORRECTION`, `APPROVED`, `REJECTED`.

### EvidenceStatus

`QUARANTINED`, `SCANNING`, `CLEAN`, `REJECTED`, `REPLACED`, `DELETION_PENDING`, `DELETED`.

### ApprovalExecutionStatus

`NONE`, `PREPARED`, `DELETING_EVIDENCE`, `READY_TO_FINALIZE`, `FINALIZED`, `RECOVERY_REQUIRED`. Es estado técnico ortogonal, no un estado nuevo del ciclo de producto.

### EvidenceDeletionStatus

`PENDING`, `IN_PROGRESS`, `COMPLETED`, `RECOVERY_REQUIRED`.

## Aggregate root

### RegistrationRequest

| Field | Meaning / classification |
|---|---|
| id | Identificador opaco interno. |
| type | Uno de los siete tipos exactos. |
| status | Estado de producto. |
| ownerIdentityId | Identidad autenticable propietaria; nulo solo durante creación pública atómica. |
| academyContextId | Academia aprobada para solicitudes organizacionales; nunca aceptada como id arbitrario del cliente. |
| version | Entero optimista incrementado por transición/material update. |
| submittedAt, decidedAt | Metadatos internos/a presentación autorizada. |
| approvalExecutionStatus | Coordinación expediente/eliminación/finalización. |
| latestSafeReason | Razón apta para solicitante; separada de notas internas. |
| createdAt, updatedAt | Auditoría técnica. |

Invariantes:

- Tiene exactamente un detalle tipado que coincide con `type`.
- `SUBMITTED` es inmutable para el propietario; `DRAFT` y `REQUIRES_CORRECTION` son editables.
- `APPROVED` y `REJECTED` son finales.
- Toda mutación exige `expectedVersion`; conflicto no revela datos candidatos.
- Una sola decisión final y una sola ejecución de aprobación por versión.

## Parties and typed details

### RequestApplicant

Referencia a la identidad/credencial existente, datos de contacto aplicables y valores privados cifrados/fingerprinted que no existan ya. Registra condición `PENDING_ONBOARDING`, mayoría derivada y reglas de teléfono. Password y confirmación nunca pertenecen al modelo.

### RequestPlayer

Datos privados del jugador propuesto y huellas de documento reutilizables; fecha de nacimiento cifrada; país/ciudad no precisa; edad derivada al presentar/aprobar. Puede enlazarse a `Player` al aprobar. No contiene campos deportivos reservados al Analista.

### PersonalAdultApplication

Uno-a-uno con request; applicant y player representan a la misma persona, declaración de actuación propia. Outcome: Identity/USER + Player + SELF + Active Basic Passport.

### RepresentedMinorApplication

Applicant adulto, `RequestPlayer` menor, vínculo controlado y declaración de autoridad. Outcome: USER representante + Player + LEGAL_REPRESENTATIVE + passport; cero cuenta del menor.

### AcademyApplication

Compartido por `FORMAL_ACADEMY` y `NATURAL_PERSON_ACADEMY`: nombre normalizado/huella, organización/operating identity, país, ciudad/lugar no preciso, responsable y declaración. Formal añade NIT normalizado/huella, RUT y certificado/equivalente. Natural añade al menos una `ProofOfOperationCategory` controlada. Outcome: Academy + responsible Identity/ACADEMY_USER + active membership + responsible relationship.

### AcademyAccountApplication

Academia aprobada derivada del contexto, solicitante propuesto, función, autoridad del responsable. Outcome: identidad habilitada + solo ACADEMY_USER + membresía en esa academia.

### AcademyAdultPlayerApplication

Academia derivada de membresía activa, jugador adulto y autorización expresa. Outcome: Player + AcademySportingRelationship + passport; sin USER/SELF.

### AcademyMinorPlayerApplication

Academia derivada, menor, representante identificado, vínculo y autoridad/autorizaciones. Outcome: Player + LEGAL_REPRESENTATIVE (sin cuenta automática) + AcademySportingRelationship + passport; sin cuenta del menor.

## Evidence and consent

### EvidenceItem

| Field | Meaning |
|---|---|
| id, requestId | Identificadores opacos. |
| category | Catálogo permitido según tipo. |
| objectKey | Clave privada aleatoria, nunca URL. |
| declaredMime, detectedMime | MIME declarado y detectado. |
| sizeBytes, contentDigest | Integridad técnica; digest no se expone. |
| status | Estado de cuarentena/revisión/eliminación. |
| scannerResultCode | Resultado controlado sin contenido. |
| replacedById | Cadena de sustitución. |
| uploadedAt, deletedAt | Metadatos. |

Solo `CLEAN`, vigente y no reemplazado cuenta como completo. No se conserva nombre local sensible; puede guardarse una etiqueta segura generada.

### ConsentRecord

Tipo (`PRIVACY`, `TRUTHFULNESS`, `SELF_ACTION`, `REPRESENTATION`, `MINOR_TREATMENT`, `ACADEMY_PRESENTATION`), versión del texto, actor, alcance, momento y request version. Es inmutable; no copia el texto completo ni documentos.

### EvidenceDeletionRecord

Un registro por evidence item y ejecución: estado, intentos, próxima fecha, lease, último código de error redactado, verificación, timestamps. Clave de objeto deja de exponerse tras completar; auditoría conserva categoría y momento.

## Review and history

### CorrectionRequest

Versión presentada, categorías/campos a corregir, razón segura, Administrador y momento. Es inmutable y habilita transición a `REQUIRES_CORRECTION`.

### ReviewDecision

`CORRECTION_REQUESTED`, `APPROVED` o `REJECTED`; actor Administrador, request/version, razón segura, código interno controlado, momento e idempotency key. Solo una decisión final.

### ManualDossierConfirmation

Request/version, Administrador, scope/category set transferido, declaración/version, momento. Obligatorio para aprobar; no almacena expediente externo.

### ApprovalExecution

Coordina preparación, eliminación y finalización: request/version, status, idempotency key, lease, attempts, result references opacas y timestamps. No es workflow genérico.

### RequestEvent

Evento append-only con request, sequence, version, actor opaco, acción, estado anterior/resultante, categoría segura, resultado y momento. Prohíbe passwords, documento, nacimiento, contacto, evidencia, huellas, candidatos y declaraciones completas.

### PrivateDuplicateSignal

Señal administrativa por similitud no concluyente o conflicto: tipo, estado (`OPEN`, `DISTINCT`, `CONFIRMED_CONFLICT`), referencia candidata opaca cifrada/restringida, resolvedBy/At. Nunca se proyecta al solicitante. Conflicto abierto/confirmado bloquea aprobación.

## Compatibility links

- `Identity`: identidad pending o existente; aprobación habilita la misma cuando aplica.
- `Player`: se crea o enlaza por huella normalizada dentro de la transacción.
- `PlayerPassport`: máximo uno por jugador; nuevo passport `ACTIVE` + `AWAITING_ANALYST_ENRICHMENT`.
- `PassportResponsibility`: `SELF` o `LEGAL_REPRESENTATIVE` solo en outcomes explícitos.
- `Academy`: creada/activada para solicitudes de academia o referenciada desde contexto aprobado.
- `AcademyMembership`: activa para responsable/cuenta adicional; no confiere representación.
- `AcademySportingRelationship`: vínculo organizacional jugador-academia separado de responsabilidad legal.

## State transitions

| From | Operation | To | Preconditions |
|---|---|---|---|
| none | create | DRAFT | tipo permitido y actor/contexto válido |
| DRAFT | update/upload | DRAFT | owner, version, no decision lock |
| DRAFT | submit | SUBMITTED | complete, all evidence CLEAN, age/context valid |
| SUBMITTED | request correction | REQUIRES_CORRECTION | Administrator, current version |
| REQUIRES_CORRECTION | update/replace | REQUIRES_CORRECTION | owner, current version |
| REQUIRES_CORRECTION | resubmit | SUBMITTED | complete/current |
| SUBMITTED | reject | REJECTED | Administrator, safe reason; starts deletion |
| SUBMITTED | prepare approval | SUBMITTED | Administrator, dossier confirmed, no unresolved conflict |
| SUBMITTED | finalize approval | APPROVED | deletion verified and typed outcome transaction succeeds |

## Atomicity and idempotency

- Cada submit/decision compara `version` y consume una idempotency key por actor/operation.
- Outcomes se crean en una única transacción `Serializable`; cualquier conflicto revierte todo.
- Restricciones únicas protegen email normalizado, documento fingerprint, NIT fingerprint, un passport/jugador, SELF único, membership y relación deportiva.
- P2034 reintenta toda la transacción hasta el límite existente; después responde conflicto seguro.
- Eliminación externa es idempotente y durable mediante `EvidenceDeletionRecord`; no se mezcla ficticiamente con ACID de PostgreSQL.

## Data classification

| Class | Examples | Access |
|---|---|---|
| Public presentation | Ninguno de la solicitud | Nadie sin autenticación. |
| Authenticated presentation | estado, tipo, razón segura, metadata segura | Propietario/contexto/Admin según capability. |
| Private encrypted structured | documento, nacimiento, contacto, representante | Servicios autorizados; Admin mínimo en revisión. |
| Administrator-only evidence | PDFs/imágenes, resultado scanner | Solo Admin con capability y auditoría. |
| Derived | edad, completitud, duplicate outcome seguro | Según proyección; candidatos nunca. |
| Internal audit metadata | eventos, accesos, deletion attempts | Operación interna autorizada. |
| Credential secret | password/hash/token | Solo frontera de credenciales; nunca dominio/DTO/audit. |

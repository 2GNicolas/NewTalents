# Research: Feature 007

## Fuentes inspeccionadas

- Especificación y checklist de Feature 007.
- Constitución 2.0.0.
- `docs/design/admin-custody/manifest.md` y sus 12 referencias aprobadas.
- Esquema Prisma y módulos de autorización, solicitudes de registro, aprobación, pasaportes, autenticación y rutas Expo necesarios para la integración.
- Contratos OpenAPI y de autorización de Features 002, 005 y 006.

No se ejecutaron pruebas ni builds; esta fase fue exclusivamente de inspección y diseño.

## R1. Feature 006 permanece como dependencia inmutable

**Decision**: Reutilizar los controladores y servicios actuales de revisión, corrección, rechazo, confirmación manual, eliminación y aprobación. Feature 007 solo añade proyecciones, navegación y custodia.

**Rationale**: `ApprovalExecutionService` ya confirma el expediente, retira evidencias, espera ausencia verificada y despacha el resultado tipado de los siete tipos. Duplicar ese flujo introduciría dos autoridades y violaría FR-001/FR-054.

**Alternatives considered**:

- Mover aprobación al módulo de custodia: rechazado; mezcla autoridad documental y custodia.
- Crear acciones de confirmación desde Expedientes: rechazado; está fuera del alcance aprobado.

## R2. Expedientes es un read model de datos existentes

**Decision**: Construir lista y detalle desde `RegistrationManualDossierConfirmation`, `RegistrationApprovalExecution`, `RegistrationRequestEvent`, estado de eliminación y enlaces solicitud–jugador–pasaporte. No crear una segunda entidad de expediente.

**Rationale**: Ya existe una confirmación única por solicitud/versión. El faltante es un contrato de consulta independiente, no otro registro autoritativo.

**Status derivation**:

- `CONFIRMED`: confirmación durable y ejecución aún no finalizada.
- `DELETION_PENDING`: eliminación en curso.
- `RECOVERY_REQUIRED`: eliminación/finalización requiere reintento desde el flujo de solicitud existente.
- `APPROVED`: ejecución finalizada y solicitud aprobada.

Todos siguen siendo expedientes confirmados; el filtro de estado describe su resultado técnico, no habilita nuevas mutaciones.

## R3. Los enlaces de expediente a pasaporte son opcionales por tipo

**Decision**: Resolver el pasaporte mediante `RegistrationRequestPlayer.linkedPlayerId -> Player.passport`; proyectar `notApplicable` cuando el tipo de solicitud no crea jugador/pasaporte.

**Rationale**: Los resultados personal adulto, menor representado y jugador de academia crean pasaporte; academia formal, academia de persona natural y cuenta adicional no lo hacen. `resultReferences` es JSON y no debe asumirse como FK.

**Alternatives considered**:

- Crear un pasaporte para cada expediente: rechazado; contradice Feature 006 y el alcance.
- Parsear exclusivamente `resultReferences`: rechazado; es una referencia de resultado no tipada y no cubre todos los tipos.

## R4. Búsqueda sobre nombres cifrados sin índice en texto claro

**Decision**: Aplicar primero autorización y filtros indexables; recorrer candidatos por bloques en orden estable; descifrar solo la etiqueta permitida; filtrar por nombre/referencia; continuar hasta completar `limit + 1` coincidencias.

**Rationale**: Los nombres de jugador están cifrados y no existe un índice de búsqueda seguro. El objetivo medido es hasta 1.000 elementos, por lo que una lectura acotada por bloques evita duplicar identidad o almacenar nombres normalizados en claro.

**Alternatives considered**:

- Guardar nombre normalizado en texto claro: rechazado por privacidad.
- Añadir infraestructura de búsqueda: rechazado como prematuro para el alcance y escala aprobados.
- Descifrar en frontend: rechazado; ampliaría exposición y rompería el límite de autorización backend.

## R5. Progreso operativo separado del ciclo de vida

**Decision**: Añadir `RegistrationAdminReviewProgress` con etapas `OPENED` y `REVIEWED`, versión de solicitud observada y timestamps. No genera eventos de negocio ni cambia la versión de la solicitud.

**Rationale**: El estado `SUBMITTED` no distingue una solicitud nueva de una revisión iniciada o lista para decisión. Feature 006 tampoco registra la apertura de detalle, y explícitamente separa consulta de evidencia del historial del ciclo de vida.

**Alternatives considered**:

- Inferir “Continuar revisión” de la fecha: rechazado; no es autoritativo.
- Guardarlo solo en frontend: rechazado; no sobrevive a otra sesión/Administrador.
- Añadir estados al agregado Feature 006: rechazado; cambiaría su comportamiento.

## R6. Custodia como estado actual más eventos inmutables

**Decision**: Usar una fila `PassportCustody` única por pasaporte para lectura/versión y `PassportCustodyEvent` append-only para auditoría e idempotencia.

**Rationale**: El estado actual debe consultarse en cada autorización y las cargas deben contarse eficientemente. El historial debe conservar asignación, cambio y retiro sin reconstruir autoridad desde eventos potencialmente incompletos.

**Alternatives considered**:

- Solo eventos: rechazado; complica autoridad inmediata, unicidad y conteos.
- Una fila nueva por periodo con índice parcial activo: viable, pero añade más complejidad para idempotencia y consulta del estado actual.
- Reutilizar `PassportResponsibility`: rechazado; mezcla custodia de Analista con responsabilidades legales/organizativas.

## R7. Concurrencia e idempotencia

**Decision**: Bloquear el `PlayerPassport`, comprobar `expectedVersion`, revalidar elegibilidad y ejecutar estado+evento en una transacción serializable. `PassportCustodyEvent.idempotencyKey` es único y conserva los datos necesarios para comparar intención.

**Rationale**: El pasaporte siempre existe, incluso antes de que exista una fila de custodia, por lo que sirve como candado estable para la primera asignación concurrente. La clave única evita duplicar estado o historial.

**Safe outcomes**:

- Versión vencida o estado/Analista cambiado: `409 CUSTODY_CONFLICT` con proyección vigente mínima.
- Misma clave e intención ya aplicada: `200` con resultado previo.
- Misma clave con intención distinta: `409 IDEMPOTENCY_CONFLICT`.
- Fallo antes del commit: no cambia estado, carga, acceso ni historial.

## R8. Elegibilidad y etiqueta del Analista

**Decision**: Elegibilidad = `Identity.ACTIVE` + rol `ANALYST` activo + `AnalystOperationalProfile`. El perfil contiene una etiqueta operativa mínima y normalizada, no correo, documento ni nombre civil obligatorio.

**Rationale**: `Identity` no tiene nombre visible y usar la credencial normalizada expondría datos de autenticación. El perfil explícito permite “Laura M.” u otra identificación aprobada para operación.

**Gap**: El repositorio no tiene fuente existente para estas etiquetas. La implementación deberá incluir provisión/backfill controlado de perfiles para Analistas actuales; hasta entonces se excluyen de elegibilidad de forma fail-closed.

## R9. Acceso del Analista se deriva de custodia vigente

**Decision**: Extender `PassportAuthorizationAdapter` con `analystCustodyActive`; filtrar la colección del Analista por `currentAnalystIdentityId`; consultar el hecho en cada apertura.

**Rationale**: Actualmente el rol `ANALYST` permite listar y abrir todos los pasaportes internos. Eso contradice FR-031/FR-032 y es la principal brecha de autorización.

**Compatibility**: Las ramas USER, representante, academia y Administrador no se cambian. El rol sigue siendo necesario para el Analista, pero deja de ser suficiente.

## R10. Cargas activas se calculan, no se almacenan

**Decision**: Contar filas de custodia cuyo `currentAnalystIdentityId` coincide y no es nulo.

**Rationale**: Un contador materializado puede divergir en carreras o rollbacks. El conteo sobre una relación única e indexada es autoritativo y actualiza inmediatamente.

## R11. Arrastre es selección, nunca comando

**Decision**: En web de escritorio, una interacción de puntero sobre zonas medidas selecciona destino y abre confirmación. La acción `Asignar/Cambiar` abre el mismo selector en móvil y teclado. Solo el botón final llama al comando.

**Rationale**: React Native Web ya permite eventos de puntero y medición; no se necesita una dependencia nueva de drag-and-drop. La semántica compartida garantiza cancelación y accesibilidad.

**Alternatives considered**:

- HTML5 drag-and-drop como única vía: rechazado; no cubre React Native, táctil ni teclado.
- Persistir al soltar: rechazado por FR-015 y FR-020.

## R12. Autoridad visual y conflicto de alcance

**Decision**: Usar las 12 imágenes de `docs/design/admin-custody/` para shell, jerarquía, color, composición y comportamiento responsivo. No usar imágenes de Feature 006.

Las referencias de Expedientes muestran estados y acciones como “Por confirmar” y “Confirmar”. La especificación corregida limita esta sección a expedientes confirmados y prohíbe nuevas confirmaciones. Por tanto, esos elementos son guía visual de tarjetas/estados, no alcance funcional. Lo mismo aplica a tarjetas de Inicio que invitan a confirmar expedientes.

## Unresolved blockers

No existe un bloqueo de planificación. La ausencia de perfiles operativos de Analista es una brecha de datos conocida y resuelta en el diseño mediante provisión fail-closed; su población deberá convertirse en trabajo explícito durante la generación de tareas.

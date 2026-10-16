# Data model: proyecciones de lectura del Analista

No hay nueva entidad persistida, columna ni migración en Feature 010. Las siguientes son proyecciones autorizadas derivadas de hechos existentes; el backend no serializa filas Prisma completas.

## Hechos de autoridad existentes

| Hecho | Fuente | Uso permitido |
|---|---|---|
| Identidad activa y rol `ANALYST` vigente | `Identity`, `RoleAssignment`, `AnalystOperationalProfile` | Abrir cualquier colección del espacio; no concede acceso a un pasaporte por sí solo. |
| Pasaporte `ACTIVE` y custodia actual del actor | `PlayerPassport`, `PassportCustody.currentAnalystIdentityId` | Filtrar colecciones y revalidar cada detalle/enlace directo. La custodia histórica no basta. |
| Primer partido confirmado | `FirstMatch` de Feature 009 | Fecha `@db.Date`, hora local `HH:mm`, rival, competencia, sede y estado `WAITING`/`LOADED`/`CANCELED`; solo lecturas. |
| Nombre del jugador autorizado | `PlayerPrivateIdentity.encryptedLegalName` / `PlayerIdentityPresentation.displayName` de Feature 005 | Descifrar y proyectar solo el nombre tras identidad/rol, `ACTIVE` y custodia actual; nunca serializar la fila privada ni documentos o fecha de nacimiento. |
| Referencia operativa | ID de pasaporte enmascarado | Complementa el nombre; ya no lo sustituye. |
| Persona de contacto actual | `PassportResponsibility`, `PlayerPassport.originKind/originAcademyId`, solicitud aprobada de creación de academia, `AcademyMembership`, identidad/rol activos | Personal adulto: único `SELF`; personal menor: único `LEGAL_REPRESENTATIVE`; academia: responsable inicial de la creación aprobada mientras siga vigente, o una designación actual explícita cuando exista. No seleccionar cuentas adicionales, creador del pasaporte ni primer miembro. Si no es inequívoco, contacto no disponible. |
| Canales de esa persona | `AuthenticationCredential.normalizedEmail`; `RegistrationRequestApplicant.encryptedPhone` de solicitud aprobada atribuible a la misma identidad | Correo y teléfono son independientes y opcionales. No usar teléfono de `RegistrationRequestRepresentative` de menor de academia como contacto de su academia ni mezclar canales de dos identidades. La solicitud no prueba actualización posterior del número. |

## Proyecciones

**AnalystPassportCard**: `passportId` para navegación autorizada, `maskedReference`, `playerName` autorizado, `lifecycleState: ACTIVE`, `custodyState: ASSIGNED_TO_ACTOR`, `nextMatch?` con fecha/hora local, rival/sede permitidos. El próximo partido es un registro `WAITING` futuro entre todas las fuentes disponibles; si no existe, estado explícito sin próximo partido. No contiene contacto, documento, otros datos civiles, capacidades de asignación, detalles de otro Analista ni historial administrativo.

**ScheduledMatchRead**: `id`, `sourceKind` (hoy `FIRST_MATCH`), `passportId`, `maskedReference`, `playerName` autorizado, `matchDate: YYYY-MM-DD`, `matchTime: HH:mm`, `opponent`, `competition`, `venue`, `state: WAITING | LOADED` para Feature 009. `CANCELED` no se presenta en la agenda programada. La forma permite mapear una futura fuente confirmada sin condicionar elegibilidad al orden; no crea ni promete esa fuente. No contiene contacto.

**AnalystPassportDetail**: tarjeta autorizada más `contact`. `AVAILABLE` contiene `kind: SELF | LEGAL_REPRESENTATIVE | ACADEMY_RESPONSIBLE` y por lo menos uno de `phone?` o `email?`, ambos de la **misma** persona identificada inequívocamente; ninguno tiene precedencia. `UNAVAILABLE` carece de valores y se usa si falta persona actual única o ambos canales. Solo el detalle puede incluir contacto tras revalidar custodia; tarjetas, Inicio y agenda no lo contienen.

**AnalystMatchDetail**: la misma proyección operativa más contexto mínimo del pasaporte. Se consulta por ID del partido y se verifica su pertenencia al pasaporte `ACTIVE` bajo custodia actual antes de responder. No incluye contacto, `playerId`, `scheduledByIdentityId`, `loadedByAnalystIdentityId`, `loadId`, unidad `RESERVED/USED`, cupo, resultados, métricas ni evidencia.

**AnalystOverview**: `pending[]`, `upcoming[]` y `completed` como sección `UNAVAILABLE` hasta existir contrato de confirmación de análisis; conteos solo para colecciones autoritativas completas o página explícitamente definida. `drafts` y `history` no tienen proyección ni acción en esta entrega. Una colección vacía con fuente válida es `EMPTY`; fuente ausente es `UNAVAILABLE`, nunca se equiparan.

## Regla derivada de Inicio

Sea `scheduledLocal = matchDate + matchTime` interpretado en `America/Bogota`, y `nowLocal` el reloj actual en la misma zona, sin zona del navegador. Para un partido confirmado de Feature 009:

| Estado y tiempo | Categoría |
|---|---|
| `WAITING` y `nowLocal < scheduledLocal` | Solo `UPCOMING` |
| `WAITING` y `nowLocal >= scheduledLocal` | Solo `PENDING` |
| `LOADED` o `CANCELED` | Ni `UPCOMING` ni `PENDING` |
| Confirmación aprobada de análisis, cuando exista otra fuente | Solo `COMPLETED`; `LOADED` no es sustituto. |

La clasificación se calcula una vez por ID de partido en una lectura; no persiste estado nuevo. Las fuentes posteriores deben aportar un estado de espera/carga autoritativo equivalente y fecha/hora válidas para recibir la misma regla. Cuando no exista una fuente, no se generan filas. Las revisiones de programación se reflejan en la siguiente consulta. Los totales no se derivan de una página parcial sin semántica de total autorizada.

## Invariantes y fallos

- La lista solo considera `ACTIVE` bajo custodia actual del actor, no solo `AWAITING_ANALYST_ENRICHMENT`.
- Un ID de pasaporte o partido ajeno/inexistente comparte `404` y cuerpo mínimo; ningún detalle previo se reutiliza tras denegación.
- Nombre y contacto se eliminan de la vista tras pérdida de autoridad. Una responsabilidad histórica, cuenta adicional de academia, presentador del jugador o primer miembro no bastan para elegir persona. Una solicitud aprobada puede aportar teléfono solo si se vincula sin ambigüedad a la persona actual y al contexto; de lo contrario se omite ese canal.
- Respuestas `GET` y errores protegidos: `Cache-Control: no-store`.
- Toda proyección es de solo lectura y no cambia `FirstMatch`, unidad de cupo, custodia, pasaporte ni análisis.
- `UNAVAILABLE` de Análisis realizados y de borradores no significa cero históricos; indica ausencia de contrato/fuente aprobada.

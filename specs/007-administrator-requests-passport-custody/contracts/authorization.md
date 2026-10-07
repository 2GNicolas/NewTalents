# Authorization Contract: Administrator dossiers and passport custody

El backend evalúa todas las capacidades. La navegación, el shell y una etiqueta de rol visible no autorizan ninguna operación.

## Administrator capabilities

### Existing Feature 006 capabilities reused unchanged

- `registration.review.list`
- `registration.review.view`
- `registration.review.view-evidence`
- `registration.review.request-correction`
- `registration.review.confirm-dossier`
- `registration.review.approve`
- `registration.review.reject`
- `registration.review.view-deletion-status`
- `registration.review.retry-deletion`

### Feature 007 additions

- `registration.review.progress`
- `registration.dossier.list`
- `registration.dossier.view`
- `passport.custody.list`
- `passport.custody.view`
- `passport.custody.list-analysts`
- `passport.custody.assign`
- `passport.custody.change`
- `passport.custody.remove`

## Analyst capability

- `passport.review` continúa requiriendo rol `ANALYST`, pero para una colección o recurso concreto también requiere `analystCustodyActive=true`.
- La colección de trabajo del Analista solo incluye pasaportes cuya custodia actual apunta a su identidad.

## Resource facts

| Fact | Meaning |
|---|---|
| `administratorCapability` | La identidad activa tiene la capacidad administrativa estática solicitada. |
| `requestVersionCurrent` | El progreso se aplica a la versión vigente. |
| `dossierConfirmed` | Existe una `RegistrationManualDossierConfirmation` para el recurso. |
| `passportBasicActive` | Pasaporte `ACTIVE` y `AWAITING_ANALYST_ENRICHMENT`. |
| `custodyVersionCurrent` | La versión esperada coincide con la autoridad vigente. |
| `custodyAssigned` | Existe un Analista vigente. |
| `targetAnalystEligible` | Identidad activa, rol ANALYST activo y perfil operativo existente. |
| `analystCustodyActive` | La custodia vigente del pasaporte coincide con la identidad Analista solicitante. |

## Matrix

| Operation | Required facts | Denial behavior |
|---|---|---|
| Read grouped requests | active Administrator + `registration.review.list` | `403` collection denial. |
| Record review progress | active Administrator + `registration.review.progress` + current request version | safe `404` or recoverable `409`; no lifecycle mutation. |
| List dossiers | active Administrator + `registration.dossier.list` | `403`; no counts or rows. |
| Read dossier | active Administrator + `registration.dossier.view` + `dossierConfirmed` | missing and denied both safe `404`. |
| List custody passports | active Administrator + `passport.custody.list` | `403`. |
| Read custody detail/history | active Administrator + `passport.custody.view` | missing and denied both safe `404`. |
| List eligible Analysts | active Administrator + `passport.custody.list-analysts` | `403`; never disclose emails/credentials. |
| Assign | active Administrator + assign + active basic passport + unassigned/current version + eligible target | `409` for stale/ineligible current state; no partial change. |
| Change | active Administrator + change + active basic passport + assigned/current version + different eligible target | `409`; prior custody remains. |
| Remove | active Administrator + remove + active basic passport + assigned/current version | `409`; prior custody remains. |
| Analyst list | active ANALYST + each row's active custody | omit every unassigned/other-Analyst passport. |
| Analyst open/review | active ANALYST + `analystCustodyActive` for passport | missing and denied both `passport_not_found`. |

## Runtime re-evaluation

- El comando reevalúa identidad administrativa, pasaporte, versión, custodia, identidad destino y rol destino dentro de la transacción.
- El acceso del Analista consulta la custodia vigente en cada petición. No se proyecta en JWT ni se conserva hasta el próximo login.
- Revocar el rol, inactivar la identidad, cambiar o retirar custodia invalida inmediatamente el acceso.
- El conteo de carga no autoriza; es una proyección de filas vigentes.

## Minimum projections

- Solicitudes: referencia enmascarada, etiqueta permitida, tipo, contexto/fecha y siguiente acción.
- Expedientes: referencia, estado derivado, historial mínimo y enlaces; nunca evidencia eliminada o identidad civil.
- Analistas: UUID opaco, etiqueta operativa y conteo activo; nunca correo, credencial, documento o roles adicionales.
- Pasaportes de custodia: referencia, nombre visible permitido, estado básico, academia permitida y custodia.
- Historial: acción, fecha, actor administrativo permitido, etiquetas operativas de destino y motivo seguro solo para cambio o retiro.

## Compatibility

- USER, representante, academia y Administrador conservan las reglas de Feature 005.
- Las capacidades de decisión de Feature 006 no cambian.
- Custodia no concede `ADMINISTRATOR`, no crea `SELF`, no crea membresía y no ejecuta enriquecimiento.

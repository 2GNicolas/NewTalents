# Matriz de controles compartidos de registro

Esta matriz delimita la normalización posterior a la aceptación manual fallida. No reemplaza ni reescribe las tareas T001–T134.

| Tipo de solicitud | Personas y regla documental | Municipio DANE | Evidencias obligatorias | Destino de Volver |
|---|---|---|---|---|
| `PERSONAL_ADULT` | Solicitante adulto: CC, CE o pasaporte | Solicitante | Frente y reverso de identidad | Selección pública de solicitud |
| `REPRESENTED_MINOR` | Representante adulto: CC, CE o pasaporte. Menor: TI, RC, CE o pasaporte | Representante y menor | Frente/reverso del representante, identidad civil del menor y autoridad de representación | Selección pública de solicitud |
| `FORMAL_ACADEMY` | Responsable adulto: CC, CE o pasaporte | Sede y responsable | RUT, existencia/certificación y autoridad del responsable | Selección pública de solicitud |
| `NATURAL_PERSON_ACADEMY` | Responsable adulto: CC, CE o pasaporte | Operación y responsable | Prueba de operación y autoridad del responsable | Selección pública de solicitud |
| `ADDITIONAL_ACADEMY_ACCOUNT` | Nueva cuenta adulta: CC, CE o pasaporte | Nueva cuenta | Frente/reverso de identidad y autorización de cuenta | Centro de solicitudes de la academia autenticada |
| `ACADEMY_ADULT_PLAYER` | Jugador adulto: CC, CE o pasaporte | Jugador | Frente/reverso de identidad y autorización del adulto | Centro de solicitudes de la academia autenticada |
| `ACADEMY_MINOR_PLAYER` | Menor: TI, RC, CE o pasaporte. Representante adulto: CC, CE o pasaporte | Menor y representante | Identidad civil del menor, frente/reverso del representante y autoridad de representación | Centro de solicitudes de la academia autenticada |

## Implementación compartida

- `DocumentTypeSelect`: lista flotante, navegación por teclado y conjunto permitido por sujeto adulto/menor.
- `MunicipalitySelect`: búsqueda DIVIPOLA flotante, código estable y etiqueta visible.
- `DateField`: valor canónico `YYYY-MM-DD`, formato progresivo y validación de fecha real/no futura.
- `JourneyShell` y `Actions`: progreso horizontal solo móvil, navegación anterior que conserva el estado local.
- `EvidenceRequirements` y `RegistrationEvidenceUploadQueue`: estados faltante/seleccionado/cargando/escaneando/CLEAN/error, progreso solo cuando es medible y retiro/reemplazo cuando la regla de ciclo de vida lo permite.
- `validatePerson` (frontend) e `isValidRegistrationPerson` (backend): las mismas restricciones documentales y de edad según el sujeto.

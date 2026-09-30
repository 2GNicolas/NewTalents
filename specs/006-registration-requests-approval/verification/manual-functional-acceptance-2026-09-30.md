# Aceptación funcional manual — Feature 006

**Fecha:** 2026-09-30
**Resultado:** PASS (7/7 recorridos)
**Entorno real:** Expo web `http://localhost:8081`, Nest `http://localhost:3000`, PostgreSQL local en `5433` y ClamAV `clamd` en `3310`. Se usaron rutas normales sin `?preview=` y datos exclusivamente sintéticos. No se reinició la base de datos.

## Matriz compacta

| Tipo | Solicitud | Transiciones observadas | Estado del solicitante / Admin | Decisión y resultado persistido | Resultado |
|---|---|---|---|---|---|
| `PERSONAL_ADULT` | `517f6270-8c09-4b0d-9a73-4280a6ad4c27` | `DRAFT → SUBMITTED → REQUIRES_CORRECTION → SUBMITTED → APPROVED` | ID y estado visibles; visible en bandeja Admin | Corrección y reenvío; expediente confirmado; `USER` + `SELF` + 1 pasaporte `ACTIVE/AWAITING_ANALYST_ENRICHMENT` | PASS |
| `REPRESENTED_MINOR` | `3fcfaaac-5f0e-43f7-8efb-2797d7221f64` | `DRAFT → SUBMITTED → APPROVED` | ID y estado visibles; visible en bandeja Admin | Expediente confirmado; representante `USER` + `LEGAL_REPRESENTATIVE` + 1 pasaporte; sin cuenta del menor | PASS |
| `FORMAL_ACADEMY` | `928627eb-62e9-4e9b-8f78-f2b79b6bc53e` | `DRAFT → SUBMITTED → APPROVED` | ID y estado visibles; visible en bandeja Admin | Expediente confirmado; 1 academia `487dccad-dc7b-4f3f-859f-9f83633d8387`, responsable `ACADEMY_USER` y membresía `ACTIVE` | PASS |
| `NATURAL_PERSON_ACADEMY` | `b9aee135-cf3c-47fe-8892-65732f8c35b7` | `DRAFT → SUBMITTED → REJECTED` | ID y estado visibles; visible en bandeja Admin | Rechazo final; ninguna academia ni ejecución de aprobación creada | PASS |
| `ADDITIONAL_ACADEMY_ACCOUNT` | `18096987-8265-48f3-a89e-ca230368ffde` | `DRAFT → DRAFT → SUBMITTED → APPROVED` | ID y estado visibles en hub; visible en bandeja Admin | Expediente confirmado; solamente `ACADEMY_USER` + membresía `ACTIVE` en la academia derivada | PASS |
| `ACADEMY_ADULT_PLAYER` | `9356d428-e387-477b-af0f-720a23126b10` | `DRAFT → SUBMITTED → APPROVED` | ID y estado visibles en hub; visible en bandeja Admin | Expediente confirmado; Player + responsabilidad `ACADEMY` + 1 pasaporte; sin `USER`/`SELF` | PASS |
| `ACADEMY_MINOR_PLAYER` | `acaa5463-4a2e-466d-b231-3e084c30fab2` | `DRAFT → SUBMITTED → APPROVED` | ID y estado visibles en hub; visible en bandeja Admin | Expediente confirmado; Player + responsabilidades `LEGAL_REPRESENTATIVE` y `ACADEMY` + 1 pasaporte; cero cuentas automáticas | PASS |

## Decisiones de Administrador

- Corrección y reenvío: PASS (`PERSONAL_ADULT`).
- Rechazo final: PASS (`NATURAL_PERSON_ACADEMY`).
- Aprobación directa con confirmación manual de expediente: PASS en las otras seis solicitudes.
- Eliminación segura: PASS. Los 23 elementos sintéticos terminaron `DELETED`; los 23 registros de borrado terminaron `COMPLETED` con ausencia verificada y los 23 objetos están ausentes del almacenamiento privado.

## Defectos encontrados, corregidos y repetidos

1. **Contexto de academia perdido tras iniciar sesión.** La carga normal del hub solicitaba la lista sin el `academyId` proyectado por la sesión y mostraba `No pudimos cargar las solicitudes de esta academia.` Se corrigió la proyección backend/frontend de la membresía activa y el enrutamiento usa ahora ese contexto. Repetición: hub y tres recorridos internos PASS.
2. **Denegación del ciclo de vida para el propietario de academia.** Al continuar `18096987-8265-48f3-a89e-ca230368ffde`, la petición de actualización recibió la denegación segura del backend y la UI mostró `No pudimos verificar el acceso a esta solicitud...`. Se corrigieron los hechos de autorización para exigir propietario exacto, identidad activa, rol `ACADEMY_USER`, membresía activa coincidente y academia aprobada. Repetición: actualización, envío e inclusión en bandeja PASS.
3. **Autoconflicto al reintentar un borrador ya persistido.** El reintento del mismo recorrido devolvió el conflicto seguro `Ya existe un registro con este documento.` porque repetía la verificación de duplicado contra su propio `DRAFT`. Se omitió esa verificación exacta cuando la máquina ya posee snapshot persistido. Repetición: envío y aprobación PASS.
4. **Etiqueta de evidencia incorrecta en estados terminales.** La bandeja mostraba `Evidencia pendiente` para solicitudes aprobadas/rechazadas aunque PostgreSQL y el almacenamiento confirmaban el borrado. Se añadió la etiqueta terminal `Evidencia eliminada` y su prueba de regresión. Repetición en la bandeja real: las siete filas aceptadas muestran la etiqueta correcta.

## Comprobaciones finales

- Consulta Prisma sobre los siete IDs: `allPassed=true`.
- Backend enfocado: 3 archivos / 17 pruebas PASS.
- Frontend enfocado: 4 suites / 49 pruebas PASS.
- Typecheck backend y frontend: PASS.
- Bloqueadores restantes: ninguno.
- No se ejecutó Converge; no hubo commit, merge ni despliegue.

# Ejecución final de quickstart — Feature 006

Fecha: 2026-09-28. Todos los datos fueron canarios sintéticos. No se reinició ni limpió globalmente PostgreSQL; las 15 suites de integración se ejecutaron secuencialmente con un worker.

## Resultado por escenario

| Grupo de `quickstart.md` | Evidencia ejecutada | Resultado |
|---|---|---|
| Siete solicitudes: borrador, evidencia, CLEAN, envío, sesión pendiente y corrección | checkpoints iniciales, servicios tipados, estado/API frontend y flujos de academia | PASS |
| Restricción pending; menor sin cuenta/contacto; `SUBMITTED` inmutable; versión e historial | autorización, lifecycle, checkpoints y frontend vertical | PASS |
| Duplicados exactos y similitud privada sin enumeración | servicios de duplicado, revisión privada e integraciones personal/academia | PASS |
| Inbox Admin, filtros/cursor, denegación segura y detalle mínimo | Admin query/review, inbox state/UI y autorización | PASS |
| Stream privado, `no-store`, auditoría, corrección, reemplazo y reenvío | evidence stream/access audit, decision service y checkpoint de privacidad | PASS |
| Expediente obligatorio, preparación, borrado verificado, aprobación y rechazo | approval execution, deletion service y decisiones Admin | PASS |
| Siete outcomes transaccionales y passports pendientes de enriquecimiento | siete orchestrators e integraciones personal, academia y Admin | PASS |
| Scanner/storage fallidos, recovery en cinco intentos, retry idempotente y rollback | ingestion, provider matrix, deletion y approval execution | PASS |
| Carreras approve/reject/submit/resubmit y solicitudes equivalentes | concurrency, idempotency y suites de aprobación secuenciales | PASS |
| Pérdida de membresía/autoridad antes de decidir | servicios de operaciones de academia y autorización runtime | PASS |
| Privacidad de JSON/logs/rutas/eventos/exports y acceso tras `COMPLETED` | contratos de privacidad y evidencia completada | PASS |
| Responsive, teclado, lector, foco, errores, progreso, touch y no-color | 23 suites frontend de Feature 006 y evidencia visual T132 | PASS |
| Limpieza segura y ausencia verificada, limitada a objetos Feature 006 | deletion service, provider matrix y evidence access audit | PASS |
| Compatibilidad Feature 003/004/005 y provisión interna no pública | regression auth/passport y compatibility frontend | PASS |

## Comandos y totales

```text
npx vitest run src/registration-requests ...regresiones relacionadas
40 files passed; 202 tests passed

npx jest --runInBand src/registration-requests
23 suites passed; 132 tests passed

npx vitest run <4 contratos Feature 006>
4 files passed; 9 tests passed

npx vitest run <15 integraciones Feature 006> --maxWorkers=1 --fileParallelism=false
15 files passed; 24 tests passed

npx --yes @redocly/cli lint specs/006-registration-requests-approval/contracts/registration-requests.openapi.yaml
API description is valid
```

`npm run lint` no existe en el manifiesto raíz. La validación equivalente disponible quedó cubierta por typecheck, Jest/Vitest, Expo Doctor/export en T130 y Redocly para el contrato. La advertencia conocida de `pg` sobre consultas solapadas apareció en algunas suites, sin fallos ni contaminación; T129 ya demostró estabilidad con dos ejecuciones consecutivas sobre la misma base.

Conclusión: todos los escenarios sintéticos del quickstart tienen ejecución automatizada o runtime verificable y resultado esperado.

## Revalidación manual PERSONAL_ADULT — 2026-09-29

El resultado automatizado anterior no ocultó el fallo posterior de aceptación manual. Se reprodujeron y corrigieron los problemas de sesión pending, reenvío, entrada Admin, detalle/evidencia y finalización posterior al borrado.

- Aprobación directa: `ce42b3db-bfe0-4f9c-9ab4-752c0b35dcf1`, `APPROVED`, versión `3`, eliminación `COMPLETED`, outcome único.
- Corrección/reenvío: `0ddbf793-de6b-438a-8cbf-a03176f1bea5`, `SUBMITTED`, versión `3`, motivo seguro y reemplazos procesados por ClamAV.

Ambos recorridos se completaron en navegador real sin `?preview=`. Detalle completo en `manual-acceptance-personal-adult.md`.

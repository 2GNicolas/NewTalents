# Implementation Plan: Solicitudes de registro y aprobación

**Branch**: `feature/006-registration-requests-approval` | **Date**: 2026-09-22 | **Spec**: [spec.md](./spec.md)

**Input**: Especificación aprobada de Feature 006. Este plan no modifica la especificación ni su checklist.

## Summary

Feature 006 introduce un dominio acotado de solicitudes de registro con exactamente siete variantes tipadas, acceso pendiente restringido, evidencia documental temporal y una bandeja única de revisión para Administradores. Reutiliza identidad, credenciales, sesiones, autorización, normalización, cifrado privado, huellas de duplicado y transacciones serializables existentes. La aprobación materializa atómicamente solo los resultados propios del tipo y crea, cuando aplica, un pasaporte básico activo marcado como pendiente de enriquecimiento por Analista.

La evidencia se abstrae detrás de un puerto privado: volumen local fuera de directorios públicos en desarrollo y proveedor de objetos compatible con S3 en producción. Todo archivo entra en cuarentena, se valida por tamaño/firma/MIME, se analiza con una frontera fail-closed y solo se transmite a Administradores autorizados por streaming del backend. La aprobación exige expediente manual confirmado, eliminación verificada y una finalización transaccional; la recuperación usa un worker acotado e idempotente exclusivo de Feature 006.

## Technical Context

**Language/Version**: Node.js `>=24.11.0 <25`, TypeScript 5.9/6.0 conforme a cada workspace existente
**Primary Dependencies**: NestJS 11.1.8, Prisma 7.10.0, Expo SDK 57, Expo Router 57, React Native 0.86.3, React 19.2.3
**Storage**: PostgreSQL 18.6 para estado/metadatos; puerto privado de evidencia con filesystem local y adaptador S3 de producción; ClamAV INSTREAM como frontera de análisis
**Testing**: Vitest/Supertest en backend; Jest en frontend; integración PostgreSQL secuencial con clientes independientes para concurrencia
**Target Platform**: API Linux; Expo web, Android e iOS
**Project Type**: monorepo npm con API NestJS y cliente Expo compartido móvil/web
**Performance Goals**: bandeja paginada y navegación estable; carga/streaming sin base64 ni buffering integral; trabajo documental acotado
**Constraints**: deny-by-default; evidencia privada temporal; 10 MiB/archivo y 40 MiB/solicitud por defecto; PDF/JPEG/PNG; cero URLs públicas; cinco intentos automáticos máximos de eliminación
**Scale/Scope**: siete tipos, un ciclo compartido, una bandeja administrativa, flujos Expo responsive y compatibilidad 002–005

### Effective baseline and repository workflow note

La rama exacta se creó desde `develop` en `0492018b`, porque allí existe Feature 005 y `main` aún no contiene esa integración. El diseño usa ese baseline efectivo. La diferencia con el destino de integración debe resolverse en el flujo del repositorio antes del PR final; no es un bloqueo funcional de Feature 006 y este plan no cambia ramas, fusiona ni reescribe historia.

## Constitution Check

### Gate before research: PASS

| Principle | Result | Evidence |
|---|---|---|
| I. Specification-Driven | PASS | Se parte de `spec.md`; implementación queda para tareas posteriores. |
| II. Incremental and Bounded | PASS | Exactamente siete solicitudes y una frontera administrativa; sin motor genérico. |
| III–V. Player/FEM/Evidence | PASS | Pasaporte básico honesto; enriquecimiento, FEM y métricas fuera. |
| VI. Privacy/Authorization/Minors | PASS | Evidencia restringida, menor sin cuenta, capacidades backend y deny-by-default. |
| VII. Explicit Planning | PASS | Puertos reemplazables y worker local acotado, sin infraestructura especulativa. |
| VIII. Cross-Platform | PASS | Estado frontend compartido y layouts web/móvil accesibles. |
| IX. Quality | PASS | Test-first, concurrencia real y escaneo de filtraciones. |
| X–XI. Authority/Change | PASS | Sustituciones 003–005 documentadas sin reescribir historia. |
| XII. Assistant Phase | PASS | Solo artefactos de planificación autorizados. |

### Gate after design: PASS

El modelo, contratos y quickstart mantienen estos límites. No se introduce excepción constitucional. Por el riesgo transversal de autorización, privacidad, concurrencia y contratos, se recomienda `$speckit-analyze` después de generar tareas, sin convertirlo en requisito de aprobación del plan.

## Architecture Decisions

### Bounded shared domain

`RegistrationRequest` concentra id opaco, tipo, estado, propietario/contexto, versión optimista y tiempos. Cada variante tiene un registro uno-a-uno tipado; no se aceptan campos arbitrarios ni EAV. Las transiciones validan la versión vigente y generan eventos inmutables. `APPROVED` y `REJECTED` son finales.

### Pending credentials and sessions

El solicitante público crea identidad y credencial mediante la frontera existente, inicialmente en acceso de onboarding pendiente y sin roles de producto. Login, refresh, revocación y logout siguen Feature 003; autorización proyecta solo capacidades sobre sus solicitudes. La aprobación habilita la misma identidad y concede únicamente roles/relaciones expresos. El cliente nunca interpreta roles del JWT.

### Evidence and deletion consistency

PostgreSQL guarda metadatos, claves opacas, hash técnico, validación/análisis y auditoría, nunca bytes. El proveedor local escribe en volumen privado; producción implementa el mismo puerto sobre objetos privados cifrados. Aprobar prepara la versión `SUBMITTED`, confirma expediente, bloquea la decisión e inicia eliminación. Solo tras verificar ausencia de todos los objetos una transacción serializable materializa resultados, registra decisión y marca `APPROVED`. Si falla, permanece `SUBMITTED` con ejecución recuperable y sin acceso ordinario a la evidencia retirada.

El worker procesa lotes limitados Feature 006, usa lease/backoff y cinco intentos automáticos. Después exige reintento administrativo explícito. Las operaciones son idempotentes; objeto ausente cuenta como eliminación verificada.

### Approval orchestration

Cada orquestador tipado comparte precondiciones, bloqueo/versionado, transacción serializable y auditoría redactada. Reutiliza el runner P2034 existente.

| Type | Atomic result |
|---|---|
| Personal adult | USER habilitado, identidad/jugador deduplicados, SELF, un pasaporte básico activo. |
| Represented minor | USER representante habilitado, menor deduplicado, LEGAL_REPRESENTATIVE, pasaporte básico activo; sin cuenta del menor. |
| Formal academy | Academia, responsable habilitado, ACADEMY_USER, membresía activa y relación de responsable. |
| Natural-person academy | Mismo contexto inicial, evidencia operativa tipada y sin afirmar certificación legal. |
| Additional academy account | Cuenta habilitada, solo ACADEMY_USER y membresía activa en academia aprobada. |
| Academy adult player | Jugador, relación deportiva y pasaporte básico activo; sin USER ni SELF automáticos. |
| Academy minor player | Menor, responsabilidad legal sin cuenta automática, relación deportiva y pasaporte básico; sin cuenta del menor. |

### Authorization boundary

Se amplía el catálogo estático/evaluador de Feature 002 con capacidades por tipo, lectura/edición/envío propios, operaciones por academia, revisión administrativa, evidencia, expediente, decisión y eliminación. Hechos: propiedad, membresía activa, academia aprobada, autoridad responsable, estado/versión, integridad documental, edad/representación y capacidad administrativa. Controladores y rutas frontend consumen proyecciones; no contienen role checks.

### Active basic passport compatibility

Pasaportes nuevos nacen `ACTIVE` y `AWAITING_ANALYST_ENRICHMENT`; campos deportivos reservados pueden ser nulos y se muestran pendientes/no disponibles, nunca cero. Feature 006 sustituye para nuevas entradas la autoría/presentación directa de Feature 005. Datos existentes siguen legibles y no se migran silenciosamente.

## Project Structure

```text
specs/006-registration-requests-approval/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/requirements.md
└── contracts/
    ├── registration-requests.openapi.yaml
    ├── registration-authorization.md
    ├── document-evidence-lifecycle.md
    └── frontend-registration-state.md

apps/backend/
├── prisma/schema.prisma
├── src/{authentication,authorization,registration-requests,passports}/
└── test/{contract,integration,unit}/

apps/frontend/
├── app/{(public),(pending),(academy),(admin)}/
└── src/features/registration-requests/{api,components,state,validation}/
```

**Structure Decision**: conservar los dos workspaces existentes y añadir módulos por feature. Los proveedores quedan detrás del puerto backend y el frontend usa un único dueño de estado móvil/web.

## Phased Implementation Sequence

1. **Request/configuration foundation**: pruebas de enums, configuración fail-closed, modelos tipados, eventos, versiones y capacidades.
2. **Restricted credentials and lifecycle**: identidad pendiente, sesiones existentes, propiedad, draft/submit/correction/resubmit y regresión 003/004.
3. **Evidence storage and privacy**: puerto, proveedor local, adaptador productivo, cuarentena, validación, scanner, visor, replacement, auditoría, eliminación y worker.
4. **Personal registration types**: adulto propio y menor representado, Colombia/18, deduplicación y outcomes.
5. **Academy creation/account types**: formal, persona natural y cuenta adicional con membresía/autoridad vigente.
6. **Academy player request types**: adulto/menor, separación legal/deportiva y cero cuentas implícitas.
7. **Administrator review and orchestration**: bandeja, detalle, señal privada, corrección, expediente, decisión, concurrencia y recuperación.
8. **Applicant frontend**: selección, formularios, uploads, consentimientos, estado/corrección y navegación aprobada.
9. **Administrator frontend**: bandeja/detalle/visor/decisiones/deletion status por capacidades.
10. **Compatibility and final verification**: pasaporte básico, sustituciones, privacidad, accesibilidad, responsive, concurrencia y regresiones.

### Mandatory design checkpoint

**Completed 2026-09-23.** El manifiesto [docs/design/feature-006/README.md](../../docs/design/feature-006/README.md) cataloga las 31 referencias visuales aprobadas y sus rutas exactas. La implementación inicial prioriza adulto propio, menor representado, academia formal y academia de persona natural, además del acceso pendiente, borrador, evidencia, consentimiento, envío y corrección asociados. Las operaciones de academia y la revisión de Administrador permanecen como fases posteriores completas de Feature 006.

Implementación y QA visual DEBEN abrir las imágenes indicadas por el manifiesto, preservar las composiciones desktop/mobile correspondientes, capturar pantallas de runtime y registrar la comparación antes de completar trabajo visual. No se deben inventar pantallas sustitutas.

## Testing Strategy

- Test-first unitario para validación, edad, transiciones, versiones, capacidades y proyección segura.
- Contratos HTTP contra OpenAPI, incluidos errores no enumerables y ausencia de bytes/privados.
- PostgreSQL secuencial para Serializable/P2034, decisiones concurrentes, duplicados, rollback y siete outcomes.
- Evidencia con canarios sintéticos: autorización, firma/MIME/tamaño, cuarentena, malware simulado, replacement, acceso, eliminación y retry.
- Regresión 003/004 de login-refresh-revocación-logout/entrada; 005 de datos existentes/presentación honesta.
- Frontend web/móvil: restauración, progreso/retry, limpieza, navegación, foco, lector, contraste y toque.
- Escaneo de logs, errores, rutas, exports y fixtures para secretos, bytes, documentos, huellas o candidatos.

## Operational Configuration Plan

Variables tipadas y fail-closed: proveedor y raíz/bucket privados; cifrado; formatos/límites; scanner; sesión pendiente; tamaño de lotes, lease, backoff e intentos de eliminación. Desarrollo usa valores locales no secretos. Producción rechaza arranque si falta configuración privada, cifrado o scanner. Ninguna credencial real se documenta.

## Compatibility and Supersession

- **Feature 002** conserva identidad, roles, membresías, capacidades y deny-by-default; 006 añade hechos/capacidades.
- **Feature 003** conserva credenciales, sesiones y personal interno; se sustituye solo onboarding ordinario temporal.
- **Feature 004** conserva restauración, logout, accesibilidad y responsive; la acción pública pasa a “Crear solicitud de registro”.
- **Feature 005** conserva unicidad, privacidad, relaciones, selector/cartera y presentación; 006 crea nuevos pasaportes básicos y difiere autoría deportiva.

## Risks and Controls

| Risk | Control |
|---|---|
| Documento accesible después de decisión | Retiro inmediato, eliminación verificada y finalización posterior. |
| Sesión pendiente obtiene producto | Clase explícita, catálogo y deny-by-default. |
| Duplicado concurrente | Huellas, restricciones, Serializable y retry acotado. |
| Scanner falla | Cuarentena fail-closed. |
| Proveedor acoplado | Puerto y claves opacas. |
| Worker infinito | Lote/lease/backoff/cinco intentos y recuperación explícita. |
| Filtración API/UI | DTOs seguros, visor separado, auditoría y tests. |

## Complexity Tracking

No hay violaciones constitucionales. El worker acotado se justifica porque PostgreSQL no puede confirmar atómicamente la eliminación de un objeto externo; queda limitado a Feature 006 y evita una plataforma de jobs genérica.

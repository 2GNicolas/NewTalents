# Identidad, roles y autorización

## Propósito y límites

Feature 002 proporciona una base interna de identidad, roles funcionales, membresías de academia,
evaluación de autorización y cambios privilegiados auditables. Se compone en el backend mediante
módulos Nest sin controladores, rutas ni efectos de inicio; crear la aplicación no crea identidades,
roles, academias ni membresías.

No implementa login, credenciales, contraseñas, tokens, JWT, sesiones, cookies, encabezados de
autenticación, guards, autorización de frontend, endpoints de producto, bootstrap del primer
Administrador, jugadores, pasaportes, academias de jugadores, FEM, partidos, estadísticas, videos,
pagos ni notificaciones.

## Módulos internos

- `IdentityModule` exporta el ciclo de vida de una identidad opaca. Una identidad puede estar
  `ACTIVE` o `INACTIVE`; las búsquedas no exponen datos personales y una identidad inactiva no aporta
  contexto autorizado.
- `IdentityModule` también exporta el historial de asignaciones de rol. Las asignaciones activas se
  consultan por identidad; una revocación conserva el registro histórico y deja de conceder el rol.
  Los roles son Administrator, Analyst, Tutor y Academy User; una identidad puede conservar varias
  asignaciones activas válidas.
- `AcademyMembershipModule` exporta creación, finalización, consulta actual e historial de
  membresías. PostgreSQL impone una sola membresía `ACTIVE` por Academy User mediante un índice
  parcial; los registros `ENDED` se conservan y no conceden acceso.
- `AuthorizationModule` exporta el evaluador y su contrato interno versionado. Sus llamadores
  entregan explícitamente el contexto opaco de identidad o anonimato, roles activos, permiso,
  clasificación del recurso, membresía de academia y relaciones de tutor cuando correspondan.
  Devuelve solamente una decisión allow/deny, una categoría segura de denegación y la versión de
  política.
- `PrivilegedChangesModule` exporta las operaciones internas de asignación y revocación de rol y de
  asignación, cambio y revocación de membresía. No incorpora bootstrap ni datos de ejemplo.

## Evaluación y permisos

El catálogo estático y versionado limita los permisos disponibles. El evaluador niega por defecto:
solo permite una acción cuando la identidad está activa, tiene una asignación activa aplicable al
permiso, y se satisfacen los límites de clasificación, relación de tutor y membresía de academia.
El contexto anónimo nunca se convierte en rol autenticado y solo puede acceder a información pública
autorizada. Un llamador futuro reutiliza el contrato de
`src/authorization/authorization.contract.ts`; no debe duplicar comprobaciones de rol ni inferir
autorización desde una interfaz.

## Cambios privilegiados y auditoría

Los cambios privilegiados usan el evaluador interno con un contexto explícito de actor. Solo un
Administrator activo con el permiso aplicable puede modificar roles o membresías. Tanto resultados
aplicados como intentos denegados generan un registro inmutable con identificadores opacos de actor
y objetivo, operación, estados previo y resultante, resultado, categoría segura, versión de política
y fecha. No se persiste carga sensible.

La operación privilegiada es propietaria de una única transacción interactiva Prisma: mutación y
auditoría se confirman juntas. Si no puede persistirse una auditoría aplicada, la mutación revierte.
Las operaciones usan aislamiento `Serializable`. Solo un conflicto `P2034` se reintenta: un intento
inicial y hasta dos reintentos, con esperas deterministas sin jitter de 50 ms y 100 ms. Otros errores
no se reintentan; agotar los tres intentos devuelve un conflicto controlado.

## Desarrollo y validación

Con el entorno local de Feature 001 disponible, genere el cliente y aplique las migraciones con los
comandos existentes:

```powershell
npm run prisma:generate
npm run db:up
Set-Location apps/backend
npx prisma migrate status
```

La verificación de esta base combina `typecheck`, `build`, pruebas unitarias, las pruebas de
integración PostgreSQL ejecutadas secuencialmente y las pruebas de contrato. Las comprobaciones
`/health/live` y `/health/ready` de Feature 001 siguen siendo las únicas rutas de salud; no existe
una ruta HTTP para los servicios de esta característica.

## Matriz de trazabilidad de cierre

| Requisito | Evidencia implementada y verificada |
|---|---|
| FR-001 | Modelo `Identity`, `IdentityService` y pruebas de esquema y ciclo de vida. |
| FR-002 | `RoleAssignment`, historial activo/revocado y pruebas de persistencia. |
| FR-003 | Contrato de contexto anónimo y matriz de autorización. |
| FR-004 | Hechos explícitos de relación Tutor-recurso en la matriz. |
| FR-005 | Modelo, índice parcial y pruebas de membresía e historial. |
| FR-006 | Catálogo y comprobaciones de Academy User con una sola membresía activa. |
| FR-007 | Roles Administrator y Analyst separados en modelo, catálogo y pruebas. |
| FR-008 | `AuthorizationService` evalúa rol aplicable, estado, permiso y hechos requeridos. |
| FR-009 | Matriz de autorización con denegación predeterminada. |
| FR-010 | Módulos internos compuestos y prueba de bootstrap sin rutas de negocio. |
| FR-011 | Ciclo de vida y matriz cubren identidad inválida, desconocida e inactiva. |
| FR-012 | Índice parcial, concurrencia y denegación de membresía inactiva o ajena. |
| FR-013 | Matriz cubre relación Tutor-recurso ausente o no aplicable. |
| FR-014 | Matriz verifica que ningún menor recibe rol de cuenta. |
| FR-015 | Matriz mantiene el anonimato separado y deniega recursos protegidos. |
| FR-016 | Clasificación pública, protegida y sensible en contrato y matriz. |
| FR-017 | Cambios de rol por Administrator mediante evaluador y pruebas privilegiadas. |
| FR-018 | Asignar, cambiar y revocar membresías por Administrator y pruebas privilegiadas. |
| FR-019 | Modelo de auditoría y pruebas de cambios aplicados y denegados. |
| FR-020 | Transacciones, rollback y pruebas de ausencia de mutación denegada. |
| FR-021 | Exportaciones mínimas de módulos y contrato interno sin acoplar flujos futuros. |
| FR-022 | Categorías seguras y auditoría opaca sin carga sensible. |
| FR-023 | Auditoría de rutas y documentación de exclusiones de autenticación. |
| FR-024 | Roles separados, multirrol con límites, Administrator-only y una membresía activa. |

| Criterio | Verificación de cierre |
|---|---|
| SC-001 | Matriz de autorización y pruebas de historial de roles aprobadas. |
| SC-002 | Matriz de casos inválidos, anónimos e inactivos aprobada. |
| SC-003 | Esquema, transición y concurrencia PostgreSQL aprobados. |
| SC-004 | Pruebas privilegiadas aplicadas, denegadas y de rollback aprobadas. |
| SC-005 | Matriz de Academy User aprobada. |
| SC-006 | Matriz de acceso público anónimo aprobada. |
| SC-007 | Revisión estática: solo controladores de salud; sin módulos ni rutas prohibidas. |

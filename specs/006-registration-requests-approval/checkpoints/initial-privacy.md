# Checkpoint inicial de privacidad — Feature 006

Fecha: 2026-09-26
Alcance: T094, exclusivamente la rebanada vertical inicial de los cuatro tipos públicos.

## Canarios y datos

- Todas las identidades, credenciales, contactos, documentos y academias usados por el checkpoint son sintéticos y se crean con marcadores únicos por ejecución.
- Los fixtures se eliminan por identificadores propios al terminar; no se reinicia PostgreSQL ni se modifican datos de desarrollo ajenos.
- No se crean semillas de producción ni se usan datos personales reales.

## Inspección ejecutada

| Superficie | Verificación | Resultado |
|---|---|---|
| Respuesta del solicitante | Solo estado, versión, capacidades proyectadas y metadatos seguros de evidencia | PASS — 0 valores protegidos |
| Respuesta Admin | Resumen, detalle mínimo e historial operativo redactado | PASS — 0 valores protegidos |
| Streaming Admin | Bytes solo por el endpoint autenticado; encabezados `no-store` y `nosniff` | PASS |
| Actor no autorizado | Respuesta indistinguible `404`, sin bytes ni metadatos internos | PASS |
| Eventos de ciclo de vida | Acción, transición, versión y categoría segura únicamente | PASS — 0 valores protegidos |
| Auditoría de acceso | Registro separado del historial de ciclo de vida | PASS |
| Exportaciones existentes | Búsqueda de los canarios sintéticos exactos del checkpoint | PASS — 0 coincidencias |
| Artefactos del checkpoint | Búsqueda de nombres de campos internos protegidos | PASS — 0 coincidencias |

## Comandos reproducibles

```powershell
npx vitest run test/contract/initial-evidence-privacy-checkpoint.contract.spec.ts --maxWorkers=1 --fileParallelism=false
npx vitest run test/contract/registration-privacy.contract.spec.ts --maxWorkers=1 --fileParallelism=false
rg -n -i --pcre2 '<canarios sinteticos del checkpoint>' apps/frontend/dist apps/backend/dist
```

Resultado final: **PASS — cero valores protegidos no autorizados**.

# Verificación backend — Feature 010

Fecha: 2026-10-15. Rama: `feature/010-analyst-workspace-foundation`. Se usaron exclusivamente datos sintéticos y PostgreSQL local.

| Comprobación | Comando | Resultado |
|---|---|---|
| Contratos HTTP | `npm exec --workspace apps/backend vitest -- run test/contract/analyst-workspace-overview.contract.spec.ts test/contract/analyst-workspace-passports.contract.spec.ts test/contract/analyst-workspace-matches.contract.spec.ts test/contract/analyst-workspace-privacy.contract.spec.ts --maxWorkers=1` | 4 archivos, 10 pruebas pasadas; salida 0. |
| Integración PostgreSQL | Desde `apps/backend`: `node test/integration/run-feature-010-workspace.mjs` | Se creó `newtalents_feature010_test_3dd454b5e32e`, se aplicaron 20 migraciones, se ejecutaron secuencialmente 6 archivos con 4 + 2 + 2 + 5 + 2 + 1 = 16 pruebas pasadas, y se eliminó esa misma base; salida 0. |
| Tipos backend | `npm run typecheck --workspace apps/backend` | Salida 0, sin errores. |
| Integridad del diff | `git diff --check` | Salida 0, sin errores de espacio en cambios rastreados. Los archivos nuevos no están incluidos por Git en esa comprobación. |

Las pruebas cubren autorización por rol/identidad/custodia actual, IDs ajenos e inexistentes con la misma denegación, `no-store`, proyecciones mínimas, contacto por titular/representante/responsable inequívoco, revocación, clasificación `America/Bogota` y lectura de `FirstMatch` sin mutación. La fuente sintética de partido posterior se usa solo en una prueba de interfaz; no se registró como fuente de producción.

La base `newtalents_feature010_manual_20261015` es separada: contiene únicamente los registros sintéticos usados para la revisión visual y se conserva temporalmente porque el propietario pidió dejar el sistema levantado. No se aplicaron migraciones nuevas de Feature 010 ni se alteró la base ordinaria.

Comprobación de cierre: los cuatro contratos volvieron a pasar (10/10); el runner aislado creó `newtalents_feature010_test_ce7d0356f9ce`, aplicó las 20 migraciones existentes, pasó las seis suites secuenciales (16/16) y eliminó esa base. `npm run typecheck --workspace apps/backend` terminó con salida 0. Con los archivos nuevos ya staged, `git diff --cached --check` terminó con salida 0.

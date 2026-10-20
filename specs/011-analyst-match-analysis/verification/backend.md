# Verificación backend — Feature 011

Fecha local: 2026-10-16. Las pruebas PostgreSQL de Feature 011 se ejecutaron secuencialmente mediante su runner aislado. La ejecución general de contratos, iniciada adicionalmente, no usó ese aislamiento y por eso **no** se cuenta como verificación PostgreSQL válida de Feature 011.

| Comprobación | Resultado | Evidencia |
|---|---|---|
| `npm run verify:toolchain` (raíz) | Pasó | Node/npm del repositorio aceptados. |
| `node test/integration/run-feature-011-match-upload.mjs` (`apps/backend`) | Pasó: 7 suites, 15 pruebas | Base exclusiva `newtalents_feature011_test_eb578b243f03`; 21 migraciones aplicadas; ejecución secuencial y eliminación de esa base al terminar. Abarca fixtures, acceso, carga/observación privada, atomicidad `RESERVED → USED`, rollback, idempotencia, carreras y separación de Feature 010/FEM. |
| `npm exec -- vitest run src/analyst-match-upload/domain/observed-event-validation.spec.ts src/analyst-match-upload/domain/confirm-upload-validation.spec.ts src/analyst-match-upload/application/analyst-match-upload-access.spec.ts src/analyst-match-upload/application/confirmed-upload-source.spec.ts --maxWorkers=1` | Pasó: 4 suites, 13 pruebas | Catálogo, minutos/participación/URL, autoridad y fuente. No requiere PostgreSQL. |
| `npm exec -- vitest run test/contract/analyst-match-capture.contract.spec.ts test/contract/analyst-match-confirm.contract.spec.ts --maxWorkers=1` | Pasó: 2 suites, 8 pruebas | GET/POST privados, errores mínimos y `no-store`. |
| `npm run typecheck` (raíz) | Pasó | TypeScript backend y frontend. |
| `npm run test:backend:contract` (raíz) | Falló fuera de las suites Feature 011: 83 pruebas pasadas, 1 fallida, 2 omitidas | `passport-lifecycle.contract-spec.ts` (Feature 005) devuelve 500 en devolución administrativa; se reproduce al ejecutar esa suite sola (9/10 pasan). `first-match-privacy.contract.spec.ts` rehúsa ejecutarse contra `new_talents_local` porque exige su base temporal Feature 009. No se desactivó su resguardo ni se apuntó a la base normal. |

Las suites PostgreSQL de Feature 011 se corrieron solo con el runner aislado. La ejecución general de contratos empleó `new_talents_local`: la suite Feature 005 creó datos transitorios y ejecutó su limpieza habitual; no se verificó independientemente la ausencia de residuos. Fue una desviación del aislamiento solicitado y no se repetirá contra esa base. La falla de Feature 005 y la precondición de base de Feature 009 impiden declarar verde la ejecución general de contratos; no se atribuyen a Feature 011 sin una investigación propia. No hubo consulta a YouTube ni creación de evaluación FEM.

## Reejecución enfocada de cierre — 2026-10-20

Desde `apps/backend`, `npx vitest run src/analyst-match-upload --reporter=dot` pasó **4 archivos/17 pruebas** y `npx vitest run test/contract/analyst-match-capture.contract.spec.ts test/contract/analyst-match-confirm.contract.spec.ts --reporter=dot` pasó **2 archivos/8 pruebas**. `node test/integration/run-feature-011-match-upload.mjs` pasó **7 archivos/15 pruebas** secuencialmente: aplicó 21 migraciones a `newtalents_feature011_test_32002eaeead9` y eliminó únicamente esa base temporal al terminar. `npm run typecheck` en `apps/backend` y `npm run verify:toolchain` en la raíz pasaron. No se repitió la suite general ajena ni se modificó la guía FEM.

## Comprobación previa al commit — 2026-10-20

`npm run test:unit --workspace @new-talents/backend -- src/analyst-match-upload` pasó **4 suites/17 pruebas**. `npx vitest run test/contract/analyst-match-capture.contract.spec.ts test/contract/analyst-match-confirm.contract.spec.ts` pasó **2 suites/8 pruebas**. El runner PostgreSQL aislado pasó **7 suites/15 pruebas**, aplicó 21 migraciones a `newtalents_feature011_test_61d93289f171` y eliminó esa base al terminar. `npm run typecheck` pasó en ambos workspaces. La invocación general `npm run test:contract --workspace @new-talents/backend -- ...` ejecutó todos los contratos y falló por el 500 conocido de Feature 005 y la precondición de base aislada de Feature 009; **no** se declara verde esa suite general. La guía FEM local no se modificó ni se incorpora al commit.

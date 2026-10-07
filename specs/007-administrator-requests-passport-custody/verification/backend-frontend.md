# Feature 007 backend/frontend verification

Date: 2026-10-01

Result: PASS for the focused Phase 11 automated gates.

## Contract and focused backend suites

All commands used direct test paths and one worker so the workspace scripts could not expand into unrelated historical suites.

```powershell
npm exec --workspace=@new-talents/backend vitest run src/authorization/administrator-custody-authorization.spec.ts src/identity/analyst-operational-profile.service.spec.ts src/registration-requests/review/admin-operational-workspace.service.spec.ts src/registration-requests/http/admin-registration-operations.controller.spec.ts src/registration-requests/review/admin-dossier-query.service.spec.ts src/registration-requests/http/admin-dossier.controller.spec.ts src/player-passport/passport-authorization/passport-custody-authorization.adapter.spec.ts src/player-passport/passport-authorization/passport-authorization.adapter.spec.ts -- --maxWorkers=1 --no-file-parallelism
npm exec --workspace=@new-talents/backend vitest run src/passport-custody/persistence/passport-custody-schema.spec.ts src/passport-custody/application/passport-custody-query.service.spec.ts src/passport-custody/application/passport-custody-command.service.spec.ts src/passport-custody/application/passport-custody-change-remove.spec.ts src/passport-custody/application/passport-custody-concurrency.spec.ts src/passport-custody/application/passport-custody-history.mapper.spec.ts src/passport-custody/application/analyst-passports-query.service.spec.ts -- --maxWorkers=1 --no-file-parallelism
npm exec --workspace=@new-talents/backend vitest run src/passport-custody/http/passport-custody.controller.spec.ts src/passport-custody/http/passport-custody-change-remove.controller.spec.ts src/passport-custody/http/passport-custody-conflict.spec.ts src/passport-custody/http/analyst-passports.controller.spec.ts src/passport-custody/http/passport-custody-detail.controller.spec.ts test/contract/admin-custody.openapi.spec.ts test/contract/admin-custody-implementation.contract.spec.ts test/contract/administrator-dossier-privacy.contract.spec.ts test/contract/registration-openapi-implementation.contract.spec.ts test/contract/registration-privacy.contract.spec.ts test/contract/registration-requests.openapi.spec.ts -- --maxWorkers=1 --no-file-parallelism
```

Result: 26 files, 120 tests passed. The new implementation contract found that Nest defaulted the three custody command POST handlers to 201; adding explicit `@HttpCode(200)` aligned generated runtime behavior with the approved contract. The rerun passed 4/4 implementation-contract assertions, including 11 paths, 29 closed schemas, no-store metadata, safe errors, and Feature 005/006 compatibility.

## Focused frontend suites

```powershell
npx jest --runInBand src/administrator/administrator-api.spec.ts src/administrator/requests/admin-requests-state.spec.ts src/administrator/requests/admin-requests-workspace.spec.tsx src/administrator/requests/admin-request-routing-regression.spec.tsx src/administrator/shell/administrator-shell.spec.tsx src/administrator/custody/passport-custody-state.spec.ts src/administrator/custody/passport-custody-workspace.spec.tsx src/administrator/custody/custody-confirmation-state.spec.ts src/administrator/custody/custody-confirmation.spec.tsx src/administrator/custody/custody-change-remove.spec.tsx src/administrator/custody/custody-conflict-state.spec.ts src/administrator/custody/passport-custody-detail.spec.tsx src/administrator/dossiers/admin-dossiers-state.spec.ts src/administrator/dossiers/admin-dossiers-list.spec.tsx src/administrator/dossiers/admin-dossier-detail.spec.tsx src/passport/analyst-custody-access.spec.ts src/authentication/authenticated-route-policy.spec.ts
```

Result: 17 suites, 92 tests passed.

## Sequential PostgreSQL suites

Each command ran after the preceding process completed.

```powershell
npm exec --workspace=@new-talents/backend vitest run test/integration/passport-custody-schema.integration.spec.ts -- --maxWorkers=1 --no-file-parallelism
npm exec --workspace=@new-talents/backend vitest run test/integration/passport-custody-assignment.integration.spec.ts -- --maxWorkers=1 --no-file-parallelism
npm exec --workspace=@new-talents/backend vitest run test/integration/passport-custody-change-remove.integration.spec.ts -- --maxWorkers=1 --no-file-parallelism
npm exec --workspace=@new-talents/backend vitest run test/integration/passport-custody-concurrency.integration.spec.ts -- --maxWorkers=1 --no-file-parallelism
npm exec --workspace=@new-talents/backend vitest run test/integration/analyst-custody-access.integration.spec.ts -- --maxWorkers=1 --no-file-parallelism
npm exec --workspace=@new-talents/backend vitest run test/integration/passport-custody-authorization-regression.integration.spec.ts -- --maxWorkers=1 --no-file-parallelism
npm exec --workspace=@new-talents/backend vitest run test/integration/administrator-dossiers.integration.spec.ts -- --maxWorkers=1 --no-file-parallelism
npm exec --workspace=@new-talents/backend vitest run test/integration/administrator-requests-feature-006-regression.integration.spec.ts -- --maxWorkers=1 --no-file-parallelism
```

Result: 8 files, 15 tests passed. The first four runs emitted the existing `pg@8` warning about calling `client.query()` while a query is active; no assertion or transaction failed.

## Build/static gates

```powershell
npm run typecheck --workspace=@new-talents/backend
npm run typecheck --workspace=@new-talents/frontend
npm run export:web --workspace=@new-talents/frontend
git diff --check
```

Both targeted typechecks passed. The final web export completed with 74 static routes, including `/admin` and `/(admin)/admin`. `git diff --check` passed with no whitespace errors.

An initial aggregate parallel attempt hit worker heap/file-read pressure after 25/26 backend files and 16/17 frontend suites. It was discarded as evidence and replaced by the direct serial commands above; there were no behavior failures in the reruns.

## Administrator home closure

Only the affected frontend paths were rerun after adding the missing `/admin` index:

```powershell
npx jest --runInBand src/administrator/home/admin-home-state.spec.ts src/administrator/home/admin-home.spec.tsx src/administrator/home/admin-home-route.spec.ts src/administrator/shell/administrator-shell.spec.tsx
npm run typecheck --workspace=@new-talents/frontend
npm run export:web --workspace=@new-talents/frontend
git diff --check
```

Result: 4 suites / 9 tests passed; frontend typecheck passed; web export produced 74 routes with `/admin`; and `git diff --check` passed. No backend or unrelated suite was rerun for this closure.

# Quickstart: focused Feature 008 verification plan

This is a future implementation verification guide, not evidence that tests or code have run. Use synthetic passports/Administrators; do not store personal identity data, credentials, runtime screenshots, or real match records.

1. **Preparation**: From the repository root, install the existing workspace dependencies (`npm install` if absent), configure the existing local PostgreSQL test environment, then apply only the additive allowance migration in a disposable/local database. After implementation, generate the Prisma client with `npm --prefix apps/backend run prisma:generate`. Confirm existing passport, custody, dossier and approval rows are unchanged, and no allowance rows were backfilled. Run PostgreSQL integration suites sequentially.
2. **Collection and authorization**: With an active Administrator, open `/admin/passports`; verify one card per authorized passport across active and non-active states, independent of custody. Open an active and non-active detail. Verify non-active write is unavailable. Inactive/revoked Administrator and guessed IDs expose no protected projections and never mutate data. Confirm existing Custodia and Feature 005 `/passports` behavior is unchanged.
3. **First confirmation**: On an active passport with no aggregate, observe “Sin configuración” and server Colombia date. Select each allowed cadence in focused cases, enter a positive integer, review summary, cancel once, then explicitly confirm. Reload and verify one aggregate, one revision, exact cadence/limit and server-computed activation date. Invalid/zero/fractional/overflow limit, unknown cadence, stale preview date, and non-active passport must leave no partial row.
4. **Period matrix**: For 2026-10-09 monthly, verify current interval `[2026-10-09, 2026-11-09)` and UI last day 2026-11-08. Test 1/3/6/12-month cadences at year turnover and anchors 29, 30, 31 including leap February. Verify adjacent boundaries are equal with no gap/overlap or cumulative clamp drift. Verify the same result from Administrator projection and future-consumer read port.
5. **Update/history**: Confirm a limit-only change, then a cadence change. Current period remains unchanged; each takes effect at its next old-period boundary. Initial `activatedOn` never changes. Review current/pending state and immutable previous/new snapshots with actor and time. Cancel another proposal and verify no revision. For two proposals targeting the same future boundary, reject the stale-version proposal without mutation; only after reading the latest version may an Administrator review and confirm a further change. Retain every accepted revision in history.
6. **Concurrency/failure**: Race two Administrators using the same expected version. Exactly one wins; loser receives safe conflict and refreshes before re-confirming. Replay successful same-key/same-intention without a duplicate revision; same key/different intent conflicts. Inject precommit failure and serialization retry exhaustion; verify rollback and no partial version/event.
7. **Frontend/visual**: In the normal authenticated app, compare desktop/mobile composition with the two approved Administrator references while retaining existing passport detail and shell. Verify form validation, review/cancel, keyboard/touch focus, reduced motion, restricted/error/empty states, and no horizontal scroll. Assert no fabricated “utilizados”, “disponibles”, progress bar, match list, photo, FEM result, payment or subscription output.

Completion evidence should include focused command/results, migration invariants, authenticated browser checks, `git diff --check`, and a scope/privacy review. Do not treat this guide as authorization to implement scheduling or usage accounting.

## Focused command shape after implementation

Use actual Feature 008 test file paths once added; do not run broad legacy suites solely for this feature:

```powershell
npm --prefix apps/backend run typecheck
npm --prefix apps/frontend run typecheck
npm --prefix apps/backend exec -- vitest run <affected-backend-spec-paths>
npm --prefix apps/frontend run test:unit -- --runTestsByPath <affected-frontend-spec-paths>
git diff --check
```

For authenticated visual checks, start the existing backend/frontend using their normal local configuration (`npm --prefix apps/backend run dev` and `npm --prefix apps/frontend run web`), then test the Administrator routes on desktop and mobile. The placeholders above are intentionally not runnable until the affected test files exist; do not interpret them as created tasks.

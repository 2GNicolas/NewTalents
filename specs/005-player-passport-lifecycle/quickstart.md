# Quickstart: Player Passport Lifecycle Validation

This guide validates the corrected Feature 005 after corrective tasks are implemented. It does not authorize deployment, production data use or legal-compliance claims.

## Prerequisites

- Branch `feature/005-player-passport-lifecycle`.
- Node.js `>=24.11.0 <25` and npm `10.8.0`.
- Docker with the repository PostgreSQL service available.
- Local environment files configured from repository examples.
- Valid local encryption and fingerprint keys for passport private data.
- The deterministic synthetic fixtures supplied by the focused integration tests for active `USER`, `ACADEMY_USER`, Analyst and Administrator identities; active/inactive memberships; adult and minor birth dates; and controlled historical `TUTOR` cases. Do not add production seeds for this validation.
- No production personal data.

## Start the local database

```powershell
npm run verify:toolchain
npm run db:up
npm run db:status
```

Apply only the reviewed additive migration produced by the corrective tasks. Existing migrations and historical audit rows must not be edited.

```powershell
npm exec --workspace=@new-talents/backend -- prisma migrate deploy
```

## Start the local applications

Run each command from the repository root in a separate terminal and leave both processes running during manual validation:

```powershell
npm run dev:backend
npm run dev:frontend:web
```

- Backend health: `http://localhost:3000/health/live` and `http://localhost:3000/health/ready`.
- Web application: `http://localhost:8081/login`.

## Static and automated validation

Run from the repository root, after all corrective implementation tasks are complete:

```powershell
npm run prisma:generate
npm run typecheck
npm test
npm run test:backend:contract
npm run test:backend:integration
npm run test:frontend
npm run export:web --workspace=@new-talents/frontend
```

PostgreSQL integration suites run sequentially when they share database state. A failing correction test is not bypassed by marking the task complete.

## Required scenario matrix

### 1. Particular adult (`USER` + `SELF`)

1. Authenticate as an active `USER` whose validated birth date makes the player at least 18 in Colombia.
2. Create “mi pasaporte” without an `isAdult` authority field.
3. Verify one `PARTICULAR` draft, one `SELF` responsibility and one audit sequence commit atomically.
4. Repeat with a different document and verify a safe conflict: the identity cannot obtain a second self passport.
5. Verify the same user may still represent authorized minors through separate relationships.

### 2. Particular representative (`USER` + `LEGAL_REPRESENTATIVE`)

1. Create a minor passport while authenticated as the representative.
2. Supply the private representative identity, declared relationship and explicit authority confirmation.
3. Verify no account or credentials are created for the minor.
4. Verify private representative data is absent from presentation, ordinary history, logs and denial responses.
5. Attempt creation without confirmation or with a future/invalid birth date and verify atomic rejection.

### 3. Academy-created minor

1. Authenticate as the representative and create the player-bound representation confirmation.
2. Authenticate as an active member of the target academy and create the draft using that confirmation.
3. Verify `ACADEMY` responsibility and legal representation remain separate and the confirmation is consumed once.
4. Attempt confirmation by the academy employee, an expired confirmation, reuse, mismatched player fingerprint and inactive membership; each must fail without partial records.
5. Authenticate as a different active employee of the same academy and verify authorized management does not depend on the original creator.

### 4. Colombia/18 boundaries

With an injected backend date, test the day before, exact day and day after the 18th birthday. Also test a 29 February birth in leap and non-leap years and a client clock disagreeing with the backend.

Expected results:

- the backend Colombia date always decides;
- adulthood starts on the 18th birthday;
- the non-leap anniversary for 29 February is 1 March;
- declared football category is unchanged and independent;
- `isAdult` is rejected/ignored as authority.

### 5. Turning 18 and date correction

1. Prepare a represented minor with an editable passport.
2. Move the injected date to the 18th birthday or attempt a birth-date correction that makes the player adult.
3. Verify no account, `SELF`, transfer or new lifecycle state is created.
4. Verify historical responsibility remains readable to authorized internal audit, while new representative mutations return safe `No disponible`.
5. Verify an incompatible correction is rejected atomically.

### 6. Duplicate prevention and private review

1. Submit concurrent creation attempts for the same normalized document.
2. Verify exactly one passport and responsibility commit and the other request receives a non-disclosing conflict.
3. Create a name/date similarity and verify the draft may reach `En revisión`.
4. Verify approval fails while the private signal is unresolved.
5. Resolve as different, correctable and confirmed-existing in separate cases.
6. Verify ordinary particular/academy history contains neither detection nor resolution events/details, while capability-gated internal history preserves the immutable safe audit.

### 7. Lifecycle and role separation

Exercise `Borrador → En revisión → Devuelto → En revisión → Aprobado → Activo`.

Verify:

- only authorized relationship/membership holders edit, submit and correct;
- only an Analyst with review capability returns, resolves or approves;
- only an Administrator with activation capability activates;
- approval never activates;
- invalid, stale and concurrent transitions leave state and trace unchanged;
- an identity with both internal capabilities is still checked independently per operation.

### 8. Entry routing and presentation

Verify on mobile and web:

- one particular passport opens `Resumen` regardless of creation capability;
- several particular passports open a selector containing only authorized players;
- academy context always opens its portfolio, even with one passport;
- mixed particular/academy contexts do not merge;
- an active passport opens `Resumen`, with status/history secondary;
- player identity remains visible across all four sections;
- mobile tabs sit below identity and desktop navigation remains in the left column;
- missing data is never zero or an inferred sports claim;
- `Estadísticas`, `Partidos` and `Videos` are explicitly unavailable;
- the photograph area is a local neutral marker without media controls.

### 9. Historical `TUTOR` reconciliation

1. Run the explicit reconciliation against complete, incomplete, adult and ambiguous historical fixtures.
2. Run it again.
3. Verify identity IDs, role rows, origin, `InitialTutorResponsibility` and prior audit remain unchanged.
4. Verify only eligible confirmed minor records gain `LEGAL_REPRESENTATIVE` facts; none gain `SELF` automatically.
5. Verify results are idempotent, append-only and contain no documents, birth dates or complete declarations.
6. Verify the `TUTOR` role alone grants no passport access.

### 10. Authentication and regression boundaries

Verify `USER` can use the existing controlled authentication/session flow without role creation during login or refresh. Re-run Feature 001–004 regression suites and confirm health, membership, internal capabilities, token renewal, revocation, logout and Feature 004 responsive/accessibility behavior are unchanged.

## Repeatable local manual-review data

With PostgreSQL on `localhost:5433`, the backend and Expo Web already running, provision the synthetic Feature 005 review matrix from the repository root:

```powershell
npm run dev:provision-review
```

The command accepts the shared password only through a hidden interactive prompt. It fails closed unless `NODE_ENV` is non-production and `DATABASE_URL` points to `localhost:5433`; it only reconciles `@newtalents.local` identities and their explicitly marked synthetic records. It never stores or prints the plaintext password. Re-running it is idempotent.

The command also performs focused runtime smoke checks for all provisioned logins, particular routing, the represented-player selector, academy portfolio, mixed-context separation, internal capability separation, protected response data and nested web routes.

## Security inspection

Inspect API responses, test logs, frontend diagnostics and exported web assets. They must contain none of the following outside their explicitly authorized private contract:

- player or representative document values/fingerprints;
- birth dates;
- representative relationship/declaration content;
- duplicate candidates, signals or resolutions in ordinary history;
- account/academy contacts, tokens or session values;
- precise minor locations;
- photograph URLs, binaries or file identifiers.

All protected responses must use `Cache-Control: no-store`; unauthorized requests must not confirm whether the passport or player exists.

## Cleanup

```powershell
npm run db:down
```

Do not remove persistent local volumes unless that destructive action is separately intended and authorized.

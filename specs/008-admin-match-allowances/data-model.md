# Data model: Administrator match allowance

This is a proposed additive model, not a migration or implementation. `PlayerPassport` and its existing custody/lifecycle fields remain unchanged.

## Aggregate and invariants

| Record | Required fields | Invariants |
|---|---|---|
| `PassportMatchAllowance` | `id`, `passportId`, `activatedOn` (Colombia date), `version`, `createdAt`, `updatedAt` | `passportId` is unique and references an existing passport restrictively; `activatedOn` is immutable; version starts at 1 and increments once per confirmed revision. Absence of a row means unconfigured, not zero allowance. |
| `PassportMatchAllowanceRevision` | `id`, `allowanceId`, `sequence`, `idempotencyKey`, `cadence`, `matchLimit`, `effectiveOn`, `confirmedAt`, `confirmedByIdentityId`, previous/new value snapshot | Append-only; `(allowanceId,sequence)` and `(allowanceId,idempotencyKey)` unique; `sequence = aggregate.version` at commit; cadence in `{MONTHLY,QUARTERLY,SEMIANNUAL,ANNUAL}`; limit is a positive safely representable integer. Actor identity FK is restrictive. Previous values are null only on creation. |

`effectiveOn` and `activatedOn` are date-only values; `confirmedAt` is an instant. A revision records the complete new cadence/limit, prior cadence/limit, prior effective boundary when applicable, and whether it superseded a previously confirmed pending revision. Nothing stores utilization, available matches, match identifiers, payments, or sport metrics. No automatic allowance row is created when a passport is approved or custody changes.

## Rule and period resolution

For Colombia-local date `D`, resolve the accepted revision effective for `D`; if none, the rule has not yet started. A read before a pending boundary still resolves the prior rule. The initial revision has `effectiveOn = activatedOn =` server-computed Colombia date at confirmation. A confirmed update has `effectiveOn = next boundary of the currently effective period` as calculated at confirmation. Any further update targeting that boundary requires a fresh read of the latest version and a new confirmation; a stale-version command is rejected without mutation. All accepted revisions remain auditable, including a pending rule subsequently changed by an explicitly confirmed current-version command.

The initial segment anchor is `activatedOn`. Cadence maps to 1, 3, 6, or 12 calendar months. For segment anchor `A` and index `n >= 0`, boundary `B(n)` is the date in month `A + n*cadence` with the original anchor day, clamped to that target month's last day when needed. Every period is `[B(n), B(n+1))`; the UI may show `B(n+1) - 1 day` as its inclusive last day. Compute every `B(n)` from `A`, never iteratively from a clamped boundary. A limit-only revision at the next boundary keeps the existing segment anchor and cadence. A cadence revision starts a new segment anchored at its effective boundary, without changing `activatedOn` or prior periods. The next update boundary must be obtained from the period currently in force on the Colombia date of confirmation, even when an earlier pending revision exists.

Examples: Monthly activation 2026-10-09 yields `[2026-10-09, 2026-11-09)`, then `[2026-11-09, 2026-12-09)`. Monthly 2026-01-31 yields boundaries 2026-02-28 and 2026-03-31; leap-year February can end on the 29th. An update confirmed during the October period first applies 2026-11-09. All date calculations use the `America/Bogota` local day, not a browser clock or UTC date string.

## State and access

- `UNCONFIGURED`: no aggregate, writable only if the passport is `ACTIVE` and the current actor has the Administrator capability.
- `CONFIGURED`: one aggregate with at least one revision; expose current rule, period boundaries, optional pending revision, version, and audit history to authorized Administrators. A passport becoming non-active retains history but disallows new writes.
- `CONFLICT`: rejected write due to stale version or changed Colombia date; no row/revision/version change.
- `INELIGIBLE`/`DENIED`: no mutation and no sensitive detail in the error. Direct-ID denial and missing passport must be indistinguishable.

All writes recheck passport state and current authorization inside the transaction, lock the passport row, and atomically create/update aggregate plus append revision. Successful same-key/same-intention replay returns the original command outcome; same key with different intent conflicts. Storage failure rolls back all effects. A future match-scheduling feature may consume an internal read projection `{passportId, date, cadence, matchLimit, periodStart, periodEndExclusive, revisionId}`; this feature creates neither its API nor its consumer.

## Migration and compatibility

Add tables, enum/check constraints, unique indexes and restrictive foreign keys only. Do not backfill historical passports, invent activation dates, or mutate `PlayerPassport`, `PassportCustody`, approval, dossier, or Analyst rows. Verify old rows and Feature 007 routes remain operational after migration.

# Research: Administrator match allowances

## Governing facts and minimal correction

- `spec.md` FR-004/014/015 and the user's 2026-10-09 decisions govern activation: the initial date is the Colombia-local date at confirmation, is never chosen or edited by the Administrator, and changes take effect at the next period boundary.
- User Story 1, its independent test, and FR-004/012 previously said to enter or select a date. They received a wording-only correction before planning; no new business rule was added. The approved desktop/mobile screen does not contain a date picker, so the date appears as a non-editable authoritative value.
- Existing `PassportCustody` reads only `ACTIVE` + `AWAITING_ANALYST_ENRICHMENT`; it cannot supply the required all-passport cards. Feature 005's `/passports` collection is context-bound to personal/academy access. A separately authorized Administrator read model is necessary.

## Decisions

### 1. Separate bounded module and authorization

**Decision**: Add an Administrator passport/allowance boundary with capabilities for all-passport list, safe detail, allowance read, write, and history. Evaluate active identity and Administrator role in the backend on every request; recheck passport `ACTIVE`, command version, and administrative authority within each write transaction. Compose with existing passport/custody read projections for eligible passports; do not broaden the Custody list or Analyst authority.

**Rationale**: The new collection includes all passport states, while only active passports can receive a configuration. Existing Custody and lifecycle decisions remain intact.

**Alternatives considered**: Reusing the Custody list omits non-basic or nonactive passports; changing Feature 005's personal/academy collection would widen unrelated authority.

### 2. One aggregate, immutable confirmed revisions

**Decision**: One allowance aggregate per passport stores immutable initial activation date and a monotonically increasing command version. Each confirmed creation/update appends a revision with period, positive limit, effective date, actor, time, sequence, expected version, and idempotency key. A stale-version command is rejected without mutation; a further change, including one targeting an already pending boundary, requires reading the latest version and a new explicit confirmation. All accepted revisions remain in history. No scheduled worker or materialized usage counter is required.

**Rationale**: A confirmed update must wait for the next boundary without rewriting the current period. Append-only revisions preserve traceability and allow a future scheduling module to ask for the rule in force on a given date.

**Alternatives considered**: Mutating the current row at midnight requires a worker and can lose history; multiple current rows risk overlapping authority. A mutable pending row obscures superseded confirmations.

### 3. Period arithmetic and Colombia-local date

**Decision**: Use date-only boundaries in `America/Bogota`, with 1/3/6/12-month cadence. For a rule segment anchored on date `A`, boundary `n` is `A + n × cadence months`, clamping an absent day to that target month's last day, always recomputed from `A` rather than from the previous clamped boundary. Periods are `[boundary n, boundary n+1)`; the UI shows the last included date as the day before the exclusive end. On cadence change, the next boundary of the old active rule becomes the new segment anchor; the original activation date remains immutable. A limit-only change at that boundary retains the existing cadence/anchor sequence.

**Rationale**: This yields 9 October–8 November for a monthly rule, avoids drift for 29–31 and leap years, and keeps intervals contiguous after a scheduled update. The new effective boundary is not an Administrator-selected replacement for the original date.

**Alternatives considered**: Calendar-month endings contradict the approved 9 October–8 November example. Iteratively adding months to a clamped date drifts the original anniversary. UTC-day interpretation can display the wrong Colombia date around midnight.

### 4. Confirmation, concurrency, and retries

**Decision**: The client displays the Colombia-local date for initial confirmation but sends it only as `expectedActivationDate`, not as a chosen start date. The server computes the authoritative date and rejects a stale preview if Colombia's day changed before confirmation. Require `expectedVersion` and a UUID idempotency key; serialize writes by locking the existing passport row, compare version, recheck facts, and append one revision atomically. Retry only bounded serialization failures; return a safe current projection for stale versions and a deterministic replay for the same key/intention.

**Rationale**: Prevents midnight surprise, concurrent overwrites, duplicate audit entries, and partially applied configuration. Mirrors Feature 007's proven transaction shape without sharing its aggregate.

**Alternatives considered**: Optimistic UI movement before response misstates authority; a client-provided `startDate` would violate the approved rule.

### 5. Minimum projections and visual boundary

**Decision**: Provide stable, bounded Administrator card pages and one detail route; show only authorized readable player label, masked reference, lifecycle status, permitted academy/custody labels, configuration and audit fields. Keep the established Administrator shell and passport detail sections. Add the approved allowance section's hierarchy, a read-only start date, current/next rule, confirm/discard, and last modification. Omit mock utilization, progress bar, scheduling instructions, new player photos, and any FEM/sports data.

**Rationale**: The supplied desktop/mobile images are visual authority for layout, not business-data authority. Feature 005/007 privacy and data availability still govern.

**Alternatives considered**: Rendering the screen's illustrative `2 utilizados / 2 disponibles` would fabricate usage and imply scheduling exists.

### 6. Validation boundary

**Decision**: Model the allowance as a positive integer within the application's safely representable range and reject overflow with a field error; this is a technical representability limit, not a commercial cap. Use closed inputs and `no-store` responses. No analyst, academy, representative, or user read access is introduced for this configuration.

**Rationale**: Precise round-trip and fail-closed authorization are required for a future scheduling consumer.

**Alternatives considered**: Arbitrary commercial maximum or floating-point coercion would add unsupported policy or lose integer precision.

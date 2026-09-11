# Research: Identity, Roles, and Authorization

## Active academy membership

**Decision**: Model active and historical memberships separately and enforce one active membership
per identity with a PostgreSQL partial unique index created in reviewed Prisma migration SQL.

**Rationale**: It preserves history and makes concurrent duplicate memberships impossible at the
database boundary. Prisma 7.10 supports PostgreSQL and custom migration SQL.

**Alternatives rejected**: Application pre-check only (race-prone); deleting history; a generic
trigger or exclusion constraint (unnecessary for this invariant).

Sources: [Prisma supported databases](https://docs.prisma.io/docs/orm/reference/supported-databases),
[custom migrations](https://docs.prisma.io/docs/orm/prisma-migrate/workflows/customizing-migrations),
[PostgreSQL partial indexes](https://www.postgresql.org/docs/15/indexes-partial.html).

## Transactions and concurrency

**Decision**: Use short interactive Prisma transactions with Serializable isolation. All reads,
changes, and audit writes use the transaction client. Make one initial attempt and at most two
`P2034` retries (three total attempts), after deterministic no-jitter waits of 50 ms then 100 ms.
Each retry opens a new transaction. Exhaustion returns a controlled conflict; validation, unique,
foreign-key, not-found, unsupported, and unknown failures never retry.

**Rationale**: A role or membership change and its audit record commit together or roll back together.
The partial index is the final integrity boundary; PostgreSQL's default Read Committed isolation is
not sufficient for read-decide-write transitions.

Sources: [Prisma transactions](https://docs.prisma.io/docs/orm/v7/prisma-client/queries/transactions),
[PostgreSQL isolation](https://www.postgresql.org/docs/18/transaction-iso.html).

## Permissions and contract

**Decision**: Use a static version-controlled permission catalog and a versioned internal
authorization request/decision contract.

**Rationale**: Four defined roles do not justify dynamic grants or a generic ACL engine. The request
contains opaque identity/anonymous context, active roles, requested action, permission, membership,
and caller-supplied relationship facts. The result contains only allow/deny, safe reason category,
and policy version.

## Traceability and bootstrap

**Decision**: Persist redacted records for applied and denied privileged changes. Defer the first
Administrator bootstrap to a later controlled feature/procedure; fixtures may provide one for tests.

**Rationale**: Denied attempts support security review, while opaque identifiers and categories
minimize data. No self-promotion, hardcoded administrator, password, default seed, or public
bootstrap path exists in this feature.

## Test isolation

**Decision**: Run PostgreSQL integration tests against isolated data using separate Prisma clients
for overlapping transactions; verify final state through an independent client.

**Rationale**: This proves database constraints, serialization retry, rollback, and history under
real concurrency without authentication or HTTP.

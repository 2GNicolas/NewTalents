# Data Model: Identity, Roles, and Authorization

| Concept | Required state and relations |
|---|---|
| Identity | Opaque unique identifier; ACTIVE or INACTIVE status; timestamps; no credential or login identifier. |
| Role assignment | Identity, approved role, ACTIVE or REVOKED status, timestamps, responsible Administrator; history never grants permission. |
| Academy | Opaque organizational boundary only; no profile, billing, or player relation. |
| Academy membership | Academy User identity, academy, ACTIVE or ENDED status, timestamps, responsible Administrator; history retained. |
| Change record | Opaque actor/target, operation, prior/resulting state, outcome, safe category, policy version, timestamp. |

## Integrity rules

- Multiple active roles are allowed; duplicate active assignment of the same role is not.
- Only an active Administrator can change privileged roles or Academy User memberships.
- PostgreSQL enforces one active academy membership through reviewed migration SQL using a partial
  unique index on the identity where membership status is active.
- Role/membership changes and their trace record are one Serializable transaction. Denial, audit
  failure, or exhausted retry leaves effective authorization unchanged.
- Indexes support active-role, active-membership, and historical lookup by identity.

## Non-persisted authorization context

Future resource-owning modules supply tutor relationship and resource facts to the evaluator. No
player, passport, guardian, or tutor-player record is introduced. Anonymous is an explicit
non-identity context, and only action-applicable active roles contribute.

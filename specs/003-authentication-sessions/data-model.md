# Data Model: Authentication, Sessions, and Protected Requests

## Ownership and relationships

| Concept | Ownership and required state |
|---|---|
| Identity credential | One protected credential record per existing identity; permanent Argon2id PHC hash, normalized email lookup key, credential lifecycle timestamps, and no recoverable plaintext. The identity remains owned by Feature 002. |
| Initial temporary credential | A protected, time-bounded Argon2id hash associated with an existing eligible identity; created only by Administrator provisioning, with issued, consumed, invalidated, superseded, and expired state. |
| Authentication session | One independently revocable session family per browser/device context and identity; created, last-used, expires, revoked, and revocation-reason state. Multiple active families are allowed. |
| Refresh-token history | One digest-only row per issued opaque refresh token, linked to its session family and predecessor/successor history; issued, consumed, replaced, revoked, expired, and reuse-detected state. |
| Authentication attempt window | Privacy-preserving normalized identity-key digest and source-address digest, failure count, window start/end, and closed/cleared state; no plaintext password or unnecessary raw identifier. |
| Authentication security event | Immutable redacted record of login, throttling, replacement, refresh, reuse, logout, provisioning, first initialization, recovery, and denied outcomes. |
| Existing Feature 002 records | Identity, role assignment, membership, and authorization change records remain their current owner and are referenced by foreign key where required; no duplicated role, membership, or permission model. |

## Required integrity rules

- Credential provisioning requires an existing eligible identity and changes neither identity nor role
  state. One active initial temporary credential may exist per identity; reissue atomically
  invalidates all prior unused temporary credentials.
- First-use replacement atomically consumes the valid temporary credential, installs the permanent
  Argon2id password hash, creates the first reusable session family and refresh history, and writes
  redacted security evidence. Failure leaves no partial credential or session.
- Session families belong to one identity. Logout-current terminates only its family; logout-all
  terminates every currently active family for that identity.
- Each refresh-token digest is unique. A conditional consume update permits exactly one rotation.
  Reuse of a consumed/replaced digest marks the related family revoked without affecting other
  families.
- Every protected JWT maps to an active unexpired session and active identity on the server. JWT
  claims never own role, membership, relationship, sensitivity, or permission state.
- The first-ever initialization can occur only if no Administrator role assignment has ever existed.
  Recovery can occur only if no active eligible Administrator exists; recovery never mutates
  historical rows and requires immutable redacted evidence.
- Security events are append-only. Operational cleanup may remove eligible expired/revoked session,
  token-history, and attempt-window rows only after the documented retention thresholds; audit and
  security evidence persists.

## Constraints, indexes, and migration review

| Invariant | Database enforcement or lookup |
|---|---|
| One credential per identity | Unique foreign key/identity constraint; unique normalized email lookup key. |
| One active temporary credential per identity | PostgreSQL partial unique index over identity for active/unconsumed/uninvalidated/unexpired state. |
| Refresh digest cannot be issued twice | Unique digest index. |
| Exactly one consumer for a refresh token | Conditional update plus Serializable transaction; terminal history fields make competing use observable. |
| Fast request validation | Index session ID plus active/expiry; index identity plus active session state. |
| Logout-all and deactivation | Index active sessions by identity; conditional revocation update. |
| Attempt control window | Composite index over normalized identity-key digest, source-address digest, and window end. |
| Security review | Index immutable event by identity and timestamp; optional nullable actor identity reference for operator events. |
| First initialization/recovery | Reviewed migration SQL or conditional locked query is required for the historical Administrator and no-active-eligible-Administrator predicates. |

The partial active-temporary-credential index, append-only security-event protection, and the
cross-table bootstrap/recovery predicates require reviewed migration SQL in addition to generated
Prisma migration output. Foreign keys use restrictive behavior so authentication history is not
silently orphaned or deleted.

## State transitions

```text
temporary: issued -> consumed -> retained evidence
temporary: issued -> invalidated | superseded | expired -> retained evidence

session family: active -> revoked | expired
refresh token: issued -> consumed/replaced -> retained history
refresh token: issued -> revoked | expired -> retained history
refresh token reuse: consumed/replaced presented -> family revoked

attempt window: active failures -> cleared after successful authentication
attempt window: active failures -> expired -> cleanup eligible

first initialization: never-admin -> initialized once
emergency recovery: no active eligible Administrator -> recovered -> active Administrator exists
```


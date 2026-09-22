# Data Model: Player Passport Lifecycle

## Separation of concepts

| Concept | Required state and relations |
|---|---|
| Identity / account role | Existing authenticable `Identity`. `USER` is the generic particular role; `ACADEMY_USER`, `ANALYST`, and `ADMINISTRATOR` remain independent. Historical `TUTOR` stays interpretable but is not authority by itself. |
| Player and private identity | One opaque player and one encrypted private identity per passport. A minor is never an authenticable account. Legal name, birth date and document values remain private; keyed fingerprints support duplicate checks. |
| Passport | One lifecycle record per player with football profile, creation context and optional origin academy. Origin (`PARTICULAR` or `ACADEMY`) is independent from management relationships. |
| Passport responsibility | Explicit `SELF`, `LEGAL_REPRESENTATIVE`, or `ACADEMY` relationship with status, effective time and retained history; it is not a lifecycle state. |
| Adult ownership | At most one active `SELF` per player and one self-owned passport per `USER`. Created only for an adult player bound to the authenticated identity. |
| Legal representation | One `USER` may represent several minors. Private confirmation stores declared relationship (`MOTHER`, `FATHER`, `LEGAL_GUARDIAN`), authority confirmation, actor/time and protected representative identity. |
| Academy management | Any active member of the origin academy may manage editable lifecycle work; the employee creator is not owner. An academy-created minor also requires a confirmed representative. |
| Age-policy evaluation | Redacted evidence of policy `CO-18-v1`, backend Colombia evaluation date and result `MINOR`/`ADULT`; birth date is never copied into trace. |
| Lifecycle audit | Immutable internal events. Ordinary history is filtered; duplicate review and internal audit are separately authorized projections. |

## Persisted structures

### Identity and academy extensions

- `FunctionalRole.USER` is additive. `TUTOR` remains a historical value during compatibility.
- `Academy.displayName` is the authorized presentation label. It contains no contact data and is required before an academy passport can expose an available academy name.
- Authentication/session tables are unchanged; no passport relationship is stored in a token.

### PlayerPassport

| Field | Rule |
|---|---|
| `id`, `playerId` | Opaque IDs; `playerId` remains unique. |
| `origin` | New writes use `PARTICULAR` or `ACADEMY`; historical `TUTOR` remains readable. |
| `originAcademyId` | Required only for `ACADEMY`; absent for `PARTICULAR` and historical `TUTOR`. |
| `createdByIdentityId` | Immutable audit context only; never current academy ownership. |
| `status`, `version` | Existing lifecycle state and optimistic-concurrency version. |
| football profile | Position, declared category, city, country and controlled dominant foot; no precise location. |

### PassportResponsibility

| Field | Rule |
|---|---|
| `id`, `playerId`, `passportId` | Identifies the player-specific authority fact. |
| `kind` | `SELF`, `LEGAL_REPRESENTATIVE`, or `ACADEMY`. |
| `identityId` | Required for `SELF` and `LEGAL_REPRESENTATIVE`; absent for `ACADEMY`. |
| `academyId` | Required for `ACADEMY`; absent for particular relationships. |
| `status` | `ACTIVE` or `INACTIVE`; history is retained. |
| `effectiveAt`, `endedAt` | Current validity interval. Reaching 18 does not delete the row; policy makes mutation unavailable. |
| `source` | `NATIVE` or `RECONCILED_TUTOR`; never rewrites historical origin. |
| `createdByIdentityId`, `createdAt` | Actor and time of the relationship decision. |

Constraints enforce one active `SELF` per player, one self-owned passport per identity, no duplicate active relationship of the same kind/subject, and mutually exclusive identity/academy subjects. `ACADEMY` must match `originAcademyId`.

### RepresentativeConfirmation

| Field | Rule |
|---|---|
| `id`, `representativeIdentityId` | Opaque confirmation and authenticated `USER` actor. |
| protected representative identity | Encrypted legal name, document type/number and keyed fingerprint; never copied to lifecycle trace. |
| `declaredRelationship` | `MOTHER`, `FATHER`, or `LEGAL_GUARDIAN`. |
| `authorityConfirmedAt` | Explicit actor confirmation time; no academy proxy. |
| `playerDocumentFingerprint` | Binds the confirmation to one prospective player without storing plaintext in the request handoff. |
| `expiresAt` | 24 hours after creation using backend time. |
| `consumedAt`, `consumedByPassportId` | Both null until one successful academy creation; unique/non-null together after consumption. |

Expired, consumed, mismatched or inactive-actor confirmations reject creation. Consumption occurs in the same transaction as the passport and responsibility rows.

For a particular representative creating directly, the same private facts are persisted as the passport's representation evidence during creation; no reusable confirmation token is required.

### PassportAgeEvaluation

| Field | Rule |
|---|---|
| `passportId`, `operationId` | Associates redacted evidence with the attempted material operation. |
| `policy` | Constant `CO-18-v1`. |
| `evaluatedOn` | Backend calendar date in Colombia, not a client timestamp. |
| `result` | `MINOR` or `ADULT`. |
| `operation` | Create, submit/resubmit or age-sensitive authorization/mutation. |

Birth date and completed-year count are not copied into this evidence or ordinary trace.

### HistoricalTutorReconciliation

| Field | Rule |
|---|---|
| `historicalResponsibilityId` | Stable source key; unique with reconciliation policy version. |
| `policyVersion` | Reconciliation algorithm/evidence version. |
| `result` | `RELATIONSHIP_CREATED`, `ALREADY_RECONCILED`, `INSUFFICIENT_EVIDENCE`, `AGE_INCOMPATIBLE`, or `REJECTED`. |
| `resultingResponsibilityId` | Present only when a valid relationship was created or already exists. |
| `actorIdentityId`, `occurredAt` | Explicit operator/service actor and time. |

No document, birth date, declared relationship text or full authority declaration is stored in this audit row.

### PassportLifecycleEvent

Existing immutable events remain the source for internal audit. Corrective event kinds may include relationship establishment, representation confirmation, duplicate detection/resolution and historical reconciliation. The ordinary-history mapper uses an allowlist of creator-safe lifecycle events; it never passes internal events through and then relies on UI hiding.

## Cardinalities and integrity

- Player, private identity and passport are one-to-one; document fingerprint remains globally unique.
- `Identity(USER)` to active `SELF` is zero-or-one; `Identity(USER)` to `LEGAL_REPRESENTATIVE` is one-to-many.
- A minor created by an academy has one `ACADEMY` relationship and a valid representative confirmation before the Draft commits.
- Membership and academy responsibility are different facts. Membership never creates `SELF` or legal authority.
- Creation atomically writes Player, private identity, Draft, context, responsibilities, required confirmation, age evidence, duplicate signal when applicable and redacted audit.
- Exact document duplication rejects the whole transaction. Name/date similarity may create a private signal without exposing candidate existence.
- Editing is limited to `DRAFT` and `RETURNED_FOR_CORRECTION`. A private-identity edit regenerates protected values/fingerprints, reevaluates age and atomically rejects an incompatible relationship.
- Submission reevaluates age/confirmation. Age-sensitive authorization uses the current Colombia date.
- From the eighteenth birthday, minor representation no longer permits mutations. History remains; no account, `SELF`, transfer, deletion or lifecycle state appears automatically.

## Colombia age policy

- Zone `America/Bogota`; threshold 18 completed years; valid, real, non-future `YYYY-MM-DD` birth date.
- Minor before the eighteenth anniversary and adult on/after it. For 29 February, anniversary is 1 March in a non-leap year.
- Evaluate at create, submit/resubmit and each age-sensitive authorization. Client clock and `isAdult` are never authority.
- Football age category remains independently declared.

## Historical compatibility and migration

- Add `USER` and responsibility structures through a new additive migration; never rewrite prior migrations or audit rows.
- Keep `TUTOR` assignments and `InitialTutorResponsibility` readable. Reconciliation adds evidence/relationship only when existing facts establish it; ambiguous rows grant no new access.
- A Tutor fact never becomes `SELF` automatically. Reconciliation is idempotent, deny-by-default and traceable.

## Privacy projections

- Particular/academy history omits duplicate detection and resolution events, candidate existence/IDs, fingerprints, documents, matching reasons, representative documents and internal notes.
- Analyst review receives the minimum signal projection. Internal audit reads immutable redacted events through a distinct capability.
- Presentation exposes authorized display name, football profile, academy name or unavailable, lifecycle state and neutral placeholder.
- `Resumen` uses Feature 005 data. `Estadísticas`, `Partidos`, and `Videos` remain unavailable.

## Lifecycle transitions

```text
no passport -> DRAFT
DRAFT | RETURNED_FOR_CORRECTION -> same state on edit
DRAFT | RETURNED_FOR_CORRECTION -> IN_REVIEW
IN_REVIEW -> RETURNED_FOR_CORRECTION | APPROVED
APPROVED -> ACTIVE
```

Responsibility, age and duplicate-review status are not lifecycle states; `SUSPENDED` is not introduced.

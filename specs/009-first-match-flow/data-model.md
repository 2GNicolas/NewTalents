# Data Model: First Match Passport Flow

Design only; no migration is executed in this phase. Existing `PlayerPassport`, `PassportResponsibility`, `PassportCustody`, and Feature 008 allowance/revision data remain authoritative. The entered match date is a date-only value used for allowance resolution; the entered wall-clock time is stored separately and does not shift that date or imply an unapproved time-zone conversion.

## FirstMatch

| Field | Meaning / constraint |
|---|---|
| `id` | Opaque stable match UUID; preserved on reschedule. |
| `passportId`, `playerId` | Restrictive references to existing passport/player; player must equal `PlayerPassport.playerId`. |
| `matchDate`, `matchTime` | Valid date-only and local time; allowance follows `matchDate`, not creation/load instant. |
| `opponent`, `competition`, `venue` | Required non-empty bounded user-entered labels; no fabricated sporting measurements. |
| `scheduledByIdentityId`, `scheduledAt` | Immutable responsible actor and confirmation instant. Current authorization is rechecked for later actions. |
| `state` | `WAITING`, `CANCELED`, or `LOADED`; never derived from a client-only screen. |
| `unitState` | `RESERVED`, `RELEASED`, or `USED`; one unit is owned by this row, not separately minted for reschedules/loads. |
| `version`, `updatedAt` | Monotonic concurrency version and update instant. |
| `loadedByAnalystIdentityId`, `loadId`, `loadedAt` | Set together only after a confirmed, authorized data load. No sports payload stored by this feature. |
| `canceledByIdentityId`, `canceledAt` | Set together only on pre-load cancellation. |

`(state, unitState)` pairs are limited to `(WAITING, RESERVED)`, `(CANCELED, RELEASED)`, `(LOADED, USED)`. A partial unique index on `passportId` where state is `WAITING` or `LOADED` prevents a second current first match while allowing retained canceled attempts. Unique `loadId` per successfully loaded match and an intent record prevent repeat effects. A loaded first match permanently displaces the invitation; subsequent-match management is separate.

## FirstMatchIntent / audit

| Field | Meaning / constraint |
|---|---|
| `id`, `passportId`, `matchId?` | Durable operation record, restrictively related where present. |
| `idempotencyKey`, `action`, `intentDigest` | Unique per passport/key; same key and same intent replays stored outcome, same key with different intent conflicts. Actions: `SCHEDULE`, `RESCHEDULE`, `CANCEL`, `LOAD_CONFIRMED`. |
| `actorIdentityId`, `occurredAt`, `outcome`, `resultVersion` | Minimum auditable actor, time and result; safe public projections omit private IDs. |

Record only the minimal audit needed by FR-016. A failed validation does not create a match or unit. Whether rejected attempts are operationally logged must not reveal another person's passport.

## Derived allowance period / availability

No mutable usage counter is added to Feature 008. Resolve each counted match date against its effective Feature 008 revisions, including a proposed revision during validation. For passport `P` and resolved `[start, endExclusive)`, count FirstMatch rows with `unitState IN (RESERVED, USED)` whose unchanged `matchDate` belongs to that period. `available = matchLimit - reserved - used`; unconfigured is distinct from zero availability. The period may be regrouped by a newly accepted cadence without changing a match, its date, or the identity/state of its unit. Current/earlier periods retain Feature 008's rule, and changes start at the next current-period boundary.

## Transitions and lock discipline

```text
No current first match --schedule--> WAITING / RESERVED
WAITING / RESERVED --reschedule--> WAITING / RESERVED (same match/unit; perhaps new period)
WAITING / RESERVED --cancel--> CANCELED / RELEASED
WAITING / RESERVED --confirmed authorized load--> LOADED / USED
CANCELED / RELEASED --new schedule--> new FirstMatch WAITING / RESERVED
LOADED / USED --any command in this feature--> unchanged or safe conflict
```

Booking, rescheduling, canceling, load confirmation and allowance confirmation use the same passport-row lock and serializable transaction. Recheck actor authority, passport state, match version, custody for load only, effective revision, and `reserved + used` inside that boundary. Capacity checks include the proposed new booking; a same-period reschedule excludes its own existing unit only once. On any rejection or storage failure, match, unit, allowance revision and audit outcome remain coherent. Distinct passports do not contend on one shared allowance pool.

## Existing-contract boundaries

- Feature 005: passport `ACTIVE`, player and current `SELF`/`LEGAL_REPRESENTATIVE` responsibility or eligible academy membership; no account for a minor.
- Feature 006: a final passport-producing approval may already create `ACTIVE`; pending evidence deletion is not a completed result.
- Feature 007: manual custody and immediate Analyst access revocation remain untouched. Absence of custody does not block scheduling; it prevents a valid load signal.
- Feature 008: retain revision/version/idempotency, `America/Bogota` dates, inclusive start/exclusive end, original-day anniversary clamping and next-boundary changes. The new allowance write guard reads counted first matches before accepting a proposed revision.

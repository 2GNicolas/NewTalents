# Research: Player Passport Lifecycle

**Status**: Decisions resolved for the Colombia MVP correction
**Scope**: Design evidence for Feature 005; not legal advice or proof of formal compliance

## Generic particular account and passport authority

**Decision**: Use `USER` as the generic particular account role. Persist authority separately as `SELF` or `LEGAL_REPRESENTATIVE`; persist organizational management as `ACADEMY`.

**Rationale**: A role describes an account category, while passport authority is player-specific. Separating them permits one adult to own one passport and represent several minors without multiplying global roles. It also prevents academy membership or a historical `TUTOR` assignment from becoming personal ownership.

**Rejected**:

- Keep `TUTOR` mandatory: cannot model an adult managing their own passport and over-grants from a global role.
- Infer authority from the creator: breaks academy continuity when employees change.
- Infer authority from a document entered in a form: leaks/exploits identity knowledge and bypasses explicit relationships.

## Particular self-management

**Decision**: An authenticated active `USER` may create one passport in `SELF` context only for the player identity bound atomically to that account. The database enforces at most one `SELF` passport per identity and one passport per player.

**Rationale**: This expresses the approved MVP authority without public lookup or account-to-account claims. Exact document duplication still returns a non-disclosing conflict.

**Rejected**:

- Let a user select another adult account: creates an unauthorized transfer/claim flow.
- Treat matching contact details or payment as ownership: neither proves passport authority.

## Representation of a minor

**Decision**: Require an active identified `USER`, private normalized representative identity, declared relationship, explicit authority confirmation, actor and timestamp. A particular representative confirms within creation. An academy must consume a separate authenticated, short-lived, single-use confirmation created by the representative and bound to the player's document fingerprint.

**Rationale**: The product must prove that the representative—not the academy employee—performed the confirmation. Binding it to a fingerprint prevents reuse for a different player while avoiding plaintext document propagation.

**Rejected**:

- Academy employee checks a box for the representative: contradicts the authority boundary.
- Upload custody/legal documents: outside scope and introduces media/moderation/legal-verification obligations.
- Use account contact information as representation: contact and authority are separate facts.

## Colombia age policy

**Decision**: Determine completed years from validated date of birth and the current backend calendar date in `America/Bogota`; adulthood starts at 18. A 29 February birth reaches the anniversary on 1 March in non-leap years. Reevaluate at create, submit and every age-sensitive mutation.

**Rationale**: One server policy avoids client-clock disagreement and prevents stale age authorization. It is an approved product rule, not a claim of legal compliance.

**Rejected**:

- Client `isAdult`: self-asserted and time-sensitive.
- UTC timestamp arithmetic: can change the decision near Colombia midnight and mishandle calendar birthdays.
- Derive football category from date of birth: category is a separate declared sports value.

## Turning 18 and date corrections

**Decision**: Preserve historical representation, but stop new representative mutations once the relationship no longer matches minor status. Do not create an account, `SELF`, transfer or new lifecycle state. Reject an editable date correction if it would make current authority inconsistent; future regularization is out of scope.

**Rationale**: Historical facts remain auditable while current authority is not silently expanded or transferred.

**Rejected**:

- Automatically transfer to the former minor: there may be no account and consent/regularization is undefined.
- Keep minor authority indefinitely: relies on frozen age.
- Delete representation: destroys history.

## Academy management

**Decision**: Authorize lifecycle management through active membership in the passport's origin academy. Do not require the current employee to be the original creator. For minors, store `ACADEMY` management and the representative confirmation as distinct facts.

**Rationale**: The academy is the organizational context. Employee turnover must not orphan records, and membership cannot become legal representation.

**Rejected**:

- `createdByIdentityId` ownership: converts organizational data into personal employee ownership.
- Academy as representative: conflates sports administration and private authority.

## Historical TUTOR compatibility

**Decision**: Retain `TUTOR` role/origin values and `InitialTutorResponsibility` as historical evidence. Reconcile only through an explicit, idempotent operation that appends a non-sensitive result. Never infer `SELF`; create `LEGAL_REPRESENTATIVE` only from complete, confirmed facts compatible with current age.

**Rationale**: Existing identities and audit must remain interpretable without granting rights that were never evidenced.

**Rejected**:

- Rename old rows to `USER`/`SELF`: rewrites history and fabricates ownership.
- Make every old Tutor a representative: role assignment alone is insufficient.
- Reconcile during login: authentication must not mutate domain authority.

## Protected private identity storage

**Decision**: Continue application-layer authenticated encryption for private values and keyed deterministic fingerprints for normalized-document equality. Reuse existing key configuration and rotation boundary.

**Rationale**: Plaintext is recoverable only where authorized, while exact duplicate checks remain indexable. Representative documents require the same protection and must not be copied to traces.

**Rejected**:

- Plaintext database columns: excessive exposure.
- Unkeyed hashes: vulnerable to enumeration of structured identifiers.
- Irreversible-only storage: authorized review and correction need controlled recovery.

## Duplicate prevention and concurrency

**Decision**: Keep a unique document fingerprint constraint as the final exact-duplicate arbiter. Create the player, passport, responsibilities, confirmation consumption and audit in one transaction. Convert uniqueness races into the same safe conflict response.

**Rationale**: Application pre-checks improve UX but cannot prevent concurrent duplicates. Database constraints and atomic writes provide the invariant.

**Rejected**:

- Name/date hard rejection: creates false positives.
- Check-then-insert without uniqueness: races.
- Reveal the existing candidate: privacy violation.

## Private duplicate review and history projections

**Decision**: Preserve detection/resolution as immutable internal audit, but omit every possible-duplicate event and detail from ordinary particular/academy history. Expose internal history through a separate capability-gated projection.

**Rationale**: Redacting only fields is insufficient: event type and timing themselves disclose a private suspicion. Separate fixed projections are safer than client-selectable filters.

**Rejected**:

- Send all events and hide them in UI: protected data already crossed the boundary.
- Reuse one endpoint with `includeInternal=true`: invites parameter-based privilege mistakes.
- Delete internal events: breaks traceability.

## Authorization integration

**Decision**: Extend the existing Feature 002 evaluator with relationship, membership, age and classification facts. Add specific particular, academy-history and internal-history permissions. Continue default denial and server-side capability projection.

**Rationale**: The current evaluator remains the single policy boundary while Feature 005 owns its domain facts. UI visibility never authorizes the request.

**Rejected**:

- Decode roles in the frontend: stale and forgeable as policy.
- Authorize from origin alone: origin is historical context, not current authority.
- Give `USER` broad passport access: relationships must scope every player.

## Authentication and sessions

**Decision**: Make `USER` eligible wherever controlled account provisioning currently enumerates particular roles, while preserving login, renewal, storage, token claims, revocation and logout mechanisms. Never create roles or relationships during authentication.

**Rationale**: The correction changes eligibility and domain authorization, not the security protocol.

**Rejected**:

- New login flow or public registration: outside scope.
- Relationship data in long-lived token claims: becomes stale and leaks private context.

## Contract and non-disclosure behavior

**Decision**: Keep `Cache-Control: no-store`, generic protected-resource denials and explicit response DTOs. Add representative confirmation and split ordinary/internal history. Expose private draft details only to authorized editable contexts.

**Rationale**: Contracts must make private and sports-presentation boundaries structural. Unauthorized users must not distinguish missing from existing protected passports.

**Rejected**:

- Reuse persistence models as DTOs: risks accidental field expansion.
- Put private representation in presentation DTOs: violates classification.

## Frontend entry and context

**Decision**: A particular user with one authorized passport opens `Resumen`; with several, opens a selector. Academy context always opens its portfolio, including a single result. Mixed identities switch contexts explicitly. Active passports also open `Resumen`; status/history are secondary.

**Rationale**: Product entry should lead to the player's passport, not a technical state screen, while preserving organizational boundaries.

**Rejected**:

- Redirect only if the actor can create: creation capacity is unrelated to viewing.
- Merge personal and academy passports into one inferred list: can cause wrong-context actions.

## Responsive presentation and unavailable sections

**Decision**: Preserve the implemented persistent identity shell, mobile tabs, desktop left navigation, liquid-glass direction, neutral photo marker and accessibility behavior. `Resumen` shows Feature 005 data; `Estadísticas`, `Partidos` and `Videos` remain explicitly unavailable.

**Rationale**: The visual contract is already approved and independent of the authority correction. Unavailable is distinct from zero or empty production data.

**Rejected**:

- Invent placeholder statistics or active controls: misleading.
- Add photograph upload: outside scope.

## Dependency decision

**Decision**: Add no runtime dependency. Use existing NestJS, Prisma/PostgreSQL, Zod, crypto boundary, Expo and test stacks.

**Rationale**: Required calendar, authorization, encryption, transactions and UI behaviors can be implemented with current facilities and small domain services.

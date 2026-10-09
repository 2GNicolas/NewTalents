# Internal Lifecycle Authorization Contract: Player Passport

Feature 002 remains the evaluator. Feature 005 supplies current roles, membership, passport relationship, age-policy and classification facts. No permission is inferred from UI, JWT role text, origin, document input, payment or subscription.

## Capabilities

- Particular: `passport.particular.create`, `passport.particular.manage`, `passport.history.particular` require active `USER`; management/history additionally require `SELF` or currently valid `LEGAL_REPRESENTATIVE`.
- Academy: `passport.academy.create`, `passport.academy.manage`, `passport.history.academy` require active `ACADEMY_USER`, matching active membership and academy context; employee creator is irrelevant.
- Internal: `passport.review` for `ANALYST`, `passport.activate` for `ADMINISTRATOR`, and `passport.history.internal` for redacted audit.
- Historical `passport.tutor.*` names may exist only behind a compatibility adapter backed by a reconciled relationship. `TUTOR` alone never permits an operation.

## Operation matrix

| Operation | Required actor/facts | Result |
|---|---|---|
| List particular | `USER` plus each passport's `SELF` or valid representation | Authorized particular summaries only |
| Academy portfolio | `ACADEMY_USER` plus matching active membership | Every matching academy passport, even when only one |
| Create adult self-owned | `USER`, validated age >=18, no prior self-owned passport | Atomic Particular Draft + `SELF` |
| Create represented minor | `USER`, validated age <18, private identity, declared relationship and explicit confirmation | Atomic Particular Draft + representation; no minor account |
| Create from academy | Matching membership; for a minor, confirmation made by identified representative `USER` | Atomic Draft + Academy relationship and required representation |
| Read presentation/status | Applicable particular relation, academy membership or internal capability | Protected projection |
| Edit/submit/resubmit | Current relationship/membership remains age-compatible | Editable-state mutation with age reevaluation |
| Return/resolve/approve | `ANALYST` + review capability | `IN_REVIEW`; approval has no unresolved/confirmed duplicate |
| Activate | `ADMINISTRATOR` + activation capability | `APPROVED` to `ACTIVE` |
| Ordinary history | Matching particular/academy history capability | Safe filtered events only |
| Duplicate review | `ANALYST` + review capability | Minimum private signal projection |
| Internal audit | Explicit internal-history capability | Immutable redacted audit, separate from ordinary history |

## Age, privacy and compatibility

- Backend uses policy `CO-18-v1`, `America/Bogota`, validated birth date and 18 completed years. `isAdult` is never authoritative.
- At age 18, representation history stays recorded but permits no new mutation. No account, `SELF`, transfer or role appears automatically.
- Academy never proves representation; an employee cannot confirm for the representative.
- Ordinary history and particular/academy responses omit duplicate detection/resolution events, signal/candidate IDs or existence, fingerprints, documents, matching reasons and private workflow details.
- Immutable rows remain stored. Analyst review exposes only minimum signal state/actions; internal audit is separately authorized and redacted.
- Unauthorized and nonexistent lookups share `passport_not_found`.
- Reconciliation of historical `TUTOR` is additive, idempotent and auditable. Incomplete facts deny access and never become `SELF` or confirmed representation.

Backend resource actions are `view`, `edit`, `submit`, `return`, `resolve_possible_duplicate`, `approve`, `activate`, `view_history`, and `view_internal_history`; collection actions are `create_self`, `create_represented_minor`, `create_academy`, `list_particular`, and `list_academy`. Every action is context-qualified. Frontend visibility never authorizes.

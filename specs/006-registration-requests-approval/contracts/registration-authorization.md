# Contract: Registration authorization

La autorización extiende el catálogo estático y evaluador de Feature 002. El backend decide; el frontend solo consume `capabilities` proyectadas. Toda operación no listada se deniega.

## Capabilities

### Public/pending applicant

- `registration.request.create.personal-adult`
- `registration.request.create.represented-minor`
- `registration.request.create.formal-academy`
- `registration.request.create.natural-person-academy`
- `registration.request.own.view`
- `registration.request.own.edit-draft`
- `registration.request.own.submit`
- `registration.request.own.correct`
- `registration.request.own.resubmit`
- `registration.request.own.upload-evidence`
- `registration.request.own.view-deletion-status`

### Academy scoped

- `registration.request.academy.list`
- `registration.request.academy.view`
- `registration.request.academy.create-additional-account`
- `registration.request.academy.create-adult-player`
- `registration.request.academy.create-minor-player`

### Administrator

- `registration.review.list`
- `registration.review.view`
- `registration.review.view-evidence`
- `registration.review.request-correction`
- `registration.review.confirm-dossier`
- `registration.review.approve`
- `registration.review.reject`
- `registration.review.view-deletion-status`
- `registration.review.retry-deletion`

## Authorization facts

`authenticated`, `identityActiveOrPending`, `requestOwner`, `requestType`, `requestStatus`, `requestVersionCurrent`, `academyContextMatches`, `academyApproved`, `academyMembershipActive`, `academyResponsibleAuthority`, `evidenceCompleteAndClean`, `ageRouteCompatible`, `representationComplete`, `duplicateConflictAbsent`, `manualDossierConfirmed`, `deletionState`, `administratorCapability`.

## Rules

| Operation | Required facts |
|---|---|
| Create public request | supported public type; email not disclosed as existing; credential boundary succeeds |
| View own | authenticated pending/active identity + owner |
| Edit draft | owner + DRAFT + current version |
| Correct | owner + REQUIRES_CORRECTION + current version |
| Submit/resubmit | owner + editable state + completeness + CLEAN evidence + age/representation |
| Create academy request | active ACADEMY_USER + active membership + approved matching academy; responsible authority additionally for account request |
| List/view academy requests | matching active membership and projected scope |
| Admin list/view | authenticated active identity + explicit admin review capability |
| View evidence | admin evidence capability + SUBMITTED + CLEAN/current evidence; log every access |
| Request correction | admin capability + SUBMITTED/current version + safe non-empty reason |
| Confirm dossier | admin capability + SUBMITTED/current + complete evidence + no unresolved conflict |
| Approve | admin capability + confirmed dossier + route/academy/representation valid + deletion verified + current version |
| Reject | admin capability + SUBMITTED/current + safe reason |
| Retry deletion | admin capability + RECOVERY_REQUIRED; idempotent |

## Access classes

- **Pending applicant**: can authenticate/refresh/logout but only receives own-request capabilities. No USER, ACADEMY_USER, passport, Analyst or Admin capability.
- **Approved USER/ACADEMY_USER**: existing product capabilities plus only relations/memberships created by approval.
- **Administrator**: review capability is explicit; role label alone does not bypass evaluator.
- **Analyst**: no request evidence, raw identity, representation evidence, private contacts or decisions. Later enrichment receives only the passport projection.
- **Unaffiliated identity**: safe denial indistinguishable from missing resource.
- **Minor**: no identity/session/account is created.

## Safe outcomes

- Ownership/context failures use the repository safe not-found/denied envelope and do not confirm request, person or academy.
- Duplicate responses use `REGISTRATION_CONFLICT` without candidate, field, fingerprint or internal reason.
- Frontend route guards check backend-projected capability, not JWT roles.
- Revoked session, inactive membership or changed request version invalidates the operation at execution time.

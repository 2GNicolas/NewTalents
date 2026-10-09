# Contract: Frontend registration state

## Single owner

`RegistrationRequestState` owns API calls, server snapshot/version, typed draft, validation, upload queue/progress, retry state, capabilities, status restoration and navigation outcome. Screens render projections and dispatch commands; they do not infer authorization or lifecycle.

Passwords/confirmation live only in the credential submission scope and are cleared after handoff/error requiring re-entry, submit, logout and unmount. Document URIs/File objects are never placed in routes or persisted stores and are cleared after upload, submit, logout or abandonment.

## Route groups

- Public: type choice and public types (personal adult, represented minor, formal academy, natural-person academy).
- Pending: own request status, draft, submit and correction.
- Academy: additional account and academy adult/minor player from selected authorized context.
- Admin: unified inbox, detail, evidence viewer, correction, dossier, decision and deletion recovery.

The public CTA is **Crear solicitud de registro**. Controlled internal staff activation/recovery remains absent from public routes.

## UI state machine

| Server/client condition | Presentation |
|---|---|
| no type | Choice |
| DRAFT | Typed form, evidence progress, validation, save/submit capabilities |
| uploading | Per-item progress/cancel/retry; submit disabled |
| SUBMITTED | Pending review; immutable applicant view |
| REQUIRES_CORRECTION | Safe reason, permitted fields/evidence, resubmit |
| approval deletion prepared | Processing decision, no product access/evidence retrieval |
| APPROVED | Refresh auth/capabilities then navigate to Summary, selector or academy portfolio as projected |
| REJECTED | Final safe reason and deletion status; no ordinary access |
| version conflict | Restore latest snapshot and explain stale action safely |
| denied/not found | Restricted state without existence disclosure |
| network/service failure | Stable retry without duplicate submission |

## Typed forms

Shared sections are composed, never represented by arbitrary field maps: credentials, applicant identity, player, representative, academy, academy account, evidence and consent. Each of seven request types has its own schema and evidence checklist. `isAdult` is only a UI hint; server-derived Colombia age governs.

## Capability projection

Buttons/routes require capabilities returned in each response. Hidden/disabled presentation is UX only; backend remains authoritative. No JWT role parsing. Context switch between personal and academy requests clears type-specific drafts and reloads capabilities.

## Upload behavior

- Use document picker reference ephemerally; upload multipart directly.
- Show category, filename-safe label, progress, scanning/completeness and correction state, not object key/hash.
- Retry reuses client idempotency token but never assumes prior upload failed.
- No preview for applicant after submit. Admin preview uses authenticated endpoint and ephemeral object URL on web, revoked immediately after close.

## Responsive and accessibility

- Same hierarchy/behavior on web and mobile; narrow views stack sections and keep primary action reachable above keyboard.
- Admin web may use table; mobile uses equivalent cards with stable cursor pagination, never omitted data.
- Logical focus, visible focus web, labeled fields/errors, announcements for uploads/transitions, touch targets, reduced motion and non-color status cues.
- Preserve emerald/black, lime accent, dark liquid-glass surfaces and non-rounded typography.

## Visual implementation authority

The visual-design checkpoint is complete. [docs/design/feature-006/README.md](../../../docs/design/feature-006/README.md) is the authoritative manifest for the 31 approved references and their exact paths. The initial frontend priority is adult self-registration, represented-minor registration, formal-academy creation and natural-person academy creation, including pending access, drafts, private uploads, consent, submission, status and correction. Academy operations and Administrator review remain later Feature 006 phases and remain fully in scope.

Every implementation and visual-QA task must inspect the matching manifest images, keep desktop and mobile compositions distinct, capture runtime screenshots and record comparison results. Text in this contract does not replace the images, and implementation must not invent substitute layouts.

## Authentication compatibility

Feature 004 restoration/refresh/logout remains authoritative. Pending session restores only pending routes. Approval requires token/session capability refresh before ordinary navigation. Revocation or logout clears secrets, request caches and file references. Existing active users continue existing entry behavior.

## Admin inbox contract

The state owner stores cursor pages keyed only by type/status filters, merges without scroll reset and invalidates a row after decision. Row fields: type, status, submitted time, safe identity, academy context, evidence completeness and correction indicator. There is no bulk selection/approval. Detail includes only backend-projected fields/actions.

# Frontend Passport Presentation Contract

Expo mobile/web consumes only backend-authorized context and capabilities. It never decodes JWT roles, determines legal age from client time, or exposes private representative/duplicate data.

## Entry and context

- One accessible **particular** passport opens `Resumen` directly after authorization, regardless of create capability or lifecycle state.
- Several particular passports open an authorized-player selector; none is inferred.
- Academy context always opens its portfolio, even with one passport. Particular and academy collections/actions remain separate.
- `Activo` opens `Resumen`; state/history remain secondary authorized routes.
- A `USER` with no passport sees an honest empty state and only backend-projected creation choices.

## Forms

- Adult self-management sends `SELF`; backend derives adulthood and authenticated ownership.
- Minor creation sends `LEGAL_REPRESENTATIVE`, representative private identity, relationship (`MOTHER`, `FATHER`, `LEGAL_GUARDIAN`) and explicit authority confirmation. No minor credentials are created.
- Academy creation sends academy context. A minor requires confirmation made by the identified representative `USER`; an employee checkbox cannot replace it.
- Birth date is private input. UI explains Colombia/18 and never sends/stores authoritative `isAdult`.
- Private identity corrections, including birth date, exist only in editable states and surface server relationship-compatibility validation.

## Operations and privacy

Existing list, status, presentation, edit, submit, return, duplicate resolution, approve, activate and history operations remain; creation/edit schemas carry relationship/context fields from OpenAPI. Safe categories do not expose account, player, representative or candidate existence.

Ordinary history never receives duplicate detection/resolution events or private details. Analyst review uses an explicitly authorized projection; internal audit is not rendered by ordinary status/history.

## Presentation

- Preserve the accepted eight screens and liquid-glass hierarchy in `design-qa.md`.
- Persistent identity shows authorized name, position, declared category, city, country, foot, academy name or unavailable, and neutral local photo placeholder.
- Mobile tabs remain horizontal below identity; desktop navigation remains vertical below player information.
- `Resumen` uses Feature 005 profile. `Estadísticas`, `Partidos`, and `Videos` stay `unavailable`; no future data or controls are fabricated.
- Loading, empty, unavailable, restricted, validation and lifecycle states remain explicit and accessible; no `Suspendido` exists.
- Frontend state separates `particular`/`academy` collection context, selected passport, lifecycle and section.
- Representative identity, birth date, documents, fingerprints, signals/candidates and internal notes never enter presentation, ordinary history, routes, logs, analytics or persisted frontend state.

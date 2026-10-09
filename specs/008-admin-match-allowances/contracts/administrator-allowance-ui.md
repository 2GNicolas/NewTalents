# Administrator UI contract (planning only)

## Navigation and composition

- Keep the existing Administrator shell. Insert **Pasaportes** between **Expedientes** and **Custodia** on desktop and mobile; do not rename or remove any existing destination.
- `/admin/passports` is one card collection of all existing passports visible to the Administrator. It is not the Custodia board. A card shows an authorized player label, a separate masked passport reference, lifecycle state, and detail action; inactive passports remain visible but cannot be configured.
- `/admin/passports/:passportId` retains the existing passport profile, status, linked records, custody and history. Integrate **Configuración de partidos** as a section, not a replacement detail. Reuse established safe links and return navigation.
- The two approved 2026-10-09 desktop/mobile images govern section hierarchy, spacing and responsive composition. They do not authorize a photo, utilized/available count, progress bar, scheduled matches or third-party scheduling instructions in Feature 008.

## State and interaction

| State | Required presentation/action |
|---|---|
| Loading/unavailable/error/restricted | Explicit text state; no stale actionable controls or protected cached data. Retry only when appropriate. |
| Active passport, unconfigured | “Sin configuración”; editable cadence and positive integer limit; read-only Colombia activation day from server. No zero-usage inference. |
| Active passport, configured | Current cadence/limit/period, fixed initial activation date, optional confirmed next-period change, version and last modification. Form may propose cadence/limit only. |
| Non-active passport | State visible; no editable allowance form or save action. History remains readable if authorized. |
| Proposed change | Local-only until explicit confirmation. Summary identifies passport, old/new cadence and limit, fixed activation date, and effective next boundary. Cancel/discard/unmount leaves persisted data untouched. |
| Submitting/conflict | Disable duplicate submit; reuse same idempotency key for connectivity retry of the same intention. On stale version or changed Colombia day, refresh authoritative state and require a new review/confirmation. No optimistic current-rule replacement. |

Use labeled buttons/input, text plus state cues, visible focus, keyboard and touch operation, reduced-motion support, focus return after dialog, and no horizontal overflow at desktop/mobile reference sizes. Preserve the approved screen's period selector, allowance field, current configuration, save/discard, and last-modified hierarchy. Display period end inclusively to people, but consume exclusive end from the API. Do not present illustrative “used/available” content as real data.

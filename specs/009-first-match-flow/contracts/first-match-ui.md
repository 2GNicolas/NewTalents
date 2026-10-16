# First-match cross-platform presentation contract

The six PNGs below govern visual hierarchy and full-screen composition; example names, dates, four-slot counts, and “Analista asignado” copy are illustrative. Runtime copy and availability must reflect actual authorized data. Do not change the PNG files.

| State | Desktop authority | Mobile authority | Required behavior |
|---|---|---|---|
| Invitation | `external:docs/design/feature-009/first-match-invitation-desktop.png` | `external:docs/design/feature-009/first-match-invitation-mobile.png` | Full-screen passport-active message, primary `Agendar primer partido`, current allowance availability if configured. No passport menu. |
| Form | `external:docs/design/feature-009/first-match-scheduling-desktop.png` | `external:docs/design/feature-009/first-match-scheduling-mobile.png` | Full-screen date/time/opponent/competition/venue inputs, allowed player context, confirmation summary and live match-date allowance preview. Form `Cancelar` discards an unconfirmed edit, not a booked match. |
| Waiting | `external:docs/design/feature-009/first-match-waiting-desktop.png` | `external:docs/design/feature-009/first-match-waiting-mobile.png` | Full-screen persisted match details and pending status. Add owner-approved secondary `Reagendar` and `Cancelar partido` immediately below details on both variants; these additions are not pictured in the PNGs. |

## State and navigation

```text
loading -> invitation | waiting | loaded | restricted | unavailable | error
invitation -> form -> submitting -> waiting | field-error | capacity-conflict | unavailable
form -> discard -> invitation (no mutation)
waiting -> reschedule-form -> submitting -> waiting | original-waiting-with-error
waiting -> cancel-confirmation -> submitting -> invitation | original-waiting-with-error
waiting -> confirmed Analyst load -> loaded
```

Reload, new session and another device derive state from the server, not local memory. Once loaded, do not return to invitation or show pre-load actions. `LOADED` is only a safe operational handoff to existing permitted passport presentation; it does not imply published analysis. If passport status/authorization changes, do not reveal prior cached details. Hide the passport presentation menu through the entire invitation/form/waiting route, including errors and retries. This does not remove the existing menu from unrelated passport screens.

This feature's approved invitation/waiting entry takes precedence over Feature 005's default active-passport `Resumen` entry only in these first-match states. After load, or for an unrelated passport state, preserve the existing authorized destination.

## Authorization and data rules

- Show actions from server capability hints, but every mutation is independently authorized by the backend. Booking works with no Analyst assigned. An unassigned passport uses neutral waiting copy; never promise that a specific Analyst sees the match.
- A selected match date previews the exact Feature 008 period; `available = limit - reserved - used`. Preview is not a hold, so confirmation may still conflict. Unconfigured date is a separate state from zero available. The form displays a safe reason and keeps user-entered values on failure.
- Rescheduling edits the same match. A rejected destination retains original waiting details/reservation. Cancellation requires a distinct confirmation and releases only a pre-load reserved unit. A repeated submit does not add a second unit.
- The decorative Analyst/FEM/post-publication steps in invitation art do not authorize or implement those modules.

## Responsive and accessible verification

Desktop preserves centered wide panel, two-column form/summary and horizontal waiting details; mobile preserves vertical hero, stacked form/summary and vertical waiting details. Avoid horizontal scrolling and clipped bottom actions; respect safe areas and keyboard inset. The secondary waiting actions remain visible/reachable under the details on both sizes without a passport menu.

Use semantic headings, explicit field labels and required state, accessible error associations, focus order, keyboard activation, screen-reader status announcements and contrast that does not rely on neon/amber color alone. Confirm/discard and `Cancelar partido` must be unambiguous to keyboard and assistive-technology users. Validate loading, restricted, unavailable and retry states on both platforms against the same information hierarchy, without inventing a new approved visual reference.

## Administrator continuation

After completed approval producing an `ACTIVE` passport, or successful explicit activation, navigate directly to existing `/(admin)/admin/custody/[passportId]` and present its authorized manual assignment. Do not navigate from an approval still deleting evidence or one without a passport ID. Back/cancel on custody does not roll back approval/activation or assign an Analyst.

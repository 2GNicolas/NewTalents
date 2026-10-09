# US8 dossier browser and visual verification

Date: 2026-10-01

## Approved references and runtime evidence

Only the following approved references were used:

- `docs/design/admin-custody/dossiers-list-desktop.png`
- `docs/design/admin-custody/dossiers-list-mobile.png`
- `docs/design/admin-custody/dossier-detail-desktop.png`
- `docs/design/admin-custody/dossier-detail-mobile.png`

Ignored runtime captures are stored under `.runtime/feature-007-visual/dossiers/` as `desktop-list.png`, `mobile-list.png`, `desktop-detail.png`, and `mobile-detail.png`. Git ignore was verified for the capture directory.

## Comparison result

PASS. Desktop and mobile preserve the approved shared Administrator shell, emerald background, dark translucent surfaces, restrained lime status/action treatment, responsive list cards, detail hierarchy, linked-record panels, and chronological confirmation history. Mobile uses one-column cards and persistent bottom navigation without horizontal clipping.

Contract-driven differences are intentional: the implementation lists confirmed dossiers only, omits pending confirmation and every mutation action, does not expose evidence objects or recovery controls, and renders deletion/approval information only through the safe confirmation history projection. Synthetic preview data contains four representative records rather than reproducing the reference's private or pending rows.

## Browser interaction and accessibility

- Search, status/type/date filter controls, next/previous pagination, list-to-detail navigation, and retry/empty/restricted/unavailable states have semantic component coverage.
- A live keyboard-driven list-to-detail-to-list journey restored the `Valentina` search value; state tests also verify cursor stack, page scroll restoration, and ephemeral detail cleanup.
- Detail heading focus, keyboard activation, touch-sized controls (minimum 44 px), and request/passport link names are covered and visible in the accessibility tree.
- Direct-detail back navigation falls back safely to the list when no browser history exists.
- Status is communicated by text and symbols in addition to color. The dossier surfaces require no animation, so reduced-motion mode removes no information or operation.
- Mobile captures at 390 px show no app-level horizontal overflow; content below the viewport remains reachable by normal vertical scrolling and is not obscured by the bottom navigation.
- Structural checks found no edit, confirm, approve, retry-deletion, evidence retrieval, credential, civil-document, contact, object-key, digest, or transferred-category controls/values.

No actionable P0, P1, or P2 visual or accessibility deviations remain. P3 differences are limited to local font/glyph metrics, reduced synthetic row density, and background crop variation.

# Feature 008 — authenticated visual/accessibility check (2026-10-09)

Compared the live Administrator app at `localhost:8081` with the two approved 2026-10-09 desktop/mobile allowance references. The Administrator session used a synthetic local account; no existing passport allowance was confirmed or changed during the browser review. No runtime screenshot binary was committed.

| Check | Result |
|---|---|
| Desktop navigation/cards | Pass: one Pasaportes destination between Expedientes and Custodia; two existing passports displayed as readable-name cards with separate masked references and active status. |
| Desktop detail | Pass: existing profile, custody, linked request/dossier and custody history remained visible; allowance period/limit/current state/save/discard hierarchy was added. |
| Mobile at effective 390 × 844 CSS pixels | Pass after correction: four cadences fit in one row, controls remain at least 48 px high, bottom navigation remains present, `documentElement.scrollWidth === innerWidth === 390`. |
| Keyboard/focus | Pass: Enter on “Volver a pasaportes” returned to cards; focus was visibly outlined on the detail heading and controls were named in the accessibility tree. |
| Mobile pointer/touch-equivalent | Pass in responsive browser/component interaction: card opens detail and common React Native `Pressable` controls respond. Physical-device touch remains part of manual acceptance. |
| Scroll | Pass: internal detail scroller reached its bottom (`scrollTop 1062` of `scrollHeight 1774`, viewport 712); linked records and history remained in the accessibility tree. |
| Reduced motion | Pass by structure: the Feature 008 list/detail/allowance components introduce no animation or transition required to complete a control action. Browser media emulation was unavailable; physical-device preference remains for manual acceptance. |
| Confirmation/cancel | Pass: the review showed old/new values and fixed Colombia date; cancel followed by reload still showed “Sin configuración”. |
| Exclusions | Pass: no fabricated utilized/available count, usage progress, player photo, match list or scheduling control in Feature 008. The existing neutral profile placeholder was retained. |

Intentional differences from the illustrative images: the existing Feature 007 passport header and custody/history stay intact; no sample player photo or scheduling explanation is copied. The initial activation date is read-only, and an unconfigured passport shows no invented consumption. The mobile period selector initially wrapped “Anual”; that Feature 008 layout defect was corrected and rechecked in the authenticated app.

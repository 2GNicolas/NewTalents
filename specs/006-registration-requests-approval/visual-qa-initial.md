# Phase 7 visual and accessibility QA — T087

> Image names are retained as historical trace identifiers; reference and runtime-capture binaries are not stored in Git.

Date: 2026-09-25. Runtime: Expo Web development build, Chrome headless CDP, DPR 1. The first fourteen rows reuse the already-approved T077–T084 captures because their shared journey shell did not materially change. The two status rows were captured after the final T085–T086 correction.

| # | Approved reference | Runtime route/state | Viewport | Result |
|---:|---|---|---:|---|
| 1 | `request-type-selection-desktop-mobile.png` (desktop) | `/registration` | 1440×1024 | PASS |
| 2 | `request-type-selection-desktop-mobile.png` (mobile) | `/registration` | 390×844 | PASS |
| 3 | `adult-account-identity-desktop.png` | `/registration/personal-adult?preview=identity` | 1440×1024 | PASS |
| 4 | `adult-account-identity-mobile.png` | same preview | 390 px | PASS |
| 5 | `adult-submission-review-desktop.png` | `/registration/personal-adult?preview=review` | 1440×1024 | PASS |
| 6 | `adult-submission-review-mobile.png` | same preview | 390 px | PASS |
| 7 | `represented-minor-information-desktop.png` | `/registration/represented-minor?preview=minor` | 1440×1024 | PASS |
| 8 | `represented-minor-information-mobile.png` | same preview | 390 px | PASS |
| 9 | `represented-minor-submission-review-desktop.png` | `/registration/represented-minor?preview=review` | 1440×1024 | PASS |
| 10 | `represented-minor-submission-review-mobile.png` | same preview | 390 px | PASS |
| 11 | `formal-academy-information-desktop.png` | `/registration/academy-formal?preview=academy` | 1440×1024 | PASS |
| 12 | `formal-academy-information-mobile.png` | same preview | 390 px | PASS |
| 13 | `natural-person-academy-information-desktop.png` | `/registration/academy-natural-person?preview=academy` | 1440×1024 | PASS |
| 14 | `natural-person-academy-information-mobile.png` plus `natural-person-academy-submission-review-desktop.png` | academy/review previews | 390 px + 1440×1024 | PASS |
| 15 | `applicant-correction-status-desktop.png` | development-only read-only status preview; normal route remains backend-driven | 1440×1024 | PASS |
| 16 | `applicant-correction-status-mobile.png` | same preview | 390×844 and 424×642 | PASS |

## New status evidence

- Runtime captures: `.tmp/feature006-design-qa/status-desktop-1440x1024.png`, `status-mobile-390x844.png`, `status-short-424x642.png`, and `status-short-424x642-bottom.png`.
- Joint comparison: `.tmp/feature006-design-qa/status-comparison.png`.
- Exact runtime metrics: 1440×1024, 390×844, and 424×642 all reported `documentElement.scrollWidth === innerWidth`; horizontal overflow is zero.
- The 390×844 scroll owner measured 844 / 1086 px. The 424×642 short viewport measured 642 / 1009 px and reached the correction card, both actions, and final notice at its terminal scroll position. The emerald image and dark canvas remain continuous throughout.

## Accessibility and interaction

- Keyboard/focus: all normal-mode correction actions and replacement controls are semantic buttons with explicit visible focus treatment; disabled preview controls cannot mutate state.
- Screen reader: the state change uses an assertive live region, upload/result messages use live regions, timeline and document-selection controls have explicit labels, and decorative arrow text is hidden from accessibility APIs.
- Touch: mobile replacement and action controls are at least 46–50 px high; the primary and secondary actions remain fully reachable after scrolling.
- Non-color: warning state is communicated by text, icon, border and timeline label, not color alone.
- Reduced motion: the status flow defines no animation or transition; reduced-motion users receive the same static hierarchy.
- Responsive: desktop preserves the rail/full-width status composition; mobile is single-column; the short viewport scrolls normally with no sticky overlay or horizontal clipping.
- Preview safety: `/registration/status-preview?preview=correction` is development-only, read-only, uses no authentication/upload/save/resubmit callbacks, and redirects to `/registration` in production.

No P0, P1, or P2 fidelity/accessibility findings remain. Residual P3 differences are limited to system-font metrics, line-icon rendering, and atmospheric background crop.

final result: passed

# Feature 006 — Approved visual references

## 1. Visual authority

Las imágenes de `solicitud/` y `admin/` son la autoridad visual aprobada para Feature 006. Quien implemente debe inspeccionar las imágenes reales: este manifiesto y sus descripciones no las sustituyen. Las referencias desktop y mobile son autoridades separadas para sus respectivas composiciones; la lámina comparativa de selección contiene ambas vistas y debe evaluarse en cada plataforma.

## 2. Approved visual direction

- Composición responsive de viewport completo.
- Fondo líquido esmeralda y verde-negro.
- Superficies oscuras translúcidas tipo liquid-glass.
- Tipografía elegante no redondeada.
- Lima para foco, progreso y acciones principales.
- Texto blanco roto y gris verdoso atenuado.
- Bordes iluminados refinados.
- Composiciones específicas para desktop y mobile.
- Sin layout SaaS blanco genérico.
- Sin un shell pequeño y centrado para la aplicación.
- Sin exceso de neón, estética cyberpunk ni saturación de tarjetas anidadas.

## 3. Complete reference inventory

| Exact path | Platform | Audience | Workflow | Screen or state | Implementation phase |
|---|---|---|---|---|---|
| `docs/design/feature-006/solicitud/request-type-selection-desktop-mobile.png` | Desktop + mobile | Applicant | Public registration entry | Request-type selection and personal/represented-minor choice | Initial public registration |
| `docs/design/feature-006/solicitud/adult-account-identity-desktop.png` | Desktop | Applicant | Adult self-registration | Account and legal identity draft | Initial public registration |
| `docs/design/feature-006/solicitud/adult-account-identity-mobile.png` | Mobile | Applicant | Adult self-registration | Account and legal identity draft | Initial public registration |
| `docs/design/feature-006/solicitud/adult-submission-review-desktop.png` | Desktop | Applicant | Adult self-registration | Documents, consent and submission review | Initial public registration |
| `docs/design/feature-006/solicitud/adult-submission-review-mobile.png` | Mobile | Applicant | Adult self-registration | Documents, consent and submission review | Initial public registration |
| `docs/design/feature-006/solicitud/represented-minor-information-desktop.png` | Desktop | Applicant | Represented-minor registration | Representative and minor information draft | Initial public registration |
| `docs/design/feature-006/solicitud/represented-minor-information-mobile.png` | Mobile | Applicant | Represented-minor registration | Representative and minor information draft | Initial public registration |
| `docs/design/feature-006/solicitud/represented-minor-submission-review-desktop.png` | Desktop | Applicant | Represented-minor registration | Evidence, authority, consent and submission review | Initial public registration |
| `docs/design/feature-006/solicitud/represented-minor-submission-review-mobile.png` | Mobile | Applicant | Represented-minor registration | Evidence, authority, consent and submission review | Initial public registration |
| `docs/design/feature-006/solicitud/formal-academy-information-desktop.png` | Desktop | Applicant | Formal-academy creation | Academy information draft | Initial public registration |
| `docs/design/feature-006/solicitud/formal-academy-information-mobile.png` | Mobile | Applicant | Formal-academy creation | Academy information draft | Initial public registration |
| `docs/design/feature-006/solicitud/natural-person-academy-information-desktop.png` | Desktop | Applicant | Natural-person academy creation | Operating identity and responsible-person draft | Initial public registration |
| `docs/design/feature-006/solicitud/natural-person-academy-information-mobile.png` | Mobile | Applicant | Natural-person academy creation | Operating identity and responsible-person draft | Initial public registration |
| `docs/design/feature-006/solicitud/natural-person-academy-submission-review-desktop.png` | Desktop | Applicant | Natural-person academy creation | Evidence, declarations and submission review | Initial public registration |
| `docs/design/feature-006/solicitud/applicant-correction-status-desktop.png` | Desktop | Applicant | Applicant request status | Requires-correction state and correction entry | Initial public registration |
| `docs/design/feature-006/solicitud/applicant-correction-status-mobile.png` | Mobile | Applicant | Applicant request status | Requires-correction state and correction entry | Initial public registration |
| `docs/design/feature-006/solicitud/academy-request-hub-desktop.png` | Desktop | Academy | Approved-academy request hub | Request creation choices and academy request list | Academy operations |
| `docs/design/feature-006/solicitud/academy-request-hub-mobile.png` | Mobile | Academy | Approved-academy request hub | Request creation choices and academy request list | Academy operations |
| `docs/design/feature-006/solicitud/academy-additional-account-submission-review-desktop.png` | Desktop | Academy | Additional academy account | Account, function, evidence and submission review | Academy operations |
| `docs/design/feature-006/solicitud/academy-additional-account-submission-review-mobile.png` | Mobile | Academy | Additional academy account | Account, function, evidence and submission review | Academy operations |
| `docs/design/feature-006/solicitud/academy-adult-player-submission-review-desktop.png` | Desktop | Academy | Academy adult-player request | Player, evidence, authorization and submission review | Academy operations |
| `docs/design/feature-006/solicitud/academy-adult-player-submission-review-mobile.png` | Mobile | Academy | Academy adult-player request | Player, evidence, authorization and submission review | Academy operations |
| `docs/design/feature-006/solicitud/academy-minor-player-submission-review-desktop.png` | Desktop | Academy | Academy minor-player request | Minor, representative, evidence and submission review | Academy operations |
| `docs/design/feature-006/solicitud/academy-minor-player-submission-review-mobile.png` | Mobile | Academy | Academy minor-player request | Minor, representative, evidence and submission review | Academy operations |
| `docs/design/feature-006/admin/admin-unified-inbox-desktop.png` | Desktop | Administrator | Unified request inbox | Seven request types, states, filters and pagination | Administrator review |
| `docs/design/feature-006/admin/admin-request-evidence-review-desktop.png` | Desktop | Administrator | Request and evidence review | Request detail, protected evidence viewer and decision entry | Administrator review |
| `docs/design/feature-006/admin/admin-request-evidence-review-mobile.png` | Mobile | Administrator | Request and evidence review | Request detail, protected evidence viewer and decision entry | Administrator review |
| `docs/design/feature-006/admin/admin-correction-rejection-decision-desktop.png` | Desktop | Administrator | Correction or rejection | Safe correction reason, applicant preview and rejection entry | Administrator review |
| `docs/design/feature-006/admin/admin-correction-rejection-decision-mobile.png` | Mobile | Administrator | Correction or rejection | Safe correction reason, applicant preview and rejection entry | Administrator review |
| `docs/design/feature-006/admin/admin-dossier-approval-deletion-recovery-desktop.png` | Desktop | Administrator | Manual dossier and final approval | Dossier confirmed, deletion recovery and approval response pending | Administrator review |
| `docs/design/feature-006/admin/admin-dossier-approval-deletion-recovery-mobile.png` | Mobile | Administrator | Manual dossier and final approval | Dossier confirmed, deletion recovery and approval response pending | Administrator review |

## 4. Initial implementation authority

The initial implementation slice uses these exact references:

- Public request entry and request-type selection: `docs/design/feature-006/solicitud/request-type-selection-desktop-mobile.png`.
- Adult registering for themselves, including draft, identity, documents, consent and submission review:
  - `docs/design/feature-006/solicitud/adult-account-identity-desktop.png`
  - `docs/design/feature-006/solicitud/adult-account-identity-mobile.png`
  - `docs/design/feature-006/solicitud/adult-submission-review-desktop.png`
  - `docs/design/feature-006/solicitud/adult-submission-review-mobile.png`
- Legal representative registering a minor, including draft, documents, authority, consent and review:
  - `docs/design/feature-006/solicitud/represented-minor-information-desktop.png`
  - `docs/design/feature-006/solicitud/represented-minor-information-mobile.png`
  - `docs/design/feature-006/solicitud/represented-minor-submission-review-desktop.png`
  - `docs/design/feature-006/solicitud/represented-minor-submission-review-mobile.png`
- Formal-academy creation:
  - `docs/design/feature-006/solicitud/formal-academy-information-desktop.png`
  - `docs/design/feature-006/solicitud/formal-academy-information-mobile.png`
- Natural-person academy creation, including submission review:
  - `docs/design/feature-006/solicitud/natural-person-academy-information-desktop.png`
  - `docs/design/feature-006/solicitud/natural-person-academy-information-mobile.png`
  - `docs/design/feature-006/solicitud/natural-person-academy-submission-review-desktop.png`
- Applicant-visible submitted and correction experience:
  - `docs/design/feature-006/solicitud/applicant-correction-status-desktop.png`
  - `docs/design/feature-006/solicitud/applicant-correction-status-mobile.png`

The first implementation slice covers:

1. Adult self-registration request.
2. Represented-minor registration request.
3. Formal-academy creation request.
4. Natural-person academy creation request.
5. Restricted pending account access.
6. Draft persistence.
7. Private document upload.
8. Consent.
9. Submission.
10. Applicant-visible request status and correction.

## 5. Later Feature 006 phases

Academy operations remain fully in Feature 006 and use:

- Approved-academy request hub:
  - `docs/design/feature-006/solicitud/academy-request-hub-desktop.png`
  - `docs/design/feature-006/solicitud/academy-request-hub-mobile.png`
- Additional academy-account request:
  - `docs/design/feature-006/solicitud/academy-additional-account-submission-review-desktop.png`
  - `docs/design/feature-006/solicitud/academy-additional-account-submission-review-mobile.png`
- Academy adult-player request:
  - `docs/design/feature-006/solicitud/academy-adult-player-submission-review-desktop.png`
  - `docs/design/feature-006/solicitud/academy-adult-player-submission-review-mobile.png`
- Academy minor-player request:
  - `docs/design/feature-006/solicitud/academy-minor-player-submission-review-desktop.png`
  - `docs/design/feature-006/solicitud/academy-minor-player-submission-review-mobile.png`

Administrator review also remains fully in Feature 006 and uses all references under `admin/`:

- Unified inbox: `docs/design/feature-006/admin/admin-unified-inbox-desktop.png`.
- Request and evidence review:
  - `docs/design/feature-006/admin/admin-request-evidence-review-desktop.png`
  - `docs/design/feature-006/admin/admin-request-evidence-review-mobile.png`
- Correction and rejection:
  - `docs/design/feature-006/admin/admin-correction-rejection-decision-desktop.png`
  - `docs/design/feature-006/admin/admin-correction-rejection-decision-mobile.png`
- Manual dossier confirmation, evidence deletion/recovery and final approval:
  - `docs/design/feature-006/admin/admin-dossier-approval-deletion-recovery-desktop.png`
  - `docs/design/feature-006/admin/admin-dossier-approval-deletion-recovery-mobile.png`

These references govern later implementation phases; their later ordering does not remove them from the approved Feature 006 scope.

## 6. Fidelity requirements

Implementation must:

- Use the exact image paths in this manifest as visual references.
- Preserve information hierarchy, spacing and responsive composition.
- Keep desktop and mobile implementations distinct.
- Avoid inventing replacement layouts.
- Capture runtime screenshots.
- Compare each implementation with its matching approved reference.
- Record visual QA results before marking a visual task complete.

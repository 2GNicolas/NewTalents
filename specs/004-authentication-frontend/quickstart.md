# Feature 004 Validation Guide

## Prerequisites

Use the existing local backend with Feature 003 configuration and the frontend public API-base-url configuration. Do not use real passwords, temporary credentials, tokens, or an Administrator initialization/recovery operation for validation.

```powershell
npm run db:up
npm run build:backend
npm run dev:backend
npm run dev:frontend:web
```

## Validation scenarios

1. Start with no renewable session material: verify restoration appears before the login form and no authenticated content flashes.
2. Mock a valid renewable session and an expired access credential: verify exactly one refresh runs and the neutral authenticated entry appears.
3. Mock rejected renewal: verify safe local clearing and session-expired/login state. Mock no response and 5xx separately: verify connectivity and unavailable states remain distinct.
4. Validate login fields, password visibility, generic failure, throttled state, and duplicate-submit prevention on narrow and wide layouts.
5. Enter initial activation. Verify only 12–128 password length and confirmation validation; on success verify the success action reads **Continuar** and enters authenticated entry, not login.
6. Verify current logout explanation and all-session confirmation on web and mobile presentations. Confirm local material clears only for approved outcomes.
7. Verify keyboard focus, labels, field-associated errors, visible web focus, 44×44 touch targets, keyboard-safe mobile interaction, and reduced-motion behavior.

## Automated checks

```powershell
npm run test:unit --workspace=@new-talents/frontend
npm run typecheck --workspace=@new-talents/frontend
npm run export:web --workspace=@new-talents/frontend
```

Run Android/iOS smoke tests on an available emulator or device; the Windows host may record iOS Simulator validation as unavailable rather than failing the feature.

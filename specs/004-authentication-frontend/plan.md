# Implementation Plan: Cross-platform Authentication Frontend

**Branch**: `feature/004-authentication-frontend` | **Date**: 2026-09-14 | **Spec**: [spec.md](./spec.md)

## Summary

Implement the smallest Expo mobile/web authentication experience over Feature 003: restoration, email/password login, initial-access activation, single-flight refresh, neutral authenticated entry, current/all-session logout, and safe connectivity/expiration handling. It consumes exactly five existing backend operations and adds no backend, role dashboard, or product module. Initial-access success leads through a **“Continuar”** action directly to authenticated entry because it already establishes a reusable session.

## Technical Context

**Language/Version**: TypeScript `~6.0.3`, React `19.2.3`, React Native `0.86.3`, Expo `~57.0.21`, Expo Router `~57.0.20`, Node `24.11.0`, npm `10.8.0`.

**Existing Dependencies**: Expo Router, React Native, React Native Web, Safe Area Context, Screens, Expo Constants, Jest Expo, Testing Library. Add only Expo SDK-compatible `expo-secure-store` for native renewable-session storage; no web token-storage dependency.

**Storage**: Native refresh material in platform secure storage; native access token memory-only. Web access token memory-only and refresh material in explicit browser `sessionStorage`, never `localStorage`, so restoration is limited to the current browser session and the risk trade-off is visible in the design.

**Testing**: Jest unit and component tests; mocked contract/client tests; router/navigation state tests; web export/smoke; Android/iOS device or emulator validation where available. No backend changes or integration fixtures are required for frontend-only tests.

**Target Platform**: Existing Expo iOS, Android, and Web application. Responsive mobile and desktop compositions follow `docs/design/feature-004-authentication-frontend.png`.

**Performance Goals**: No protected-content flash; one refresh in flight per application session; UI disables duplicate active submissions; stable loading layout on narrow mobile and desktop.

**Constraints**: Five approved operations only; no decoding roles for authorization; no tokens or credentials in logs, diagnostics, routes, errors, autofill for temporary credentials, or visible UI; no infinite refresh loop.

## Constitution Check

| Gate | Result | Evidence |
|---|---|---|
| Bounded delivery | PASS | Authentication UI and session boundary only; product modules are excluded. |
| Privacy and minor protection | PASS | Credentials are transient, token storage is explicit, and minor access remains absent. |
| Authorization | PASS | The backend remains authoritative; client token claims do not drive roles or permissions. |
| Cross-platform consistency | PASS | Shared business-state model, responsive composition, accessibility, and target-specific secure storage are planned. |
| Architecture and quality | PASS | Thin API/storage boundaries, one state machine, contract tests, and platform validation are defined. |

Post-design re-check: PASS. No constitution exception is required.

## Architecture and Design Decisions

- Use Expo Router route groups as an application-shell boundary: a restoration gate renders before either the unauthenticated group or a minimal authenticated group. Navigation changes only after state-machine transitions; no protected screen renders while restoration is unresolved.
- Put the complete authentication state machine in one frontend authentication boundary. It owns restoration, login, activation, refresh coordination, logout, user-safe error categories, and secret cleanup. Screens render state and invoke intents; they do not call HTTP or storage directly.
- Add a narrow API client that maps only the five approved Feature 003 operations to typed success, generic-authentication, throttled, rejected-refresh, unavailable, and connectivity outcomes. It sends bearer access credentials only for the two logout operations and never interprets JWT roles.
- Persist only a renewable session credential. Native uses `expo-secure-store`; web uses documented `sessionStorage` after runtime availability checks, with an in-memory fallback that does not claim restoration after reload. Access credentials remain in memory on all targets.
- Use a module-level single-flight refresh promise. Requests that encounter one eligible access failure await the same promise, replay once only after success, and never call refresh recursively. Rejected refresh clears memory and persistence atomically and routes to safe unauthenticated state; transport failure remains retryable unavailable/connectivity state.
- Activation owns separate form state. It validates email, 12–128-character replacement password, and confirmation locally; it clears temporary/new secrets on exit. Successful replacement receives normal session material, shows the approved success state, and its **“Continuar”** action enters the authenticated group.
- Implement current logout and all-session logout with distinct intent state. All-session logout uses a web modal and native bottom-sheet-like confirmation surface; only the latter requires confirmation. Local clear is allowed after a confirmed unusable session but not after a retryable transport failure.
- Use a small design-token layer and reusable field, alert, button, password-toggle, loading, confirmation, and branding components. Preserve the reference’s deep green-black canvas, lime actions, off-white text, dark green elevated surfaces, restrained glow/borders, and athletic display typography without copying incidental screenshot chrome.
- Ship a local vector-style NT mark and CSS/React Native shapes where possible; use the approved player/background image only as a bundled, credited visual asset after asset licensing and dimensions are confirmed. Use system typography first unless the approved brand font files are supplied; do not add remote font loading. Use accessible built-in/vector icon treatment rather than a new icon package unless existing Expo dependencies prove insufficient.
- Respect screen-reader labels, native `secureTextEntry`, web focus indicators, error association, minimum 44×44 touch targets, safe keyboard avoidance, reduced motion, and layout-stable loading. Desktop is a split composition; mobile is a single-column fixed-action composition, as shown in the reference.

## Project Structure

```text
apps/frontend/
├── app/
│   ├── _layout.tsx                 # restoration gate and route groups
│   ├── (auth)/                     # login and initial-access activation
│   └── (authenticated)/            # neutral session boundary only
├── src/authentication/
│   ├── authentication-state.ts
│   ├── authentication-provider.tsx
│   ├── authentication-api.ts
│   ├── session-storage.ts
│   ├── refresh-coordinator.ts
│   └── components/
├── src/design/
│   ├── tokens.ts
│   └── components/
└── tests/
    ├── authentication/
    └── navigation/

specs/004-authentication-frontend/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/frontend-authentication.md
```

**Structure Decision**: One frontend boundary prevents form views, routes, and request code from independently refreshing or persisting credentials. Existing frontend runtime configuration remains the public API-base-url owner.

## Planned Implementation Sequence

1. Add the compatible native secure-storage dependency only after package-manager compatibility confirmation; define tokens, assets, and shared accessible primitives from the approved reference.
2. Implement the typed Feature 003 API client, platform session-storage adapter, state machine, secret clearing, error classification, and single-flight refresh with unit tests.
3. Add restoration gate and unauthenticated login/activation flows; connect initial-access success to the “Continuar” authenticated transition.
4. Add neutral authenticated entry, current logout, all-session confirmation, expiration, safe fallback, responsive layouts, and accessibility behavior.
5. Run unit, component, navigation, contract/mock, web export, native target, typecheck, and regression validation; update frontend development documentation only if implementation introduces an approved operational dependency.

## Complexity Tracking

No exception is required. The state machine, single-flight coordinator, and platform storage adapter directly satisfy the feature’s explicit session-safety requirements and avoid a larger global state, generic ACL, or backend change.

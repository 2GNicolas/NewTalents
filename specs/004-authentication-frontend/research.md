# Research: Cross-platform Authentication Frontend

## Router protection and restoration

**Decision**: Use an Expo Router root restoration gate and separate unauthenticated/authenticated route groups.

**Rationale**: The root can render only restoration until the authentication machine resolves, eliminating protected-content flash. Route grouping gives mobile and web the same state transition without treating a route pathname as proof of authentication.

**Alternatives considered**: Per-screen guards (can flash or duplicate refresh); token-presence redirects (does not validate renewal outcome); role routes (forbidden and unnecessary).

## Authentication state machine

**Decision**: Model restoration, unauthenticated login/activation, authenticated, expiration, unavailable, and logout-confirmation states explicitly, with per-operation in-flight states.

**Rationale**: Explicit transitions make duplicate submission, secret cleanup, refresh coordination, and safe fallback testable.

**Alternatives considered**: Independent screen booleans (permits contradictory state); token-only state (cannot distinguish offline, expired, and invalid sessions).

## API and refresh coordination

**Decision**: Use one typed client for the five approved operations and a single shared refresh promise. A replayed request may use only one successful renewal attempt.

**Rationale**: One boundary maps Feature 003’s generic and safe errors consistently. The single-flight promise prevents competing rotations; a retry marker prevents loops.

**Alternatives considered**: Per-screen fetch calls (duplicates refresh); automatic repeated refresh (replay risk and loops); decoding claims for authorization (stale and prohibited).

## Native and web session storage

**Decision**: Use `expo-secure-store` for native renewable-session material. On web, use explicitly selected `sessionStorage` only, guarded for availability; do not use `localStorage`. Access tokens remain memory-only.

**Rationale**: Native secure storage is the Expo-supported protected store. Browsers do not provide an equivalent secure persistent secret store; `sessionStorage` limits persistence to the tab session and is an explicit, documented compromise. When it is unavailable, restoration after reload is unavailable rather than silently weakening behavior.

**Alternatives considered**: `localStorage` (rejected: longer-lived and not silently acceptable); persistent browser cookies (requires backend transport change); no native persistence (fails restoration); third-party storage abstraction (unnecessary).

**Compatibility evidence**: The installed Expo SDK is `~57.0.21`; `expo-secure-store@~15.0.7` declares Expo as its peer dependency and is selected through the SDK-compatible Expo package line. No runtime web-storage dependency is added.

## Network errors and logout fallback

**Decision**: Classify a received 401/409 refresh outcome as confirmed invalidity, a received 429 as throttled, received 5xx as backend unavailable, and absent/aborted transport response as connectivity failure. Clear local session only on successful logout or confirmed unusable authentication state.

**Rationale**: It preserves the backend’s generic failure contract and avoids reporting offline users as invalid. It prevents contradictory authenticated UI without falsely claiming a retryable logout succeeded.

## Visual, responsive, and accessible design

**Decision**: Translate the approved reference into tokens and primitives: green-black canvas, lime primary actions, off-white copy, dark green elevated surfaces, restrained glow, desktop split panel, and mobile single column. Use platform accessible text/input/button primitives and reduced-motion branches.

**Rationale**: Shared tokens retain visual intent across platforms while responsive composition follows the reference’s actual mobile/desktop differences. Native controls and accessible semantics prevent visual-only state communication.

**Alternatives considered**: Screenshot-specific fixed layout (not responsive); remote fonts/assets (adds reliability and licensing concerns); animation as the only loading affordance (fails reduced motion).

## Verification approach

**Decision**: Test pure state transitions/storage/API mapping, rendered fields/alerts/actions, route gating and coordinated refresh with mocks, web export, and native device/emulator smoke where available.

**Rationale**: It verifies business equivalence before device-specific visual review and avoids requiring backend changes or real credentials.

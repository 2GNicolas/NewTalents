# Frontend Authentication State and Data Model

## State ownership

| Entity | Fields and rules | Lifetime |
|---|---|---|
| Authentication state | `restoring`, `unauthenticated`, `authenticated`, `session-expired`, `connectivity-failure`, `backend-unavailable`, plus active operation | App boundary; never inferred from a token alone. |
| Access credential | Opaque short-lived access material | Memory only; cleared with session end. |
| Renewable session material | Opaque refresh material | Native secure storage or explicit web session storage; cleared on confirmed invalidity/logout. |
| Login form | Email, password, local validation, visibility, submitting flag | Password clears on success, exit, or cancellation. |
| Activation form | Email, temporary credential, new password, confirmation, local validation, submitting/success flag | Every secret clears on completion, failure conclusion, exit, or cancellation. |
| Refresh flight | One shared promise/outcome and one-replay marker | Exists only while coordinating renewal. |
| Logout intent | `current`, `all`, confirmation visibility, submitting/failure | Cleared after outcome; all requires confirmation. |

## State transitions

```text
launch -> restoring
restoring -> authenticated | unauthenticated | connectivity-failure | backend-unavailable
unauthenticated -> login-submitting -> authenticated | generic-failure | throttled | connectivity-failure | backend-unavailable
unauthenticated -> activation -> activation-submitting -> activation-success -> authenticated (Continuar)
authenticated -> refresh-in-progress -> authenticated | session-expired -> unauthenticated
authenticated -> logout-current -> unauthenticated
authenticated -> logout-all-confirmation -> logout-all -> unauthenticated
```

## Invariants

- At most one refresh flight exists.
- One original request can replay at most once after coordinated refresh.
- No screen receives credentials through navigation parameters, error text, logs, or analytics payloads.
- Authenticated routes are unavailable while restoration, expiration, or safe fallback is active.
- Activation success contains session material and transitions through **Continuar** to authenticated entry; it never routes to login.
- Connectivity/unavailable outcomes retain no claim that credentials or account eligibility were invalid.

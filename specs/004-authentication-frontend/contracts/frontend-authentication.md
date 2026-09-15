# Frontend Authentication Boundary Contract

## Backend operations consumed

| Intent | Feature 003 operation | Success | Safe frontend categories |
|---|---|---|---|
| Login | `POST /auth/login` | access and renewable session material | generic authentication failure, throttled, connectivity, unavailable |
| Activate access | `POST /auth/initial-credential/replace` | access and renewable session material | generic activation failure, connectivity, unavailable |
| Renew | `POST /auth/refresh` | replacement session material | confirmed invalid/reused, connectivity, unavailable |
| Close current | `POST /auth/logout` | no content | completed, confirmed unusable fallback, retryable failure |
| Close all | `POST /auth/logout-all` | no content | completed, confirmed unusable fallback, retryable failure |

No provisioning, reissue, Administrator, registration, or role-management operation is available in the frontend boundary.

## Storage contract

- Access material is memory-only.
- Native renewable material uses the secure platform adapter.
- Web renewable material uses only browser-session storage after availability validation; it never uses local storage.
- Storage failure becomes a safe restoration/unavailable outcome and never exposes the stored value.
- Clearing authentication atomically clears memory, renewable storage, form secrets, in-flight refresh references, and authenticated navigation eligibility.

## Error and retry contract

- Generic backend authentication denial is presented without account-state inference.
- One refresh flight serves all waiting eligible requests; every original request has at most one post-refresh replay.
- Refresh itself never attempts refresh. Confirmed rejected refresh clears authentication; network/server failure is shown as distinct retryable state.
- Each form and logout action owns one active submission; its retry control becomes available only after completion.

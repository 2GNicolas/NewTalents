# Research: Authentication, Sessions, and Protected Requests

## Password hashing

**Decision**: Add `argon2@0.45.1` as the sole password-hashing dependency and use Argon2id with
19 MiB memory, two iterations, and parallelism one. Store its PHC-compatible encoded output for
both permanent and temporary credentials.

**Rationale**: The selected release is the current npm stable version discovered during planning and
declares Node `>=16.17.0`, so it covers the approved Node `24.11.0`. It is a focused native
package with supported prebuilt binaries for the normal Windows development and Linux deployment
targets; its PHC output contains the algorithm parameters and salt needed for verification. The
lockfile contains no existing password-hashing package, and Node's standard library does not provide
a production-ready Argon2id API in the approved Node 24 baseline.

**Alternatives rejected**: bcrypt (conflicts with the approved Argon2id decision); a pure JavaScript
implementation (slower and less suitable for this server boundary); a custom password construction
using lower-level crypto APIs (unnecessary security risk).

**Compatibility evidence**: `npm view argon2 version engines --json` returned `0.45.1` and
`node >=16.17.0` on 2026-09-11; its package metadata declares N-API version 8. The project's
official README documents release-built prebuilt binaries for Windows Server 2022 x86-64 and Ubuntu
22.04 x86-64/ARM64, which covers the repository's Windows development and Linux deployment
direction. The package must be installed only in `@new-talents/backend`, pinned exactly, and
verified through `npm ci`, generation, typecheck, and Windows/Linux-compatible CI or deployment
validation before implementation completes.

Sources: [argon2 npm package](https://www.npmjs.com/package/argon2),
[node-argon2 prebuilt binary support](https://github.com/ranisalt/node-argon2/blob/master/README.md),
[OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

## JWT access tokens

**Decision**: Add `jose@6.2.12` as the focused JWT dependency. Use a single configured symmetric
HS256 signing secret for the present single-backend deployment, explicitly pin verification to HS256,
and require configured issuer, audience, `typ`, subject, session ID, token ID, issued-at, and
expiration claims. Access tokens expire after 15 minutes.

**Rationale**: No JWT package exists in the lockfile. `jose` supports standards-based signing and
strict algorithm selection without introducing a broader authentication framework. A symmetric
secret is the smallest secure fit while one backend both issues and verifies tokens. Runtime
configuration provides the secret and fails closed when absent or invalid. A later rotation can
accept a prior configured verification key during a bounded overlap while newly issued tokens use a
new key identifier; this is documented only, not implemented now.

**Alternatives rejected**: `@nestjs/jwt@12.0.1` plus `jsonwebtoken` (additional Nest wrapper and
dependency surface where a focused signer/verifier is sufficient); accepting an algorithm named by
the token (algorithm-confusion risk); asymmetric keys now (unnecessary key-distribution infrastructure
for one issuer/verifier).

**Compatibility evidence**: `npm view jose version` returned `6.2.12` on 2026-09-11. Its ESM
orientation fits the backend workspace's `"type": "module"` and TypeScript 5.9 build. Pin exactly
in the backend workspace and validate after installation.

Sources: [jose npm package](https://www.npmjs.com/package/jose),
[RFC 7519](https://www.rfc-editor.org/rfc/rfc7519),
[RFC 8725 JWT Best Current Practices](https://www.rfc-editor.org/rfc/rfc8725).

## Refresh tokens and session families

**Decision**: Generate opaque refresh tokens with Node `crypto.randomBytes` at 32 bytes minimum
(256 bits), encode them safely for JSON transport, and store only a SHA-256 digest. Model one
session family per browser/device session and append refresh-token history with consumed, replaced,
revoked, and expired timestamps.

**Rationale**: Refresh tokens are high-entropy random secrets, so a fast one-way digest is suitable
for lookup and reuse detection; Argon2id remains reserved for human-entered passwords and temporary
credentials. Atomic rotation consumes the presented token, records its replacement, and issues a
new token in the same operation. A later presentation of consumed or superseded history revokes
only the affected family. Independent session families preserve unrelated devices.

**Alternatives rejected**: Persisting plaintext refresh tokens (unacceptable exposure); a single
refresh token per identity (breaks independent devices); revoking every session on one family reuse
(overly disruptive); a stateless refresh JWT (cannot provide the required rotation/reuse evidence).

Sources: [Node crypto](https://nodejs.org/api/crypto.html),
[OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

## Current authorization and Nest boundary

**Decision**: Create an authentication module with a Bearer-token guard that verifies JWT claims and
then loads current session and identity state from PostgreSQL. The guard constructs only an explicit
identity-and-session actor context. A narrow transport adapter supplies current identity, roles,
membership, and caller-provided resource facts to the existing Feature 002 `AuthorizationService`;
controllers never authorize through token role claims or direct role-string checks.

**Rationale**: This preserves Feature 002 as the owner of permissions and authorization decisions.
The existing health controllers remain explicitly public and retain their responses. Explicit
public-route metadata avoids a global default that would accidentally protect health or future
approved anonymous routes; protected routes are otherwise denied by default.

**Alternatives rejected**: Trusting roles in access tokens (stale and violates Feature 003);
duplicating the permission catalog in guards/controllers (violates Feature 002 boundary); a global
guard without explicit public metadata (risks health availability).

## Transactions, constraints, and cleanup

**Decision**: Use short Prisma interactive transactions at Serializable isolation for password
activation, refresh rotation, logout-all groups, bootstrap, and recovery. Retry only `P2034` for
three total attempts with deterministic waits of 50 ms and 100 ms, re-running the entire atomic
operation and never nesting transactions. Use PostgreSQL constraints and conditional writes as final
integrity boundaries.

**Rationale**: The Feature 002 retry policy is already proven in this repository. Rotation,
replacement, provisioning, and bootstrap must atomically combine credential/session state and audit
evidence. Serializable isolation plus conditional updates makes two concurrent consumptions resolve
to one success and a controlled denial/conflict.

**Retention decision**: Retain audit/security records immutably. Expired or revoked sessions and
refresh history remain queryable for 90 days after their terminal timestamp before a bounded cleanup
job removes only non-audit operational rows; authentication-attempt windows are removed after 24
hours past window expiry. The exact scheduler mechanism is an implementation detail.

**Alternatives rejected**: application-only prechecks (race-prone); nested interactive transactions
(risks deadlock and breaks atomic scope); deleting refresh history immediately (prevents reuse
detection); indefinite unbounded operational history (unnecessary growth).

Sources: [Prisma transactions](https://www.prisma.io/docs/orm/prisma-client/queries/transactions),
[PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html).

## Abuse protection and source address

**Decision**: Persist failed authentication controls keyed by a normalized email digest and a
source-address digest. Apply a maximum of five failures within 15 minutes; a successful
authentication clears or closes the applicable window, and eligibility resumes automatically when
the window expires. Trust forwarded addresses only when validated runtime configuration enables a
known trusted-proxy mode.

**Rationale**: Persistent records survive backend restarts and avoid keeping unnecessary plaintext
identifiers. Generic throttled responses preserve the non-enumerating login contract.

**Alternatives rejected**: in-memory counters (lost on restart); permanent lockout (forbidden);
unconditionally trusting `X-Forwarded-For` (spoofable); storing raw email/address in audit
records (unnecessary privacy exposure).

Sources: [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html),
[OWASP Automated Threats guidance](https://cheatsheetseries.owasp.org/cheatsheets/Bot_Management_and_Anti-Automation_Cheat_Sheet.html).

## TocoYVoy compatibility

**Decision**: Reuse only the compatible architectural direction: Expo communicates with a Nest REST
backend through a documented OpenAPI contract; access and refresh credentials are separate; public
and authenticated access are distinct. New Talents intentionally does not reuse TocoYVoy's frontend
storage behavior or role semantics.

**Rationale**: TocoYVoy's architecture documents the same broad Nest/Expo REST boundary, while
Feature 003 explicitly defers frontend credential persistence and preserves New Talents Feature 002
authorization ownership.

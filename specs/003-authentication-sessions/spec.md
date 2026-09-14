# Feature Specification: Authentication, Sessions, and Protected Requests

**Feature Branch**: `feature/003-authentication-sessions`

**Created**: 2026-09-11

**Status**: Draft

**Input**: Establish the bounded authentication, session, credential-token, and protected-request foundation for New Talents without absorbing account onboarding, product workflows, or frontend work.

## Confirmed Product Rules

- Active New Talents Administrators, New Talents Analysts, Tutors, and Academy Users may authenticate. One identity may retain multiple roles.
- Minor players receive neither credentials nor authenticated access in the MVP.
- Inactive, disabled, unknown, or otherwise ineligible identities cannot create, use, or renew sessions. Authentication never creates identities or assigns roles.
- Authentication uses the identity email and password. A successful sign-in creates an independent session; one identity may have several active device or browser sessions.
- A successful session intentionally issues a short-lived access credential and a renewable session credential. The access credential authenticates protected requests; the renewable credential is accepted only by renewal.
- Renewal rotates or replaces the renewable credential. A superseded, revoked, expired, malformed, or reused renewable credential cannot create another valid session.
- A user may close the current session or all sessions for that identity. Closing one does not close other sessions unless all-session closure was requested.
- Current identity status, role assignments, memberships, relationships, permissions, sensitivity, and resource facts remain authoritative. Stale information in an access credential never overrides Feature 002 authorization.
- After the first Administrator exists, only an active, currently authorized New Talents Administrator may provision an initial temporary credential for an already existing eligible identity. Provisioning does not create identities or change roles.
- A temporary credential is returned as plaintext only once to the authorized Administrator, is never persistently recoverable or logged, and is delivered outside the platform through a New Talents operational channel. The platform records provisioning, not secure delivery.
- A provisioned identity must replace its temporary credential during its first successful authentication before it can receive a normal reusable session. An authorized Administrator may invalidate and reissue an unused temporary credential; reissue invalidates all earlier unused temporary credentials for that identity.
- First-ever Administrator initialization, Administrator-authorized credential provisioning, and emergency Administrator recovery are distinct controlled operations.
- First-ever Administrator initialization is permitted only while the system has never had an Administrator assignment. Emergency recovery is permitted only while no active and eligible Administrator exists, requires explicit operator confirmation, and never implicitly reactivates a historical Administrator.
- Existing approved anonymous behavior and Feature 001 liveness and readiness remain accessible under their current rules.

## Approved Provisioning and Recovery Decisions

- **First-ever Administrator initialization** is the only initialization path that may operate when the system has never had an Administrator assignment. It is non-public, uses explicit operator-provided identity and credential values, and creates the minimum identity, protected credential, and Administrator-role state atomically.
- **Administrator-authorized credential provisioning** occurs only after the first Administrator exists. An active, currently authorized Administrator may provision an initial one-time temporary credential only for an existing eligible identity; it cannot create an identity or assign, revoke, or modify a role. The temporary credential is delivered by a New Talents external operational channel that this MVP neither selects nor automates.
- **Emergency Administrator recovery** is a separate non-public controlled operator operation. It is allowed only when no active and eligible Administrator exists, requires explicit operator confirmation, establishes explicitly identified recovery identity, credential, and active Administrator state atomically, and is rejected whenever an active eligible Administrator exists.
- A historical or inactive Administrator assignment does not permanently block recovery. Recovery preserves historical identities, role assignments, sessions, memberships, and audit records; it does not implicitly reactivate an old Administrator and safely rejects repeat recovery after an active eligible Administrator exists.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign In and Use a Protected Operation (Priority: P1)

As an eligible New Talents user, I can sign in and use an authenticated backend operation so that my current identity can participate safely in approved work.

**Why this priority**: Authentication is the entry boundary for every protected backend capability.

**Independent Test**: An active eligible identity with valid credentials obtains an authenticated context and completes a protected operation that the existing authorization foundation permits.

**Acceptance Scenarios**:

1. **Given** an active identity with an eligible active role and valid credentials, **When** it signs in, **Then** it receives one independent session with the intentionally issued credentials.
2. **Given** a protected operation with a valid access credential, **When** current identity and supplied resource facts satisfy Feature 002 authorization, **Then** the operation may proceed with an explicit authenticated actor context.
3. **Given** a valid access credential whose identity is inactive or whose current authorization facts no longer permit the operation, **When** it is used, **Then** the operation is denied safely.
4. **Given** an existing eligible identity with a valid initial temporary credential, **When** it performs its first authentication, **Then** it must replace that credential before receiving a normal reusable session.

---

### User Story 2 - Renew a Session Safely (Priority: P1)

As an authenticated user, I can renew an active session without allowing a superseded renewable credential to create another valid session.

**Why this priority**: Renewal preserves legitimate access while protecting against credential replay.

**Independent Test**: An active session renews once; its successor remains usable and the superseded credential is rejected without producing another session.

**Acceptance Scenarios**:

1. **Given** an active, unexpired session and valid renewable credential, **When** renewal is requested, **Then** the session renews and the prior renewable credential is superseded.
2. **Given** a superseded renewable credential, **When** it is presented again, **Then** no new valid session or credential is issued and no sensitive detail is disclosed.
3. **Given** an expired, revoked, malformed, or ineligible session, **When** renewal is requested, **Then** it is denied safely.

---

### User Story 3 - Close Current or All Sessions (Priority: P1)

As an authenticated user, I can close the current session or all my sessions so that I can control continued access from browsers and devices.

**Why this priority**: Users need a bounded way to terminate access without weakening independent sessions.

**Independent Test**: Two sessions for one identity can be created; closing one invalidates only that session, while closing all invalidates each remaining session.

**Acceptance Scenarios**:

1. **Given** two active sessions for one identity, **When** the user closes the current session, **Then** that session cannot be reused or renewed and the other remains active.
2. **Given** multiple active sessions for one identity, **When** the user closes all sessions, **Then** every session becomes unusable and non-renewable.
3. **Given** a revoked or expired session, **When** its credentials are presented, **Then** they are rejected safely.

---

### User Story 4 - Reject Unsafe Authentication Attempts (Priority: P1)

As New Talents, I can reject invalid or abusive authentication attempts without disclosing account information or permanently locking legitimate users through an undefined rule.

**Why this priority**: Credential handling must preserve privacy and availability at the security boundary.

**Independent Test**: Unknown-email, incorrect-password, malformed, expired, revoked, inactive, and repeated-failure cases all yield safe outcomes; a later valid attempt is treated under the defined abuse-protection policy.

**Acceptance Scenarios**:

1. **Given** an unknown email, invalid password, or ineligible identity, **When** sign-in is attempted, **Then** the visible failure does not disclose which condition occurred.
2. **Given** repeated failed sign-in attempts, **When** the defined abuse threshold is reached, **Then** proportionate temporary protection is applied without an undefined permanent lockout.
3. **Given** a malformed or invalid credential, **When** it is presented, **Then** no protected information, session state, credential material, or infrastructure detail is disclosed.

---

### User Story 5 - Initialize the First-ever Administrator Safely (Priority: P2)

As an authorized New Talents operator, I can initialize the first-ever Administrator through a controlled boundary so that administration can begin without public registration or committed credentials.

**Why this priority**: The initial Administrator is required to govern privileged changes but must not become an insecure bootstrap path.

**Independent Test**: A controlled operator action with explicit values creates only the minimum initial identity, credential, and Administrator role state, leaves a safe trace, and rejects an unsafe repeat.

**Acceptance Scenarios**:

1. **Given** the system has never had an Administrator assignment and explicit operator-provided values, **When** controlled initialization is performed, **Then** one minimum Administrator identity, protected credential, and role state is created atomically and its trace excludes plaintext passwords and issued credentials.
2. **Given** default, hardcoded, missing, or unsafe values, **When** initialization is requested, **Then** it is refused without partial state.
3. **Given** any prior Administrator assignment exists, **When** first-ever initialization is attempted, **Then** it is refused without a duplicate; any later loss of active administration is governed only by emergency recovery.

---

### User Story 6 - Provision an Existing Identity Credential (Priority: P1)

As an active, authorized New Talents Administrator, I can provision or reissue a one-time initial credential for an existing eligible identity so that the identity can complete first access without public onboarding.

**Why this priority**: Eligible Analysts, Tutors, and Academy Users need a controlled entry route that preserves Feature 002 identity and role governance.

**Independent Test**: An authorized Administrator provisions an initial credential for an existing eligible identity; the credential is disclosed once only, cannot create or alter identity or role state, and requires replacement before normal access.

**Acceptance Scenarios**:

1. **Given** an active, currently authorized Administrator and an existing eligible identity, **When** initial credential provisioning succeeds, **Then** exactly one temporary credential is made available once in the result, provisioning is traceable without plaintext, and no identity or role state changes.
2. **Given** a temporary credential that is valid and unused and an identity that remains currently eligible, **When** the identity replaces it during first authentication, **Then** the temporary credential becomes unusable and normal reusable-session access may begin.
3. **Given** a lost, exposed, consumed, expired, invalidated, or superseded temporary credential, **When** it is presented, **Then** it cannot create a normal session; an authorized Administrator may invalidate and reissue an unused credential, which invalidates every previous unused credential for that identity.
4. **Given** an actor without current Administrator authorization or an identity that does not already exist and remain eligible, **When** provisioning or reissue is requested, **Then** it is denied without creating an identity, changing a role, activating a partial credential, or disclosing sensitive information.

---

### User Story 7 - Recover Administration Safely (Priority: P2)

As New Talents, I can recover the Administrator capability only when no active eligible Administrator remains so that historical administrator records do not permanently lock the organization out.

**Why this priority**: A controlled recovery path maintains governance continuity while preventing it from becoming an ordinary privilege-escalation mechanism.

**Independent Test**: With no active eligible Administrator, an explicitly confirmed controlled operator action creates the recovery state and immutable redacted trace; the same operation is refused whenever an active eligible Administrator exists.

**Acceptance Scenarios**:

1. **Given** no active eligible Administrator, explicit operator confirmation, and explicit recovery values, **When** controlled recovery succeeds, **Then** explicitly identified recovery identity, credential, and active Administrator state are established atomically with an immutable redacted audit record.
2. **Given** at least one active eligible Administrator, **When** emergency recovery is requested, **Then** it is rejected without changing identity, role, session, membership, or audit history.
3. **Given** a historical or inactive Administrator assignment, **When** recovery is needed, **Then** it does not implicitly reactivate that prior Administrator or delete or rewrite historical records.
4. **Given** recovery completed and an active eligible Administrator now exists, **When** recovery is attempted again, **Then** it is rejected safely.

### Edge Cases

- An identity has multiple roles, but none are active or applicable.
- A role, membership, or tutor relationship changes after an access credential is issued.
- An identity is deactivated while one or more sessions are active.
- A renewable credential is replayed after rotation or presented from an unrelated session.
- A temporary credential is lost, exposed, reissued, consumed, expired, invalidated, or presented after its first-use replacement.
- An attempt to use a temporary credential to obtain a normal reusable session occurs before successful mandatory replacement.
- One device closes its session while another remains active.
- Audit recording cannot retain a security-relevant authentication or provisioning outcome.
- Abuse protection is triggered by repeated invalid attempts and a legitimate user later presents valid credentials.
- A public request reaches existing health or approved anonymous behavior without credentials.
- First-ever Administrator initialization is attempted concurrently or after any prior Administrator assignment.
- Emergency Administrator recovery is requested while an active eligible Administrator exists or is repeated after recovery restored one.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow authentication only for active identities with at least one active eligible role: New Talents Administrator, New Talents Analyst, Tutor, or Academy User.
- **FR-002**: The system MUST preserve multiple existing roles for one identity without treating one role as a replacement for another.
- **FR-003**: The system MUST NOT issue credentials or authenticated access to a minor player.
- **FR-004**: Ordinary authentication and Administrator-authorized credential provisioning MUST NOT create identities, assign roles, alter memberships, or alter the Feature 002 permission catalog; first-ever initialization and emergency recovery are the explicitly controlled exceptions for establishing Administrator state.
- **FR-005**: The system MUST authenticate an eligible identity through its email and password, with mandatory first-use replacement applied when that identity presents a valid initial temporary credential.
- **FR-006**: Successful normal authentication MUST create an independent active session and intentionally issue a short-lived access credential and renewable session credential; temporary-credential first authentication MUST not issue a normal reusable session before successful replacement.
- **FR-007**: The system MUST permit multiple independent active sessions for the same identity.
- **FR-008**: Unknown email, invalid password, malformed input, and ineligible identity failures MUST have an externally indistinguishable safe outcome.
- **FR-009**: Authentication and protected-request denials MUST NOT disclose stored credentials, credential derivatives, tokens, internal identity state, session state, or infrastructure details.
- **FR-010**: Repeated failed authentication attempts MUST receive proportionate, defined abuse protection that does not impose an undefined permanent lockout.
- **FR-011**: A valid access credential MUST establish an authenticated actor context identifying the current identity and session.
- **FR-012**: The actor context MUST NOT be authoritative for current roles, permissions, memberships, relationships, sensitivity, or resource access.
- **FR-013**: Protected operations MUST reject missing, invalid, expired, revoked, malformed, or ineligible authentication before releasing protected information.
- **FR-014**: Authorization-sensitive operations MUST delegate current permission, role, membership, relationship, sensitivity, and resource-context decisions to Feature 002 without duplicating role-string rules or its catalog.
- **FR-015**: Current server-side identity and authorization facts MUST override stale role, membership, or relationship information in an access credential.
- **FR-016**: Session renewal MUST accept only the renewable credential for an active, unexpired, non-revoked session and eligible current identity.
- **FR-017**: Renewal MUST rotate or replace the renewable credential so that a superseded credential cannot remain valid indefinitely.
- **FR-018**: Reuse of a superseded renewable credential MUST be handled safely and MUST NOT issue another valid session or credential.
- **FR-019**: Raw renewable credentials MUST NOT be stored recoverably or included in logs, errors, audit payloads, or public responses other than intentional issuance.
- **FR-020**: An authenticated user MUST be able to close the current session without revoking other sessions unless all-session closure was explicitly requested.
- **FR-021**: An authenticated user MUST be able to close all active sessions belonging to that identity; each closed session MUST reject later access and renewal.
- **FR-022**: Expired, revoked, replaced, or closed sessions MUST reject later access and renewal.
- **FR-023**: Deactivating an identity MUST prevent continued authenticated use and renewal, including sessions active before deactivation.
- **FR-024**: Existing approved anonymous behavior and Feature 001 liveness and readiness MUST remain accessible under their existing rules.
- **FR-025**: Authentication, temporary-credential replacement, renewal, logout, first-ever initialization, credential provisioning, and emergency recovery events MUST retain immutable redacted auditability without plaintext passwords, credential hashes, recoverable credentials, issued tokens, raw tokens, or other sensitive payloads.
- **FR-026**: First-ever Administrator initialization MUST be controlled and non-public, require explicit operator-provided identity and credential values, operate only when the system has never had an Administrator assignment, create only the minimum identity, protected credential, and Administrator role state atomically, reject unsafe duplicate initialization, and never use default, hardcoded, generated-in-source, or committed credentials.
- **FR-027**: After the first Administrator exists, only an active, currently authorized New Talents Administrator MAY initiate credential provisioning, invalidation, or reissue for an existing eligible identity.
- **FR-028**: Credential provisioning MUST NOT create an identity or assign, revoke, or modify roles, and it MUST create only an initial one-time temporary credential intended for first access.
- **FR-029**: The plaintext initial temporary credential MAY be returned only once in a successful authorized provisioning result and MUST NOT be persisted or logged; the platform MUST record provisioning without claiming secure external delivery.
- **FR-030**: The identity MUST validate its initial temporary credential and current eligibility and replace that credential during first authentication before receiving normal reusable-session access; successful replacement MUST invalidate the temporary credential.
- **FR-031**: A consumed, expired, invalidated, superseded, or otherwise invalid temporary credential MUST NOT be reused or create a normal session, and a failed replacement MUST NOT leave a partially activated credential or session.
- **FR-032**: An authorized Administrator MAY invalidate and reissue an unused temporary credential for an existing eligible identity; reissue MUST invalidate every previous unused temporary credential for that identity.
- **FR-033**: Delivery of a temporary credential MUST occur through an external New Talents operational channel that this MVP neither selects, automates, nor represents as securely confirmed.
- **FR-034**: Emergency Administrator recovery MUST be a separate controlled, non-public operator operation permitted only when no active and eligible Administrator exists, and it MUST require explicit operator confirmation.
- **FR-035**: Emergency recovery MUST establish explicitly identified recovery identity, protected credential, and active Administrator state atomically, without implicitly reactivating a historical Administrator.
- **FR-036**: Emergency recovery MUST preserve historical identities, role assignments, sessions, memberships, and audit records; it MUST create an immutable redacted recovery audit record without plaintext credentials, credential hashes, raw tokens, or other secrets; it MUST reject a request whenever an active eligible Administrator exists or recovery has already restored one, and it MUST invalidate incompatible active authentication state where required for safety.

### Key Entities

- **Authentication credential**: Non-public identity-bound credential state used to verify email/password sign-in; its secret material is never exposed or stored recoverably.
- **Initial temporary credential**: A one-time credential provisioned by an authorized Administrator only for an existing eligible identity; it is disclosed once, must be replaced at first authentication, and cannot create a normal reusable session beforehand.
- **Session**: An independent, time-bounded authenticated-use record for one identity and one browser or device context, with active, revoked, expired, or replaced lifecycle.
- **Access credential**: The short-lived credential intentionally issued by a successful session and used only to establish an authenticated actor context.
- **Renewable session credential**: The non-public credential used only to renew its associated session; rotation makes its predecessor unusable.
- **Authenticated actor context**: The explicit current identity-and-session context established at the protected boundary; it delegates current authorization to Feature 002.
- **Authentication security record**: An immutable traceable redacted record of authentication, renewal, closure, provisioning, recovery, or security-relevant denial outcomes.
- **First-ever Administrator initialization**: The one-time controlled operation available only before any Administrator assignment has existed, which creates the minimum Administrator state.
- **Emergency Administrator recovery**: The separately controlled operation available only when no active eligible Administrator remains; it establishes explicitly identified recovery Administrator state without rewriting history.

### Scope Boundaries

This feature includes backend authentication eligibility, email/password validation, independent sessions, access and renewable session credentials, renewal rotation and reuse handling, current- and all-session closure, identity-deactivation effects, authenticated actor context, delegation to Feature 002 authorization, safe failures, proportionate abuse protection, first-ever Administrator initialization, Administrator-authorized temporary credential provisioning and mandatory first-use replacement for existing eligible identities, emergency Administrator recovery, security auditability, and preservation of public and health behavior.

This feature excludes public registration; tutor or academy self-service account creation; invitations; email verification; forgotten-password recovery; general authenticated password changes other than mandatory first-use replacement of an initial temporary credential; MFA; OAuth, social login, SSO, SMS, and biometric authentication; frontend or mobile login and session storage; player and minor accounts; player passports; matches; FEM; statistics; evaluations; videos; payments; notifications; generic ACL redesign; changes to Feature 002 role or permission semantics; automated or integrated temporary-credential delivery; deployment and production infrastructure; and tournament management.

It does not define database tables, migrations, cryptographic algorithms, credential work factors, exact expiration values, token format, credential transport, concrete libraries, or implementation-level framework constructs.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of documented eligible-identity cases with valid credentials, authentication creates one independent active session; in 100% of invalid or ineligible cases, it returns the same safe failure category without account-existence disclosure.
- **SC-002**: In 100% of documented renewal cases, a valid active renewable credential succeeds once according to rotation policy, and every documented superseded, revoked, expired, malformed, or replayed credential produces no additional valid session.
- **SC-003**: In 100% of documented current-session and all-session closure cases, exactly the requested session set becomes unusable for access and renewal.
- **SC-004**: In 100% of documented identity-deactivation and stale-authorization cases, protected access and renewal are denied when current server-side facts do not permit them.
- **SC-005**: In 100% of documented authentication, renewal, logout, and provisioning failure cases, responses and retained trace records contain no plaintext password, recoverable credential, issued token, protected resource detail, or infrastructure detail.
- **SC-006**: All documented protected operations establish an authenticated actor context and use the Feature 002 evaluator for authorization-sensitive decisions; scope review finds no duplicate role-string authorization logic.
- **SC-007**: 100% of documented first-ever Administrator initialization attempts either create the minimum permitted state and immutable redacted trace once, or reject without partial state; no default, hardcoded, generated-in-source, or committed credential is accepted.
- **SC-008**: In 100% of documented authorized temporary-credential provisioning cases, an existing eligible identity receives at most one disclosed temporary credential, no identity or role change occurs, and the retained trace contains no plaintext credential or claim of secure delivery.
- **SC-009**: In 100% of documented first-use cases, a temporary credential requires successful replacement before a normal reusable session can be created; every consumed, expired, invalidated, superseded, or failed replacement case creates no partial credential or session.
- **SC-010**: In 100% of documented emergency-recovery cases, recovery succeeds only with no active eligible Administrator and explicit confirmation, preserves history, establishes the explicit recovery state and immutable redacted trace atomically without credentials, hashes, or raw tokens, and is rejected once an active eligible Administrator exists.
- **SC-011**: Existing documented liveness, readiness, and approved anonymous behavior remain available in all authentication test scenarios.
- **SC-012**: Scope review finds zero public registration, invitation, password-recovery, general password-change, MFA, social-login, frontend-session, player-account, product-workflow, automated credential-delivery, deployment, or tournament behavior in this feature.

## Assumptions

- Feature 001 remains the runtime, database, health, and local-development baseline.
- Feature 002 remains authoritative for identity status, roles, memberships, permissions, resource relationships, and authorization decisions; this feature does not change those semantics.
- Credential format, storage mechanism, expiration durations, transport mechanism, cryptographic choices, abuse thresholds, and implementation libraries are planning decisions.
- The controlled initialization, provisioning, and recovery boundaries are operated only by New Talents personnel and are never public registration or ordinary authenticated workflows.
- External operational delivery of an initial temporary credential remains outside this MVP; no platform confirmation of secure delivery is implied.
- Mandatory replacement of an initial temporary credential is solely a first-access completion step and does not introduce general password change or recovery behavior.
- Endpoint paths, command or script names, persistence structures, credential formats and expirations, hashing choices, transport, framework mechanisms, rate-limit values, and libraries remain planning decisions.

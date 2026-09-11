# Feature Specification: Identity, Roles, and Authorization

**Feature Branch**: `feature/002-identity-roles-authorization`

**Created**: 2026-09-11

**Status**: Draft

**Input**: Define the bounded identity, functional-role, organizational-membership, and
authorization foundation required by the New Talents MVP, independently from login and sessions.

## Confirmed Product Rules

- New Talents has internal personnel responsible for administration and sports analysis.
- Analysts register and modify analyzed match events and choose which moments become highlights.
- New Talents reviews profile submissions, corrections, transfers, service activations, and manual
  payment records.
- Tutors have accounts and may manage multiple players; minor players do not have their own accounts
  in the MVP.
- Academies have accounts and may have multiple internal users, all with the same MVP access level.
- New Talents Administrator and New Talents Analyst are separate functional roles in the MVP.
- A system identity may hold multiple functional roles, but combined roles never bypass active-role,
  membership, relationship, explicit-permission, organizational, or sensitive-information limits.
- Only an active New Talents Administrator controls privileged functional-role changes; Analysts,
  Tutors, and Academy Users do not administer New Talents internal roles.
- An Academy User may belong to only one active academy at a time; an academy may have multiple
  active Academy Users.
- Public visitors and scouts may view authorized public football information without becoming
  authenticated roles.
- Sensitive personal information is separate from public football information.
- Authorization is enforced by the backend and never inferred solely from frontend visibility.
- Tournament management is outside the MVP.

## Clarifications

### Session 2026-09-11

- Q: Are New Talents administration and sports analysis separate functional roles? → A: Yes; New
  Talents Administrator and New Talents Analyst are separate roles, alongside Tutor and Academy User.
- Q: May an identity hold multiple functional roles? → A: Yes, only while the identity and each role
  assignment are active and valid and the applicable membership, relationship, and explicit
  permission are present; combined roles do not bypass any boundary.
- Q: Who controls privileged functional roles? → A: Only an active New Talents Administrator may
  assign, modify, or revoke them; Analysts, Tutors, and Academy Users may not administer New Talents
  internal roles.
- Q: May an Academy User belong to more than one academy? → A: No; one active academy at a time,
  with the previous membership ended or deactivated and retained in traceable history before another
  becomes effective.

## Role Governance Decisions

The four role-governance decisions above are resolved for the MVP. The initial technical bootstrap
for the first New Talents Administrator remains a planning decision and is not defined by this
specification. The authority and workflow for future academy-player transfers remain outside this
feature.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Evaluate a Protected Action (Priority: P1)

As New Talents, I can evaluate whether an identity context may perform a protected action so that
future product capabilities apply least privilege consistently.

**Why this priority**: Every future protected capability depends on a common, denial-by-default
decision that is independent of its own business workflow.

**Independent Test**: Given a controlled identity context, protected-action request, and resource
relationship, the decision can be observed as allowed or denied with a reason category that does
not disclose sensitive information.

**Acceptance Scenarios**:

1. **Given** an active identity with the required functional role, applicable organizational
   membership or resource relationship, and an explicit permitted action, **When** access is
   evaluated, **Then** the action is allowed.
2. **Given** an identity that lacks any required role, membership, relationship, status, or explicit
   permission, **When** access is evaluated, **Then** the action is denied by default.
3. **Given** an unknown, malformed, inactive, unsupported, or unauthorized identity context,
   **When** access is evaluated, **Then** the request is rejected without exposing protected or
   sensitive information.
4. **Given** an active identity with more than one active functional role, **When** access is
   evaluated, **Then** only the role and context applicable to the requested action contribute to
   the decision and all other required boundaries still apply.

---

### User Story 2 - Respect Tutor and Academy Boundaries (Priority: P1)

As a tutor or academy user, I can be evaluated only within my applicable relationship or academy
membership so that a future protected resource cannot be accessed across organizational boundaries.

**Why this priority**: The MVP depends on tutors managing their associated players and academy users
acting only within their own academy, while minor players have no direct accounts.

**Independent Test**: A decision can be tested for a tutor relationship and an academy membership,
including attempts to act on an unrelated player or a different academy.

**Acceptance Scenarios**:

1. **Given** an active tutor identity associated with a protected player resource, **When** an
   applicable future action is evaluated, **Then** the decision recognizes that relationship without
   granting access to unrelated players.
2. **Given** an active academy-user identity belonging to an academy, **When** an action concerns a
   resource associated with that academy, **Then** the decision can recognize the membership.
3. **Given** an academy-user identity whose membership does not match the resource's academy,
   **When** access is evaluated, **Then** cross-academy access is denied.
4. **Given** a minor player's context, **When** a protected action is evaluated, **Then** no player
   account role is assumed and authorization relies on the applicable tutor, academy, or New Talents
   internal context.
5. **Given** an Academy User whose prior membership is inactive or historical, **When** access is
   evaluated through that membership, **Then** access is denied.

---

### User Story 3 - Control Privileged Identity Changes (Priority: P2)

As New Talents, I can control and trace changes to privileged roles and academy memberships so that
access cannot expand invisibly.

**Why this priority**: Privileged assignments and organizational membership changes directly affect
authorization decisions and require an accountable history.

**Independent Test**: A permitted privileged change and an attempted unauthorized change can be
evaluated independently, with each completed change retaining its actor, time, prior state, and
resulting state.

**Acceptance Scenarios**:

1. **Given** an active New Talents Administrator, **When** that Administrator
   assigns, changes, or revokes a privileged role or academy membership, **Then** the change is
   controlled and traceable.
2. **Given** a New Talents Analyst, Tutor, or Academy User, **When** that identity requests a
   privileged functional-role change, **Then** the change is denied and no privilege is altered.
3. **Given** a completed privileged role or membership change, **When** it is reviewed, **Then** its
   responsible actor, timestamp, prior state, resulting state, and outcome are available to New
   Talents personnel with the applicable authority.
4. **Given** an Academy User with an active academy membership, **When** a membership change becomes
   effective, **Then** the prior active membership has ended or been deactivated and remains in
   traceable history.

---

### User Story 4 - Separate Public and Protected Contexts (Priority: P2)

As an anonymous public visitor, I can access only authorized public football information while
protected actions and sensitive information remain unavailable without a valid identity context.

**Why this priority**: Public discovery must not turn anonymous access into a privileged role or
expose information outside the public authorization decision.

**Independent Test**: An anonymous request can be evaluated for a public-information context and a
protected-information context without treating the visitor as an authenticated actor.

**Acceptance Scenarios**:

1. **Given** anonymous public access to authorized public football information, **When** access is
   evaluated, **Then** it can be allowed without creating an authenticated identity role.
2. **Given** anonymous access to protected or sensitive information, **When** access is evaluated,
   **Then** it is denied.
3. **Given** public information associated with a minor, **When** public access is evaluated, **Then**
   the result remains subject to the authorization rules of the future feature that governs public
   visibility.

### Edge Cases

- An identity context is syntactically incomplete, has an unsupported role, or refers to an identity
  that no longer exists.
- An identity becomes inactive after a relationship or membership was previously recognized.
- A multi-role identity presents an active role assignment that is not applicable to the requested
  action.
- A tutor attempts to access a resource with no current relationship to that tutor.
- An academy user attempts to access a resource from another academy.
- A membership change would leave an Academy User active in two academies simultaneously.
- A New Talents Analyst, Tutor, or Academy User attempts to change a privileged functional role.
- A privileged role or membership change is requested by an unauthorized actor or cannot retain a
  complete trace record.
- Anonymous public access is used as if it were an authenticated role.
- A future protected resource lacks enough relationship information to make a safe decision.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST represent a unique system identity for every actor that may receive
  authenticated future access, including New Talents personnel, tutors, and academy users.
- **FR-002**: The system MUST distinguish New Talents Administrator, New Talents Analyst, Tutor, and
  Academy User as separate functional roles without assigning a system identity or role to a minor
  player.
- **FR-003**: The system MUST represent an anonymous public-visitor context separately from
  authenticated functional roles.
- **FR-004**: The system MUST associate a tutor identity with the tutor context required to evaluate
  future access to that tutor's related player resources.
- **FR-005**: The system MUST associate an Academy User identity with exactly one active academy
  membership context at a time and support multiple active Academy User identities associated with
  one academy.
- **FR-006**: The system MUST treat all academy users as having the same functional access level in
  the MVP, subject to applicable membership and resource relationships.
- **FR-007**: The system MUST represent separate New Talents Administrator and New Talents Analyst
  identity contexts for personnel who perform operational administration and sports analysis.
- **FR-008**: Every authorization decision MUST evaluate the role applicable to the requested action,
  identity status, active and valid role assignments, explicit permission, organizational
  membership, and resource relationship when each is required by the protected action. Permissions
  from multiple roles MUST be combined only when all of those applicable conditions are satisfied.
- **FR-009**: Authorization MUST deny access by default unless the complete required context proves
  that the requested action is permitted.
- **FR-010**: The backend MUST enforce authorization decisions independently of frontend visibility
  or navigation.
- **FR-011**: The system MUST reject unknown, inactive, malformed, unsupported, and unauthorized
  identity contexts before they can receive protected information or perform protected actions.
- **FR-012**: The system MUST prevent an academy-user identity from receiving access through a
  different academy's membership or resources, deny access through inactive or historical academy
  memberships, and prevent one Academy User from holding simultaneous active memberships in multiple
  academies.
- **FR-013**: The system MUST prevent a tutor identity from receiving access to an unrelated player
  resource.
- **FR-014**: The system MUST not infer a player account role for a minor player in the MVP.
- **FR-015**: Anonymous public access MUST not create an authenticated role, permission, or access to
  protected information.
- **FR-016**: Public and protected information MUST remain distinguishable for authorization
  purposes, and sensitive personal information MUST remain outside anonymous public access.
- **FR-017**: Only an active New Talents Administrator MAY assign, modify, or revoke privileged
  functional roles; a New Talents Analyst, Tutor, or Academy User MUST NOT administer New Talents
  internal roles.
- **FR-018**: An active New Talents Administrator MUST control assignment, modification, and
  revocation of Academy User memberships before a change can take effect.
- **FR-019**: Every completed privileged-role or academy-membership change MUST retain traceability
  of the responsible actor, timestamp, prior state, resulting state, and outcome.
- **FR-020**: An unauthorized or untraceable privileged-role or membership change MUST not alter the
  effective authorization context.
- **FR-021**: The authorization foundation MUST provide future protected resources with role,
  membership, relationship, identity-status, and permission information without coupling this
  feature to a passport, academy-management, match, statistics, video, FEM, payment, or
  notification workflow.
- **FR-022**: Authorization failures MUST provide a safe outcome that does not disclose sensitive
  personal information, protected resource details, or avoidable internal authorization details.
- **FR-023**: The feature MUST remain independent from login, credential verification, session
  management, and any technical authentication mechanism.
- **FR-024**: The approved role-governance decisions MUST be enforced consistently: separate
  internal roles, multi-role boundary checks, Administrator-only privileged-role control, and one
  active academy membership per Academy User MUST govern all dependent role, membership, and
  authorization behavior.

### Key Entities *(include if feature involves data)*

- **System identity**: A unique identity context that may receive future authenticated access and
  has an authorization-relevant status.
- **Functional role**: A business responsibility that defines general permitted capabilities: New
  Talents Administrator, New Talents Analyst, Tutor, or Academy User.
- **Tutor context**: The association that allows a tutor identity to be evaluated against related
  player resources in later features.
- **Academy membership context**: The association between an Academy User identity and exactly one
  active academy, with prior memberships retained as inactive traceable history.
- **New Talents internal context**: The association that identifies personnel performing internal
  administration or sports analysis.
- **Authorization decision**: The outcome of evaluating identity status, functional role, explicit
  permission, organizational membership, and resource relationship for an action.
- **Privilege or membership change record**: The traceable business record of an active New Talents
  Administrator's controlled change to a privileged role or Academy User membership.

### Scope Boundaries

This feature includes only identity concepts, functional roles, tutor and academy contexts, internal
New Talents contexts, authorization decision rules, denial by default, controlled and traceable
privilege or membership changes, and identity-related security and minor protection.

This feature excludes login; password handling and recovery; JWT; access and refresh tokens;
sessions; logout;
authentication endpoints and screens; technical authorization mechanisms; database schemas,
migrations, and persistence details; player or passport creation; academy player management;
matches; statistics and evaluations; videos; FEM; payments; notifications; public player search or
passport presentation; detailed frontend screens; tournament management; deployment; and CI/CD.
It also excludes the authority and workflow for academy-player transfers and the initial technical
bootstrap mechanism for the first New Talents Administrator.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of documented authorization cases with a complete permitted context, the
  decision returns the permitted outcome; in all incomplete or non-permitted cases, it denies by
  default. In all documented multi-role cases, only active and valid role assignments applicable to
  the requested action contribute to a permitted decision, while all membership, relationship, and
  sensitive-information boundaries remain enforced.
- **SC-002**: In 100% of documented unknown, inactive, malformed, unsupported, and unauthorized
  identity cases, protected access is rejected without disclosing sensitive personal or protected
  resource information.
- **SC-003**: In 100% of documented cross-academy and unrelated-tutor cases, the requested protected
  action is denied. In 100% of documented inactive or historical academy-membership cases, access
  through that membership is denied, and no Academy User has simultaneous active access to two
  academies.
- **SC-004**: In 100% of documented privileged-role and academy-membership changes, an active New
  Talents Administrator performs the authorized change and retains all required trace information,
  or the change is denied without changing the effective authorization context.
- **SC-005**: All documented academy-user scenarios apply one common MVP access level while still
  enforcing academy membership and resource relationship boundaries.
- **SC-006**: All documented anonymous-public scenarios remain separate from authenticated roles and
  deny access to protected or sensitive information.
- **SC-007**: Scope review finds zero login, credential, token, session, database-schema, future
  product-workflow, deployment, or CI/CD behavior in this feature.

## Assumptions

- A later bounded feature will establish the login and session mechanism that supplies an identity
  context; this feature defines neither mechanism nor credentials.
- Later resource-owning features will define their own protected actions and provide the relationship
  facts needed for authorization decisions while reusing this foundation's boundaries.
- Public visibility of an individual minor's football information remains governed by the future
  public-visibility feature and its approved authorization rules.
- The first New Talents Administrator's initial technical bootstrap is deferred to planning; it must
  not weaken the Administrator-only rule for ordinary privileged-role changes.
- Future academy-player transfers remain owned by their future bounded feature and do not alter the
  one-active-academy rule for an Academy User identity.
- The completed runtime foundation remains the only technical baseline; this specification does not
  make architectural choices immutable.

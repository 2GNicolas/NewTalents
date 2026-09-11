# Internal Authorization Evaluation Contract

## Request

The versioned internal request contains anonymous or opaque identity context, identity status,
active role assignments, requested action and permission, applicable academy membership facts, and
minimal caller-supplied resource relationship facts. It contains no headers, cookies, credentials,
tokens, sessions, database records, or raw errors.

## Decision

The decision contains only allow/deny, controlled reason category, and policy version. Allow requires
an active identity, active applicable role, catalog permission, and every required membership,
relationship, and sensitivity condition. Otherwise it denies by default.

Safe categories include invalid context, anonymous protected action, inactive identity, no active
role, absent permission, inactive academy membership, missing tutor relationship, insufficient
resource facts, sensitive-data restriction, privileged-change denial, and audit unavailable.

## Privileged operations

Assign/revoke privileged role and assign/change/revoke academy membership require an active
Administrator context. They are transactional and retain actor, time, prior/resulting state,
operation, outcome, safe category, and policy version.

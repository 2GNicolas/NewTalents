# Administrator Initialization and Recovery Operational Contract

## Purpose

This contract defines the non-public controlled operator boundary for the two Administrator-only
bootstrap modes. It is not an HTTP contract and does not authorize ordinary users, frontend clients,
or application routes.

## Modes

| Mode | Entry condition | State established | Mandatory refusal |
|---|---|---|---|
| First-ever initialization | No Administrator assignment has ever existed. | Minimum explicit identity, protected credential, active Administrator assignment, immutable redacted security event. | Any prior Administrator assignment, missing confirmation, unsafe input, or failed atomic operation. |
| Emergency recovery | No active and eligible Administrator exists. | Explicitly identified recovery identity, protected credential, active Administrator assignment, immutable redacted recovery event. | Any active eligible Administrator, missing confirmation, unsafe input, or failed atomic operation. |

## Operator interaction

- The operator supplies explicit identity values and enters the sensitive credential interactively
  without echoing it or placing it in a command-line argument.
- The operator must select the mode explicitly and provide an explicit confirmation after the mode,
  target identity, and safety condition are displayed without secrets.
- The operation prints only a success/failure category and non-sensitive identifier. It never prints
  plaintext credentials, password hashes, access or refresh credentials, database URLs, or stack
  traces.
- No reusable application session is issued by either mode.

## Repository invocation

From the repository root, the controlled commands are:

```powershell
npm run admin:initialize
npm run admin:recover
```

The mode is the only command argument. The command uses the workspace's compiled Nest/Node runtime,
creates an application context only (never an HTTP listener), requires a TTY, and asks for the
email, hidden password, and literal `CONFIRM` interactively. It exits `0` on success, `2` for a
safe refusal or cancellation, and `1` for an operational failure. Passwords are never accepted as
arguments or emitted to terminal output.

## Required outcomes

- Each mode runs as one Serializable atomic operation with the Feature 002 bounded retry policy:
  three total attempts, 50 ms then 100 ms waits, no jitter, and retry only for `P2034`.
- First initialization rejects a repeat after any historical Administrator assignment.
- Recovery preserves all historical identities, role assignments, sessions, memberships, and audit
  records. It does not implicitly reactivate an old Administrator.
- Recovery revokes incompatible authentication state required for safety, establishes the supplied
  recovery state, and becomes unavailable once an active eligible Administrator exists.
- Both modes record immutable redacted evidence. Failed commands leave no partial identity,
  credential, role assignment, session, or audit state.
- Exact command name, invocation, confirmation syntax, and deployment access mechanism are
  implementation details; they must be documented with the implementation without exposing secrets.

## Verification boundary

Automated integration tests use controlled fixtures and do not accept real operator secrets. They
prove entry conditions, duplicate refusal, recovery refusal while an eligible Administrator is
active, rollback, audit redaction, immutable history, and concurrent execution safety.

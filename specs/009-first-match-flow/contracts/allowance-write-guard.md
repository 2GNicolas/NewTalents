# Additive Feature 008 allowance-confirmation guard

The existing `PUT /admin/passports/{passportId}/match-allowance` request, version/idempotency behavior, effective-date rule and history contract remain in force. Feature 009 adds a capacity guard when booked first matches exist; it does not change how Feature 008 computes anniversaries, Colombia dates or the next effective boundary.

## Confirmation algorithm at the contract boundary

Within Feature 008's existing serializable transaction and `PlayerPassport` row lock, recheck Administrator authority, passport eligibility, version and idempotency. Determine the proposed revision's `effectiveOn` exactly as Feature 008 does, including superseding a pending revision only with a fresh version/confirmation. For each unchanged match date with a `RESERVED` or `USED` unit in an affected period at or after that effective boundary, resolve the proposed revision sequence and group by its `[periodStart, periodEndExclusive)` bucket. Count both states once per match. Reject the whole proposed change if any group exceeds that period's proposed limit. Retain existing match dates, states, unit identities and past periods; do not auto-cancel, release, or reschedule anything.

Because the set of booked dates is finite, this check does not enumerate infinitely recurring future periods. A period with no booked dates cannot exceed a positive limit. The same passport lock serializes booking/rescheduling/load with this check; therefore a newly reserved unit cannot appear between evaluation and confirmed revision. A rejected revision does not increment the allowance version or append history.

## Safe result

On capacity rejection, return a recoverable `409` allowance conflict to the authorized Administrator, with the current allowance projection (as already allowed for version conflicts) and a safe message that existing booked units exceed the proposal. Do not disclose responsible identity, Analyst information or another passport's matches. The client refreshes before proposing a new intention. Identical idempotent replay of a previously accepted revision remains successful without reapplying or rechecking a changed historical state.

The Feature 008 `GET` response remains configuration-only. Feature 009's authorized match-date preview supplies calculated `reserved`, `used` and `available` for the first-match form; it does not turn the Feature 008 configuration UI into a match manager.

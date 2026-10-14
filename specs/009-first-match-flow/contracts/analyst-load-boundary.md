# Internal boundary: confirmed data load of the first match

This is an internal integration contract for future Analyst work, not a public endpoint or an implementation of data entry. Feature 009 owns the waiting/accounting transition; the future Analyst feature owns capture and validation of sporting data.

## Trusted input

`confirmFirstMatchDataLoad(transaction, { matchId, passportId, analystIdentityId, loadId, expectedVersion, confirmedAt }, verifyConfirmedData)` is invoked by the future data owner inside its own serializable database transaction. `verifyConfirmedData` reads that owner's durable confirmation for exactly `matchId` and `loadId` through the same transaction and returns their matching identifiers; a boolean or raw client claim is insufficient. `expectedVersion` is the waiting match version observed by the owner, and `loadId` is a stable opaque identifier for idempotency, not a filename or user-provided claim. A raw client upload/attempt is insufficient.

## Preconditions at execution

- FirstMatch belongs to `passportId`, is `WAITING`, and owns one `RESERVED` unit.
- Analyst identity is active, retains active `ANALYST` role and operational profile, and is the passport's current valid custody holder under Feature 007. Recheck immediately at the transition; a prior list response or JWT role label is insufficient.
- The durable data confirmation identifies exactly this `matchId`. Other-match, failed, partial, stale or unauthenticated signals do not end waiting.

## Atomic outcome

At the same confirmed persistence boundary, use the shared passport lock and a single transactional result to set the first match to `LOADED`, convert its existing unit to `USED` in the unchanged match-date period, store `loadId`/actor/time, and record the audit transition. Do not create a second unit, release availability, mutate Feature 008 revision history, or trigger Administrator approval. Replaying the same `loadId` returns the existing result; a different or conflicting signal after completion is a safe conflict without mutation.

The future data owner must invoke this operation in the same database transaction as its durable confirmation; the port throws a typed internal error on failed proof, stale version, foreign match or authorization denial so that the transaction aborts both writes. Feature 009 defines this required integration port but does not implement its future producer or sporting payload. A different persistence architecture would require a later explicit contract amendment before claiming a successful load.

## Race ordering

The same passport lock serializes load with reschedule/cancel and allowance updates. If load commits first, pre-load actions fail without releasing/moving the used unit. If cancellation commits first, load cannot complete for the canceled match. If reschedule commits first, a subsequently valid load consumes the same unit in the new match-date period. Custody revocation before the check denies load; revocation after a committed load does not undo historical `USED` accounting.

## Safe visibility

The responsible-facing state may say that waiting ended and show permitted match details only. It must not expose Analyst identity, internal events, raw sporting data, evidence, or provisional analysis. Analyst visibility remains governed by current custody, not by the existence of a booking.

# Backend verification — Feature 006

Date: 2026-09-28

Only synthetic test data was used. The shared PostgreSQL database was not reset or globally cleared.

## Results

| Check | Result |
|---|---|
| `npm run test:unit --workspace=@new-talents/backend` | PASS — 71 files, 404 tests |
| `npm run test:contract --workspace=@new-talents/backend` | PASS — 14 files, 44 tests |
| `npm run test:integration --workspace=@new-talents/backend` (first consecutive run) | PASS — 34 files, 71 tests |
| `npm run test:integration --workspace=@new-talents/backend` (second consecutive run, same database) | PASS — 34 files, 71 tests |
| `npm run test:persistence --workspace=@new-talents/backend` | PASS — 1 file, 1 test |
| `npm run typecheck --workspace=@new-talents/backend` | PASS |
| `npm run build --workspace=@new-talents/backend` | PASS, including Prisma generation |

## Shared PostgreSQL contamination investigation

The earlier broad-suite failure was test isolation, not a product defect or missing fixture cleanup. Two legacy authentication integration tests assumed that the entire shared database had no Administrator assignment history. Other legitimate suites and retained development fixtures make that global assumption false.

The tests now establish their Administrator baseline, create and remove only their own fixtures, and verify predicates relative to that baseline. Bootstrap/recovery coverage also exercises the correct refusal path when the shared database already has an active or historical Administrator. Two consecutive full integration runs passed without global database deletion, demonstrating stable shared-state behavior rather than an isolated green run.

The contract alignment check also found and corrected four implicit HTTP 201 responses (`submit`, `resubmit`, `correction`, and `reject`) to the documented HTTP 200 responses. Existing checkpoint expectations were updated to the approved contract.

## Non-blocking observation

Some existing PostgreSQL-backed suites emit the `pg` deprecation warning about calling `client.query()` while a query is already executing. It did not affect results in either consecutive run.

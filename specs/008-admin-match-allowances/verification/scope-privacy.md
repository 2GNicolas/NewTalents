# Feature 008 — scope, privacy and compatibility (2026-10-09)

- Focused backend authorization/contract/Feature 005–007 passport and custody suites: 17 files, 74 tests passed. Focused frontend suites including route policy and custody detail: 10 files, 57 tests passed.
- An authenticated local probe read the all-passport page, detail, allowance and history: four `200` responses with `Cache-Control: no-store`; a guessed direct passport ID returned safe `404` and `no-store`.
- The probe rejected private identity, credential, evidence, invented usage and scheduling field names in response bodies. Feature 008 sources have no new photo, usage counter, match list, scheduling, Analyst, FEM, payment or subscription surface.
- Live authorization is re-evaluated in backend services/transactions. Browser review revealed that the session projection and route policy omitted the new capabilities; failing tests were added first, then both were corrected. Custodia remained reachable from the mobile Administrator menu.
- Isolated PostgreSQL tests preserved passport state/version and unchanged custody/approval row counts during allowance creation. The local migration applied additively; no allowance was backfilled or written to existing passports during browser verification.
- A synthetic local Administrator account was created for browser verification and then disabled with its role revoked and identity inactive. Immutable authentication security events prevent safe physical deletion, so its audit remains. No existing identity, passport or custody data was modified for that cleanup.

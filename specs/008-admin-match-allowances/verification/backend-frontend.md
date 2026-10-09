# Feature 008 — focused completion evidence (2026-10-09)

- `node test/integration/run-feature-008-schema.mjs` from `apps/backend`: passed, four suites **sequentially**, 11 tests. Disposable PostgreSQL database was created, migrated and removed; migration/Prisma shape agreed. Covered one allowance/passport, approval/custody non-creation, active-only first confirmation, exact Colombia date, invalid rollback, two-client stale-version race, replay/changed-intention, precommit rollback, audit pagination and all four period cadences with month-end/leap anchors.
- `npm exec -- vitest run ...` focused Feature 008, authorization, Feature 005 passport and Feature 007 custody specs: **17 files / 74 tests passed**.
- `npm run test:unit -- --runTestsByPath ...` focused Administrator, route-policy and custody specs: **10 suites / 57 tests passed**.
- `npm run typecheck` in each of `apps/backend` and `apps/frontend`: passed. `npm run build` in backend and `npm run export:web` in frontend: passed.
- OpenAPI YAML parsed as version 3.1.0 with four Feature 008 paths; the focused OpenAPI contract suite passed. Authenticated API probe: four safe `no-store` reads and indistinguishable missing-ID `404`.
- Local PostgreSQL `prisma migrate status` showed only Feature 008 pending; `prisma migrate deploy` applied that additive migration to `new_talents_local` for browser review, leaving existing records intact.
- `git diff --check`: passed after final edits.

Quickstart coverage: preparation and migration (step 1); authorized all-passport cards and direct-ID denial (2); first-creation/validation/cancel (3, integration plus browser cancel); four cadence and 29–31/leap matrix (4); next-boundary update/history/current-versus-pending (5, integration/unit); two-Administrator conflict, replay, rollback (6, integration); authenticated desktop/mobile layout, keyboard/mobile Pressable interaction, scrolling, privacy and no fabricated content (7, browser and component suites). Existing passports were deliberately not mutated during browser acceptance. Manual product acceptance may repeat create/update on a disposable passport and exercise physical-device touch/reduced-motion settings.

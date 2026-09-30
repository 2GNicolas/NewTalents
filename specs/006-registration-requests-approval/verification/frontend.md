# Frontend verification — Feature 006

Date: 2026-09-28

## Results

| Check | Result |
|---|---|
| `npm run test:frontend` | PASS — 61 suites; 287 passed, 2 environment-dependent native launches skipped |
| `npm run typecheck` | PASS — backend and frontend workspaces |
| `npm test` | PASS — backend 71 files/404 tests; frontend 61 suites/287 passed/2 skipped |
| `npm run export:web --workspace=@new-talents/frontend` | PASS — 64 static routes exported |
| `npx expo-doctor` | PASS — 21/21 checks after aligning Expo SDK 57 patch versions |
| `npx jest --runInBand tests/smoke/native-targets.spec.ts --verbose` | PASS — Android/iOS targets declared; 1 passed, 2 host-dependent launches skipped |

## Defects corrected during verification

- Three inherited tests still expected the superseded public activation/runtime entry or mocked an older Expo Router surface. They now assert the approved registration entry and current restoration behavior; no approved UI was changed.
- Expo Doctor found five SDK 57 patch mismatches. `expo`, `expo-router`, `expo-constants`, `expo-linking`, and `@expo/metro-runtime` were aligned to the versions required by the installed SDK and all affected checks were rerun.

## Native validation availability

- Android emulator/device launch: unsupported on this host because no Android SDK/device is attached. Static target declaration and shared native-width component tests passed.
- iOS Simulator launch: unsupported on Windows. Static target declaration and shared React Native component tests passed.

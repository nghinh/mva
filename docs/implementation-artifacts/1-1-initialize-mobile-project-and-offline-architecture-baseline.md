# Story 1.1: Initialize mobile project and offline architecture baseline

Status: ready-for-dev

## Story

As a developer,
I want the React Native project initialized with New Architecture and offline-only foundations,
so that all later features build on a consistent technical baseline with zero server dependencies.

## Acceptance Criteria

1. **Given** the repository contains planning artifacts and architecture guidance
   **When** the developer initializes the project
   **Then** a React Native CLI app with New Architecture (TurboModules enabled) is created following the approved directory structure — with no server/backend skeleton, no WebSocket setup, and no infrastructure folder.
2. **Given** the project skeleton is created
   **When** baseline engineering setup is reviewed
   **Then** lint, test, TypeScript configuration files are present and all pass.
3. **Given** the architecture mandates 100% offline operation
   **When** any dependency is added
   **Then** no dependency requires network access at runtime (excluding one-time model download).

## Tasks / Subtasks

- [ ] Create the `mobile/` React Native CLI project with New Architecture enabled (AC: 1)
  - [ ] Enable TurboModules and Fabric in `gradle.properties` / Podfile.
  - [ ] Ensure TypeScript-first baseline: `tsconfig.json`, `babel.config.js`, `metro.config.js`, `jest.config.js`.
  - [ ] Preserve `ios/` and `android/` native folders for TurboModule integration (NllbTranslatorModule).
- [ ] Establish repository structure for offline-only architecture (AC: 1, 3)
  - [ ] Create top-level folders: `mobile/`, `models/`, `scripts/`, `docs/`.
  - [ ] Under `mobile/src/`: `screens/`, `components/`, `hooks/`, `services/`, `native/`, `store/`, `db/`.
  - [ ] NO `server/`, `infra/`, `docker/` folders — architecture has no backend.
- [ ] Add baseline quality and configuration setup (AC: 2)
  - [ ] Add lint/test scripts for mobile.
  - [ ] Add environment config for model storage paths, not server URLs.
  - [ ] Ensure zero secrets, zero API keys — app requires no authentication.
- [ ] Verify the initialized baseline is developer-ready (AC: 1, 2, 3)
  - [ ] Confirm app boots with placeholder Home screen.
  - [ ] Confirm no network calls are made during app lifecycle.

## Dev Notes

- Architecture is 100% offline. There is NO backend, NO WebSocket, NO FastAPI, NO Redis, NO Docker. The entire app runs on-device. [Source: {ARCH_REF}#ADR-001]
- React Native CLI (not Expo) is required for full native access to TurboModules, ONNX Runtime, and platform audio APIs. [Source: {ARCH_REF}#Component Architecture]
- The project structure must anticipate two native modules: `react-native-sherpa-onnx` (existing package) for STT, and `NllbTranslatorModule` (custom TurboModule) for translation. [Source: {ARCH_REF}#Component Architecture]
- Zustand for state management. SQLite for local persistence. No Redux, no AsyncStorage for structured data. [Source: {PRD_REF}#Technical Constraints]

## Dev Agent Record

### Agent Model Used
TBD

### Completion Notes List
- TBD

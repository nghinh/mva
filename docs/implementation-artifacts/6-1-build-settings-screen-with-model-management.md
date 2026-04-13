# Story 6.1: Build settings screen with model management

Status: ready-for-dev

## Story

As a user,
I want a settings screen where I can manage AI models and preferences,
so that I have control over storage and app behavior.

## Acceptance Criteria

1. **Given** the Settings screen is open
   **When** viewing the AI Models section
   **Then** each model (SenseVoice STT, NLLB Translation) shows: name, size, and readiness status (✅ Ready / ⬇️ Download / ❌ Missing).
2. **Given** model management
   **When** the user taps a model
   **Then** they can see details and optionally delete the model to free storage.
3. **Given** settings
   **When** the user changes target language
   **Then** the preference is saved and subsequent translations use the new target.

## Tasks / Subtasks

- [ ] Build SettingsScreen layout (AC: 1, 2, 3)
  - [ ] Section: AI Models — model cards with status.
  - [ ] Section: Translation — target language selector (default Vietnamese).
  - [ ] Section: Storage — model sizes + session data size + "Delete All Sessions" button.
  - [ ] Section: Developer Mode — toggle for metrics overlay.
  - [ ] Section: About — version, "100% Offline" badge.
- [ ] Implement model status logic (AC: 1)
  - [ ] Check file existence in model directories.
  - [ ] Show green "Ready" if all files present, red "Missing" if any absent.
- [ ] Persist settings to Zustand + SQLite (AC: 3)
  - [ ] Save to `settings` table: key-value pairs.
  - [ ] Load on app launch.

## Dev Notes

- NO server URL setting. NO AI suggest mode setting. NO connection settings. Everything is local. [Source: {ARCH_REF}#ADR-001]
- Settings should feel like a professional tool configuration, not consumer app settings. [Source: {UX_REF}#Settings Screen]

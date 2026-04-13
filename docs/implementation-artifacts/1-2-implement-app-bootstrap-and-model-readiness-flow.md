# Story 1.2: Implement app bootstrap and model readiness flow

Status: ready-for-dev

## Story

As a user,
I want the app to check model readiness on launch and guide me through downloading if needed,
so that I can start using the app as quickly as possible.

## Acceptance Criteria

1. **Given** first launch with no models downloaded
   **When** app opens
   **Then** the model download screen is shown with STT model (234MB) and Translation model (800MB) listed with download buttons.
2. **Given** models are already cached locally
   **When** app opens
   **Then** app proceeds directly to splash/warm-up and then to Home screen within 8 seconds.
3. **Given** model download is in progress
   **When** user kills and reopens the app
   **Then** download resumes from where it stopped (resume-from-offset).

## Tasks / Subtasks

- [ ] Implement model existence check on app launch (AC: 1, 2)
  - [ ] Check for STT model files in `models/sensevoice-small-int8/` directory.
  - [ ] Check for Translation model files in `models/nllb-600m-int8/` (encoder, decoder, decoder_with_past, sentencepiece.bpe.model).
  - [ ] Route to ModelDownloadScreen if any model is missing, else proceed to warm-up.
- [ ] Build ModelDownloadScreen UI (AC: 1, 3)
  - [ ] Show app icon, name, tagline.
  - [ ] Per-model card: name, size, progress bar, percentage.
  - [ ] Sequential download: STT first, then Translation.
  - [ ] Error state: retry button per model.
  - [ ] Support resume-from-offset via HTTP Range headers.
- [ ] Implement model file integrity verification (AC: 2)
  - [ ] Verify SHA-256 checksum after download completes.
  - [ ] If corrupt, delete and re-download.
- [ ] Navigate to microphone permission request after download (AC: 1)
  - [ ] Request mic permission after models ready.
  - [ ] If denied, show explanation + "Open Settings" button.

## Dev Notes

- Models are hosted on internal server or HuggingFace for one-time download. After download, app never needs network again. [Source: {PRD_REF}#FR-050]
- Store models in app's internal storage for security, not external/SD card. [Source: {ARCH_REF}#Resource Budget]
- Total download: ~1GB compressed. WiFi recommended. [Source: {ARCH_REF}#Resource Budget]

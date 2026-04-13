# Meeting Voice Assistant — Story Catalog

**Architecture:** v3.0 (100% Offline, On-Device Only)
**Generated:** 2026-04-13

## Architecture Summary

Everything runs on the user's phone. No server, no network, no cloud APIs.
- **STT:** react-native-sherpa-onnx + SenseVoice-Small int8 (on-device)
- **Translation:** NLLB-200-distilled-600M int8 ONNX via custom TurboModule (on-device)
- **AI Suggest:** Removed from scope
- **UI:** 2-lane layout (Transcript + Translation)

## Epic Map

| Epic | Stories | Points | Focus |
|------|---------|--------|-------|
| Epic 1: Foundation & Model Management | 1-1 to 1-5 | 19 | Project init, model download/cache/warm-up, security baseline |
| Epic 2: On-Device STT | 2-1 to 2-5 | 16 | Audio capture, VAD, streaming STT, language detection |
| Epic 3: On-Device Translation | 3-1 to 3-6 | 34 | NLLB TurboModule, greedy decoding, KV cache, draft translations |
| Epic 4: Meeting UI | 4-1 to 4-6 | 18 | 2-lane layout, recording indicator, auto-scroll, accessibility |
| Epic 5: Session Persistence | 5-1 to 5-5 | 16 | SQLite storage, session list, review, export, deletion |
| Epic 6: Settings & Polish | 6-1 to 6-4 | 12 | Model management UI, encryption, dev mode, theming |
| **Total** | **31 stories** | **~115 pts** | |

## Changes from Previous Architecture (v2.1)

| Removed | Reason |
|---------|--------|
| All server/backend stories | No server in offline architecture |
| Epic 4 (AI Suggest) — 5 stories | Feature removed from scope |
| Story 2-6 (offline transcript continuity) | App is ALWAYS offline — no degraded mode needed |
| WebSocket protocol, reconnection logic | No network communication |
| Server URL settings, connection status | No server to connect to |
| Docker, Nginx, Redis, vLLM, CTranslate2 | No infrastructure |
| 3rd lane (AI Suggest) in Meeting UI | 2-lane layout only |

| Added | Reason |
|-------|--------|
| Epic 3: On-Device Translation (6 stories) | NLLB-600M runs on phone via ONNX Runtime |
| Story 3-1: NllbTranslator TurboModule (13pts) | New native module for both Android + iOS |
| Story 3-6: Model preparation script | Convert NLLB to mobile-optimized ONNX |
| NLLB model download in Epic 1 | Additional 800MB model to manage |
| Draft → final translation UI flow | On-device partial translation with visual indicator |

## Sprint Plan (7 weeks)

| Sprint | Stories | Goal |
|--------|---------|------|
| Week 1 | 1-1, 1-2, 1-3, 1-4, 1-5 | Foundation: project init + models download + warm-up |
| Week 2 | 2-1, 2-2, 2-3, 2-4, 2-5 | STT: audio → VAD → streaming transcription works |
| Week 3 | 3-1, 3-2, 3-6 | Translation core: NLLB TurboModule + greedy + KV cache (Android) |
| Week 4 | 3-1 (iOS), 3-3, 3-4, 3-5 | Translation complete: both platforms, final + partial, cancellation |
| Week 5 | 4-1, 4-2, 4-3, 4-4, 4-5 | Meeting UI: 2-lane, recording, scroll, stop flow, waiting state |
| Week 6 | 4-6, 5-1, 5-2, 5-3, 5-4, 5-5 | Persistence: SQLite + session list + review + export |
| Week 7 | 6-1, 6-2, 6-3, 6-4 | Polish: settings, encryption, dev mode, dark/light theme |

## Critical Path

```
1-1 → 1-2 → 1-3 → 1-4 → 3-1 (NLLB TurboModule) → 3-2 → 3-3 → 4-1 → 5-1
```

**Story 3-1 (NllbTranslator TurboModule)** is the highest-risk item at 13 story points — it requires native Kotlin + Swift + ONNX Runtime + SentencePiece implementation on both platforms.

## File List

```
stories/
├── 1-1-initialize-mobile-project-and-offline-architecture-baseline.md
├── 1-2-implement-app-bootstrap-and-model-readiness-flow.md
├── 1-3-add-nllb-translation-model-to-download-and-cache-lifecycle.md
├── 1-4-pre-warm-stt-and-translation-models-before-first-use.md
├── 1-5-establish-offline-only-configuration-and-security-baseline.md
├── 2-1-start-and-stop-meeting-capture-from-the-meeting-screen.md
├── 2-2-capture-microphone-audio-continuously-in-the-native-layer.md
├── 2-3-process-audio-chunks-through-vad-and-filter-silence.md
├── 2-4-emit-streaming-partial-transcript-during-active-speech.md
├── 2-5-emit-final-transcript-and-detected-language-at-utterance-end.md
├── 3-1-build-nllb-translator-turbomodule-for-android-and-ios.md
├── 3-2-implement-greedy-decoding-with-kv-cache-for-fast-inference.md
├── 3-3-translate-final-stt-results-to-vietnamese-on-device.md
├── 3-4-translate-partial-stt-results-as-draft-translations.md
├── 3-5-implement-translation-cancellation-and-concurrency-control.md
├── 3-6-prepare-nllb-onnx-models-for-mobile-deployment.md
├── 4-1-build-meeting-screen-with-two-lane-layout.md
├── 4-2-implement-recording-indicator-and-session-timer.md
├── 4-3-implement-auto-scroll-and-jump-to-latest.md
├── 4-4-implement-stop-meeting-and-session-save-flow.md
├── 4-5-build-waiting-state-before-speech-detected.md
├── 4-6-deliver-accessibility-and-dark-mode-for-meeting-screen.md
├── 5-1-persist-meeting-data-to-sqlite-during-live-sessions.md
├── 5-2-build-session-history-list-on-home-screen.md
├── 5-3-build-session-review-detail-screen.md
├── 5-4-export-meeting-transcript-as-text-file.md
├── 5-5-implement-session-deletion-and-data-cleanup.md
├── 6-1-build-settings-screen-with-model-management.md
├── 6-2-implement-local-storage-encryption-and-privacy-safeguards.md
├── 6-3-implement-developer-mode-metrics-overlay.md
├── 6-4-implement-light-and-dark-mode-theming.md
└── index.md
```

# Architecture Decision Document — Meeting Voice Assistant

**Author:** nghinh
**Date:** 2026-08-17
**Version:** 5.0 (Reconciled with implementation)
**Status:** Approved — describes the system as built at commit `9a6ecf1`
**Change from v4.0:** STT split into SenseVoice + Zipformer-VI, Android translation moved to ML Kit, Silero VAD replaced by an energy detector, SQLite replaced by encrypted key-value storage, background capture and TTS added.

---

## 1. Architecture Overview

### 1.1 Design Philosophy

**The meeting pipeline runs entirely on the device.** There is no backend, no API, and no telemetry. Audio is processed in memory and discarded; transcripts and translations are stored encrypted in the app's private sandbox.

The one exception is *setup*: translation language packs (Apple on iOS, ML Kit on Android) and, optionally, an Android TTS voice pack are downloaded once. After that the app works in airplane mode. This is a deliberate trade — see ADR-003.

### 1.2 High-Level Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                     Mobile Device (React Native 0.85)              │
├────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                          JS / TS Layer                        │  │
│  │  ┌────────────┐ ┌──────────────────┐ ┌────────────────────┐  │  │
│  │  │ Zustand    │ │ useMeetingSession│ │ UI (2 lanes)       │  │  │
│  │  │ stores     │ │ orchestrator     │ │ + badges + recap   │  │  │
│  │  └────────────┘ └──────────────────┘ └────────────────────┘  │  │
│  │  ┌──────────────────────────────────────────────────────┐    │  │
│  │  │ SpeakerClusterService · SessionDiarizationWindow      │    │  │
│  │  │ meetingRecapService · meetingMinutesExporter          │    │  │
│  │  │ TranslationService · LiveMeetingTranslator            │    │  │
│  │  └──────────────────────────────────────────────────────┘    │  │
│  └──────┬────────────────┬──────────────────┬──────────────────┘  │
│         │ native module   │ native module    │ native module      │
│  ┌──────▼───────────┐ ┌──▼───────────────┐ ┌▼─────────────────┐   │
│  │ react-native-    │ │ Translation      │ │ Speaker          │   │
│  │ sherpa-onnx      │ │ (platform split) │ │ Embedding        │   │
│  │ ┌──────────────┐ │ │                  │ │ ┌──────────────┐ │   │
│  │ │ PCM live     │ │ │ iOS:             │ │ │ CAM++ 192-d  │ │   │
│  │ │ stream 16kHz │ │ │  Apple           │ │ │ per utterance│ │   │
│  │ ├──────────────┤ │ │  Translation     │ │ └──────────────┘ │   │
│  │ │ SenseVoice   │ │ │                  │ │ + Offline        │   │
│  │ │ int8 (EN/JA/ │ │ │ Android:         │ │   diarization    │   │
│  │ │ KO/ZH)       │ │ │  ML Kit          │ │   module         │   │
│  │ ├──────────────┤ │ │  Translate       │ │                  │   │
│  │ │ Zipformer-VI │ │ │  17.0.3          │ │                  │   │
│  │ │ int8 (VI)    │ │ │                  │ │                  │   │
│  │ └──────────────┘ │ └──────────────────┘ └──────────────────┘   │
│  └──────────────────┘                                              │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐   │
│  │ TTS Speaker      │ │ Background       │ │ SecureStorage    │   │
│  │ (AVSpeech / TTS) │ │ Recording (svc)  │ │ Keychain/Keystore│   │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Local Storage — AES-GCM encrypted, app-private sandbox        │  │
│  │ Android: AsyncStorage · iOS: JSON under Documents/            │  │
│  │ sessions · utterances · translations · session config         │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Bundled models — copied from the app bundle to Documents/     │  │
│  │ on first launch, excluded from iCloud backup                  │  │
│  │  sherpa-onnx-sense-voice-…-int8-2024-07-17   (~234MB)         │  │
│  │  sherpa-onnx-zipformer-vi-int8-2025-04-20     (~74MB)         │  │
│  │  speaker-diarization/                          (~35MB)        │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘

Meeting-time network: NONE          Setup-time network: language packs only
Server: NONE                        Telemetry: NONE
```

### 1.3 Data Flow — Single Utterance

```
MIC → PCM 16kHz (sherpa-onnx live stream)
        │
        ├─ raw RMS ──→ energy detector (hysteresis + adaptive noise floor)
        │                 │ speech_start (with 400ms pre-roll)
        │                 │ speech_end   (silence 900ms iOS / 1400ms Android)
        │
        └─ gain-adjusted samples ──→ rolling buffer
                                        │
              partial every 500/900ms ──┤
                                        ▼
                          SenseVoice (auto) or Zipformer-VI (vi)
                                        │
                          text + language + revision
                    ┌───────────────────┼───────────────────┐
                    ▼                   ▼                   ▼
             meetingStore        TranslationService   CAM++ embedding
             (Zustand)           (Apple / ML Kit)     (final only)
                    │                   │                   │
                    ▼                   ▼                   ▼
             Transcript lane     Translation lane    SpeakerClusterService
                    │                   │                   │
                    │                   ├→ optional TTS     ▼
                    │                   │   read-back   speaker badge
                    └───────────────────┴───────────────────┘
                                        ▼
                          encrypted local storage (on finalize)
                                        ▼
                       session end → meetingRecapService → Review screen
```

Audio samples for an utterance live only in memory and are dropped as soon as
the embedding is extracted.

---

## 2. Component Architecture

### 2.1 STT — Two Engines Behind One Interface

`src/native/stt/RealSpeechRecognizer.ts` owns the live path: mic stream, speech
detection, buffering, engine selection, partial/final emission.

| Aspect | Auto mode | Vietnamese mode |
|--------|-----------|-----------------|
| Model | `sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17` | `sherpa-onnx-zipformer-vi-int8-2025-04-20` |
| `modelType` | `sense_voice` (ITN enabled) | `transducer` |
| Languages | EN / JA / KO / ZH (also YUE in the model) | VI only — every event pinned to `vi` |
| Architecture | Non-autoregressive | RNN-T offline transducer |
| Provider | CPU, 2 threads, int8 preferred | CPU, 2 threads, int8 preferred |
| Disk | ~234MB | ~74MB |
| Selection | Default | Settings → Input language → Vietnamese |
| Known gap | — | No inverse text normalization; numbers appear as words |

Engine choice is per session and resolved by `getSttModelIdForSource()` in
`src/native/models/bundledModels.ts`.

### 2.2 Speech Detection — Energy Based, Not Silero

The two capture paths deliver very different absolute levels: iOS applies AGC,
while the Android path uses `MediaRecorder.AudioSource.UNPROCESSED`. A single
VAD threshold fragmented Android sentences into 1-2 word pieces, so detection is
platform-tuned and runs on the **raw** signal, while STT receives a gain-adjusted
copy (×6 on Android, ×1 on iOS).

| Parameter | iOS | Android |
|-----------|-----|---------|
| Speech START threshold (raw RMS) | 0.020 | 0.004 |
| Speech CONTINUE threshold (hysteresis) | 0.008 | 0.0015 |
| Noise-floor ratio to start / continue | ×3.5 / ×1.8 | ×3.5 / ×1.8 |
| Noise-floor EWMA (down / up) | 0.2 / 0.005 | 0.2 / 0.005 |
| Silence that ends an utterance | 900ms | 1400ms |
| Minimum utterance | 200ms | 200ms |
| Pre-roll prepended at speech start | 400ms | 400ms |
| Partial emission interval | 500ms | 900ms |
| Soft cap / soft-cap silence | 10s / 250ms | 14s / 900ms |
| Hard cap on one utterance | 15s | 20s |
| Capture calibration window at start | — | 1500ms |

`VADProcessor`, `ChunkProcessor`, and `MeetingPipeline` implement an alternative
simulator pipeline used by tests and development; the shipped meeting path uses
`RealSpeechRecognizer`.

### 2.3 Translation — Platform Native

#### iOS: Apple Translation Framework

| Aspect | Detail |
|--------|--------|
| Native module | `ios/AppleTranslatorModule.swift` + `.m` |
| Requirement | iOS 18.0+ (`platformSupport.ts` gates and degrades) |
| Model files in app | None |
| Packs | Downloaded from the Splash screen; status re-checked per pair |
| API surface | `translate`, `translateBatch`, `isLanguageAvailable`, `unload` |

#### Android: Google ML Kit Translate

| Aspect | Detail |
|--------|--------|
| Dependency | `com.google.mlkit:translate:17.0.3` |
| Native module | `android/…/translation/MLKitTranslatorModule.kt` |
| Model files in app | None — packs downloaded on demand |
| API surface | `translate`, `translateBatch`, `isLanguageAvailable`, `downloadLanguagePack`, `downloadAllLanguagePacks`, `getPackStatus`, `deleteAllPacks`, `cleanup` |

`src/services/TranslationService.ts` hides the split behind one API.
`LiveMeetingTranslator` adds revision tracking and cancellation so a superseded
partial never overwrites a newer result. When source equals target the text
passes through untouched.

Language matrix: source ∈ {en, ja, ko, zh, vi}, target ∈ {en, vi, zh, ko, ja},
default target `vi`.

### 2.4 Speaker Diarization

| Aspect | Detail |
|--------|--------|
| Embedding model | `3dspeaker_speech_campplus_sv_en_voxceleb_16k.onnx` (CAM++), 192-dim |
| Segmentation model | `model.onnx` — placeholder; boundaries currently come from the speech detector |
| Native modules | `SpeakerEmbeddingModule` and `OfflineSpeakerDiarizationModule` on both iOS and Android |
| Clustering | `src/services/speaker/SpeakerClusterService.ts` — TypeScript |
| Bundle size | ~35MB |
| Non-blocking | Failure is swallowed; the utterance still renders |

Clustering defaults:

| Parameter | Default |
|-----------|---------|
| `similarityThreshold` | 0.50 |
| `highConfidenceThreshold` | 0.65 |
| `lowConfidenceThreshold` (new-cluster gate) | 0.22 |
| `minUtteranceDuration` | 1.0s |
| `temporalBiasWindow` / `temporalBiasBoost` | 10.0s / 0.05 |
| `maxEmbeddingsPerCluster` / `minClusterSize` | 30 / 3 |
| `clusterMergeThreshold` | 0.68 |
| `maxSpeakers` | 8 |
| Runtime sensitivity range (Settings) | 0.3 – 0.9 |

A guard keeps "strong new speaker" auto-creation available only while at most one
cluster exists; without it, two people reliably produced five or six speakers.

The offline diarization service throttles itself: at most one pass every 8s over
a window of at most 6s of audio.

### 2.5 Meeting Recap — Deterministic, No AI

`src/features/history/utils/meetingRecapService.ts` derives the recap from stored
utterances using explainable rules, each highlight labeled with the rule that
produced it:

| Signal | Interpretation |
|--------|----------------|
| Longest utterances | Substantive contributions or explanations |
| Final utterances | Recent discussion before the meeting ended |
| Repeated keywords | Topics of recurring importance |
| Speaker balance | Language and utterance-count distribution per speaker |
| Language split | Per-language utterance counts |

Exporters live alongside it: `meetingMinutesExporter.ts` (full Markdown minutes)
and `exportTranscript.ts` (transcript / recap, share sheet and clipboard).

TF-IDF scoring, action-item detection, and topic segmentation from v4.0 were not
built — see PRD FR-084/FR-085.

### 2.6 Session Orchestration

`src/features/meeting/hooks/useMeetingSession.ts` (~1,400 lines) is the
orchestrator. Key behaviors:

1. **Start** — resolve STT engine from the input-language setting, warn if the
   translation pack for the pair is missing, activate the audio session, start
   background recording, begin capture.
2. **STT partial** → update the transcript lane; translate as a draft.
3. **STT final** → cancel any in-flight draft translation, translate, extract the
   speaker embedding, assign a cluster, persist utterance + translation together.
4. **Same source and target language** → passthrough, no translation call.
5. **Optional TTS** → speak the finalized translation if read-back is enabled.
6. **Interruption** (call, Siri) → pause and resume around the audio session.
7. **Stop** → drain the in-flight utterance, finalize the session, generate the
   recap, navigate to Review.

### 2.7 Local Storage — Encrypted Key-Value

| Aspect | Detail |
|--------|--------|
| Android | AsyncStorage, values encrypted before write |
| iOS | JSON files under `Documents/vibevoice-persistence/` |
| Encryption | AES-GCM with a device-bound key — iOS Keychain (`WhenUnlockedThisDeviceOnly`), Android Keystore |
| Keys | `@vibevoice:sessions`, `…:utterances:<id>`, `…:translations:<id>`, `…:session-config:<id>` |
| Write pattern | Write-on-finalize: utterance and its translation are written in the same pass |
| Crash recovery | On init, sessions left `live` with no `endedAt` are marked `interrupted` |
| Read-back verification | Sessions are re-read after write; a mismatch is logged, not thrown |

A SQLite schema (`sessions`, `utterances`, `translations`, WAL mode, live-session
index) is drafted in the file header as the migration target.

### 2.8 UI Architecture

Screens, routed by a lightweight custom router in `src/app/navigation/`
(React Navigation 7 is a dependency but does not drive routing):

| Screen | Role |
|--------|------|
| Splash / bootstrap | Model install + prewarm, language-pack setup, readiness reporting |
| Meeting | 2 lanes, badges, timer, start/stop, TTS indicator, split toggle |
| History (home) | Session list with date, duration, languages, speaker count |
| Session Review | Tabs: Transcript · Insights · Media · Export; recalculate speakers |
| Model Repository | Bundled-model install state and removal |
| Settings | Languages, engines, packs, diarization, TTS, theme, local data, developer mode |

Theming is token-based (`shared/theme/`) with light/dark and a system option.
The UI is localized into VI/EN/JA/KO/ZH through i18next.

### 2.9 Native Module Inventory

| Platform | Module | Purpose |
|----------|--------|---------|
| iOS | `AppleTranslatorModule` | Apple Translation Framework |
| iOS | `AudioSessionModule` | Session activation, built-in mic, interruption events |
| iOS | `MicrophonePermissionModule` | Permission request before capture |
| iOS | `LocaleModule` | Device locale for i18n bootstrap |
| iOS | `TTSSpeakerModule` | Speech synthesis + speaking events |
| iOS | `SecureStorageBridge` | Keychain-backed key material |
| iOS | `SpeakerEmbeddingModule`, `OfflineSpeakerDiarizationModule` | CAM++ embedding, diarization |
| Android | `MLKitTranslatorModule` | ML Kit Translate |
| Android | `TTSSpeakerModule` | Speech synthesis + voice-pack check |
| Android | `BackgroundRecordingModule`, `MeetingRecordingService`, `ReactContextHolder` | Foreground service capture |
| Android | `SecureStorageBridgeModule` | Keystore-backed key material |
| Android | `SpeakerEmbeddingModule`, `OfflineSpeakerDiarizationModule` | CAM++ embedding, diarization |
| Android | `KeepAwakeModule` | Keep the screen on during a meeting |

---

## 3. Key Architecture Decisions

### ADR-001: On-Device Meeting Pipeline, No Server

**Decision:** All capture, STT, translation, diarization, recap, and storage run on the device. No backend exists.
**Consequences:** Privacy by construction, no network latency, works in airplane mode during meetings. Trade-off: model quality below cloud services, and all cost lands on the device budget.
**Status:** Holds.

### ADR-002 (supersedes v4.0 ADR-002): SenseVoice for EN/JA/KO/ZH, Zipformer-VI for Vietnamese

**Context:** v4.0 chose Whisper-Small because SenseVoice has no Vietnamese. Measurement showed SenseVoice at **99.71% WER** on FLEURS-vi — completely broken for Vietnamese, exactly as feared. But paying Whisper's ~5× autoregressive cost on *all* languages to solve *one* was a bad trade.
**Decision:** Keep SenseVoice for its four strong languages; add a dedicated Vietnamese offline transducer, selected explicitly in Settings.
**Evidence:** `bench/` — FLEURS-vi, 200 utterances, Mac CPU 4 threads.

| Model | WER | RTF | Verdict |
|-------|----:|----:|---------|
| `zipformer-vi` (Apache-2.0) | **10.09%** | 0.025 | Chosen |
| `zipformer-vi-30m` (CC-BY-NC-ND) | 9.51% | 0.023 | Better, but cannot ship |
| `sense-voice` | 99.71% | 0.046 | Unusable for VI |
| `omnilingual-300m` | 26.77% | 0.234 | Rejected |

**Open risk:** FLEURS is clean read speech. The real gate is consented meeting audio, still outstanding. The Apache-2.0 claim on the source dataset is asserted at Hugging Face metadata level only and awaits legal confirmation.

### ADR-003 (supersedes v4.0 ADR-003 for Android): ML Kit Translate instead of bundled Opus-MT

**Context:** v4.0 planned four bundled Opus-MT models (~200MB) with EN-pivot two-hop routing for JA/KO/ZH.
**Decision:** Use Google ML Kit Translate on Android; keep Apple Translation on iOS.
**Consequences:**
- (+) ~200MB removed from the Android binary
- (+) Direct language pairs — no two-hop quality loss
- (+) One translation abstraction covering both platforms
- (−) A one-time pack download is now required on **both** platforms, so "offline from first launch" is no longer true
- (−) A Google SDK with network capability is now in the dependency graph

### ADR-004 (amended): Models Bundled, Installed on First Launch

**Decision:** STT and diarization models ship with the app. On first launch they are copied out of the bundle into `Documents/models/` and, on iOS, excluded from iCloud backup.
**Build integration:** An Xcode build phase runs `mobile/scripts/copy-required-model-assets.js`, which downloads the archives from the sherpa-onnx releases if they are absent — the `.onnx` binaries are gitignored, so a fresh clone fetches them at build time rather than storing them in git.
**Amendment:** Translation models are *not* bundled (ADR-003), so the first launch does need the network once.

### ADR-005: Anonymous Speaker Labels

**Decision:** Per-utterance labels (S1, S2, S3…) from CAM++ embeddings clustered in TypeScript. No voice enrollment, no identity.
**Non-blocking:** Diarization failure never blocks STT or translation.
**Status:** Holds. The segmentation model remains a placeholder.

### ADR-006 (amended): Rule-Based Recap, No AI

**Decision:** Generate the recap with deterministic, explainable rules instead of an LLM.
**Rationale:** Any on-device LLM would blow the RAM budget, and an explainable recap is auditable — each highlight names the rule that selected it.
**Amendment:** The shipped implementation uses simpler heuristics than the TF-IDF design in v4.0; action items and topic segments are not implemented.

### ADR-007 (new): Energy-Based Speech Detection

**Decision:** Detect speech from raw-RMS energy with dual-threshold hysteresis, an adaptive noise floor, and pre-roll — instead of Silero VAD.
**Rationale:** iOS delivers AGC'd audio, Android delivers unprocessed audio. Any fixed gain that lifted quiet Android speech above the threshold also lifted silence above the continue threshold, so utterances never ended. Keeping detection on the raw signal with platform-tuned thresholds sidesteps the problem.
**Cost:** Two more constants to tune per platform, and the thresholds are device-sensitive; a periodic RMS statistics log makes the behavior observable in the field.

### ADR-008 (new): Background Capture

**Decision:** Android runs an `microphone`-type foreground service with a persistent notification; iOS declares `UIBackgroundModes: audio`. The screen can also be kept awake.
**Rationale:** Meetings outlive screen timeouts, and losing capture on lock made the app unusable in practice.
**Cost:** `FOREGROUND_SERVICE_MICROPHONE` and `POST_NOTIFICATIONS` permissions, plus a visible ongoing notification.

### ADR-009 (new): Encrypted Key-Value Storage Before SQLite

**Decision:** Persist sessions, utterances, and translations as encrypted key-value payloads — AsyncStorage on Android, JSON files on iOS — with AES-GCM keys held in Keychain/Keystore.
**Rationale:** Ships the privacy guarantee immediately without a native database dependency.
**Cost:** Whole-collection rewrites per session, no queries, no transactions. The SQLite schema is drafted in code as the migration target (PRD FR-045).

### ADR-010 (new): Selectable Target Language and TTS Read-Back

**Decision:** The target language is user-selectable across five languages, and finalized translations can optionally be spoken aloud.
**Rationale:** Vietnamese-hosted meetings need outward translation (VI→EN and friends), which also made Vietnamese a legitimate *source* language and motivated ADR-002. Read-back is an accessibility aid, off by default, and never replaces the transcript.

---

## 4. Project Structure (actual)

```
mva/
├── bench/                                  # Phase 0 STT benchmark harness
│   ├── README.md                           # Results + go/no-go criteria
│   ├── download.sh
│   └── run_bench.py
├── docs/
│   ├── planning-artifacts/                 # prd · architecture · epics · ux
│   └── implementation-artifacts/           # story catalog
└── mobile/
    ├── android/app/src/main/
    │   ├── assets/models/                  # bundled model binaries (gitignored)
    │   └── java/com/vibevoicenative/
    │       ├── translation/MLKitTranslatorModule.kt
    │       ├── speaker/{SpeakerEmbedding,OfflineSpeakerDiarization}Module.kt
    │       ├── tts/{TTSSpeaker,BackgroundRecording}Module.kt
    │       ├── tts/MeetingRecordingService.kt
    │       ├── securestorage/SecureStorageBridgeModule.kt
    │       └── keepawake/KeepAwakeModule.kt
    ├── assets/models/                       # model source of truth (binaries gitignored)
    ├── ios/
    │   ├── AppleTranslatorModule.{swift,m}
    │   ├── AudioSessionModule.{swift,m}
    │   ├── LocaleModule.{swift,m}
    │   ├── MicrophonePermissionModule.{swift,m}
    │   ├── SecureStorageBridge.{swift,m}
    │   ├── TTSSpeakerModule.{swift,m}
    │   ├── VibeVoiceNative/
    │   │   ├── SpeakerEmbeddingModule.{swift,m}
    │   │   ├── OfflineSpeakerDiarizationModule.{swift,m}
    │   │   └── Info.plist · PrivacyInfo.xcprivacy
    │   └── BUILD-TESTFLIGHT.md
    ├── scripts/copy-required-model-assets.js
    └── src/
        ├── app/navigation/                  # RootNavigator + lightweight router
        ├── features/
        │   ├── bootstrap/screens/SplashScreen.tsx
        │   ├── meeting/
        │   │   ├── screens/MeetingScreen.tsx
        │   │   ├── hooks/useMeetingSession.ts       # orchestrator
        │   │   ├── hooks/useTTSSpeaker.ts
        │   │   ├── components/{TranscriptLane,TranslationLane,MeetingStatusBar}.tsx
        │   │   ├── components/DeveloperMetricsOverlay/
        │   │   ├── state/meetingStore.ts
        │   │   └── store/{developerMetrics,diarizationProgress}Store.ts
        │   ├── history/
        │   │   ├── screens/{HistoryList,SessionReview}Screen.tsx
        │   │   └── utils/{meetingRecapService,meetingMinutesExporter,exportTranscript}.ts
        │   ├── models/screens/ModelRepositoryScreen.tsx
        │   └── settings/screens/SettingsScreen.tsx
        ├── native/
        │   ├── stt/{RealSpeechRecognizer,MeetingPipeline,STTProcessor,…}.ts
        │   ├── models/{bundledModels,BundledModelInstaller}.ts
        │   ├── speaker/{SpeakerEmbedding,OfflineSpeakerDiarization}{Service,Bridge}.ts
        │   ├── tts/NativeTTSSpeaker.ts
        │   ├── backgroundRecording/NativeBackgroundRecording.ts
        │   ├── {NativeAppleTranslator,NativeMLKitTranslator,SecureStorageBridge}.ts
        │   └── model_manager/                       # unused download interface + mock
        ├── services/
        │   ├── {TranslationService,LiveMeetingTranslator,OnDeviceTranslator}.ts
        │   ├── speaker/{SpeakerClusterService,SessionDiarizationWindowService}.ts
        │   ├── persistence/index.ts
        │   ├── tts/TTSService.ts
        │   └── languagePackStatus.ts
        ├── shared/
        │   ├── store/{bootstrap,settings}Store.ts
        │   ├── theme/ · hooks/useTheme.tsx
        │   ├── components/ui/
        │   ├── config/runtimeConfig.ts
        │   └── utils/{localStorage,logger,permissions,platformSupport}.ts
        └── i18n/                                    # vi · en · ja · ko · zh
```

`src/native/model_manager/` defines a model **download** interface with a mock
implementation. Nothing in the app calls it — models are bundled, and the Model
Repository screen talks to `BundledModelInstaller` instead. It is dead code kept
for a possible future download flow.

---

## 5. Resource Budget

### 5.1 Disk (verified)

| Asset | iOS | Android |
|-------|-----|---------|
| SenseVoice-Small int8 | ~234MB | ~234MB |
| Zipformer-VI int8 | ~74MB | ~74MB |
| Speaker diarization (segmentation + CAM++) | ~35MB | ~35MB |
| Translation models | 0 (Apple packs) | 0 (ML Kit packs) |

Models are copied from the bundle into `Documents/models/` on first run, so
installed size is roughly double the bundle contribution until the OS reclaims it.

### 5.2 Memory — Targets, Not Measurements

| Component | iOS | Android |
|-----------|-----|---------|
| STT engine (one loaded at a time) | ~450MB target | ~450MB target |
| Translation | ~30-50MB (OS-managed) | ML Kit-managed, unmeasured |
| Speaker diarization | ~70MB target | ~70MB target |
| React Native runtime | ~80MB | ~80MB |
| Recap engine | ~0MB | ~0MB |
| **Budget ceiling** | **700MB** | **750MB** |

No RAM measurement has been taken on device. Closing this is Epic 8.

### 5.3 Latency — Targets, Not Measurements

| Stage | iOS | Android |
|-------|-----|---------|
| Partial cadence (configured) | 500ms | 900ms |
| Utterance end after silence (configured) | 900ms | 1400ms |
| STT inference per utterance | unmeasured on device | unmeasured on device |
| Translation | 50-200ms target | 200-500ms target |
| Speaker embedding | 10-30ms target | 10-30ms target |
| UI render | 16ms | 16ms |

The only measured speed figure is RTF on a Mac CPU from `bench/`
(zipformer-vi 0.025, sense-voice 0.046). On-device RTF is an open Phase 0 item.

---

## 6. Known Architectural Debt

| Item | Impact | Tracked as |
|------|--------|-----------|
| No on-device performance measurements | Cannot validate any NFR | Epic 8 |
| Real-meeting WER unmeasured | Release gate not passed | `bench/README.md` |
| Key-value storage rewrites whole collections | Will degrade on long meetings | PRD FR-045 |
| Diarization segmentation model is a placeholder | Boundaries depend on the energy detector | PRD FR-078 |
| `model_manager` dead code | Confuses readers about download vs bundled | Cleanup |
| Two STT pipelines (`MeetingPipeline` vs `RealSpeechRecognizer`) | Duplicate concepts in the codebase | Cleanup |
| `console.warn` used as production logging in persistence | Log noise, potential data leakage into logs | Cleanup |
| Action items and topic segments unimplemented | Minutes are thinner than specified | PRD FR-084/085 |

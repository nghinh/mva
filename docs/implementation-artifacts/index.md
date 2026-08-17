# Meeting Voice Assistant — Story Catalog

**Architecture:** v5.0 — reconciled with the implementation at commit `9a6ecf1`
**Generated:** 2026-04-18 · **Reconciled:** 2026-08-17

> **Read this first.** The 38 story files in this folder were written against
> architecture v4.0. The product has since diverged: the STT engine, the Android
> translator, the VAD, and the storage layer are all different from what those
> stories describe. This index is the reconciled view — where a story file
> contradicts the code, **this index and `../planning-artifacts/architecture.md`
> are correct and the story file is stale.** Individual story files have not been
> rewritten; the "Story file accuracy" column tells you which ones to distrust.

## Architecture Summary (as built)

The meeting pipeline runs entirely on the device. Language packs for translation
are downloaded once at setup; after that, meetings work in airplane mode. There
is no backend and no telemetry.

- **STT (auto):** SenseVoice-Small int8 with ITN — EN/JA/KO/ZH — via `react-native-sherpa-onnx`
- **STT (Vietnamese):** Zipformer-VI int8 offline transducer, selected in Settings
- **Speech detection:** energy-based, dual-threshold hysteresis + adaptive noise floor + 400ms pre-roll
- **Translation (iOS):** Apple Translation Framework
- **Translation (Android):** Google ML Kit Translate 17.0.3
- **Target language:** user-selectable across EN/VI/ZH/KO/JA, default VI
- **Speaker diarization:** CAM++ 192-dim embeddings, clustered in TypeScript
- **Recap:** deterministic rule-based, no AI
- **TTS:** optional read-back of the translation lane on both platforms
- **Storage:** AES-GCM encrypted key-value — AsyncStorage (Android) / JSON files (iOS)
- **UI:** 2 lanes with language + speaker badges, 5 UI languages, light/dark themes

## Changes from v4.0

| Removed / reversed | Reason |
|--------------------|--------|
| Whisper-Small as the single STT engine | SenseVoice is far faster for EN/JA/KO/ZH; Vietnamese solved by a dedicated transducer instead (measured 10.09% WER vs SenseVoice's 99.71%) |
| Opus-MT tiny ×4 bundled on Android, EN-pivot two-hop | ML Kit gives direct pairs at zero bundle cost, removing ~200MB |
| Silero VAD | iOS AGC and Android unprocessed capture cannot share one threshold |
| SQLite | Shipped encrypted key-value storage first; SQLite remains the migration target |
| TF-IDF summarizer, action items, topic segments | Replaced by a simpler explainable recap; the remainder is unbuilt |
| "Offline from first launch" | Platform translation engines require a one-time pack download |

| Added | Reason |
|-------|--------|
| Vietnamese input engine (Story 2-6) | Vietnamese was unusable on the auto-detect engine |
| Background capture (Story 2-7) | Meetings outlive screen timeouts |
| Selectable target language (Story 3-8) | Vietnamese-hosted meetings need outward translation |
| TTS read-back (Story 7-9) | Accessibility aid, off by default |
| App localization in 5 languages (Story 7-10) | Non-Vietnamese participants use the device too |
| Phase 0 STT benchmark harness (`bench/`) | Model choice needed evidence, not assertion |

## Story Status

**Legend:** ✅ Done · 🟡 Partial · ⬜ Not started · ❌ Retired
**Story file accuracy:** 🟢 matches code · 🟠 partly stale · 🔴 describes a reversed decision — do not implement from it

### Epic 1 — Foundation

| Story | Status | File accuracy | Note |
|-------|--------|---------------|------|
| 1-1 Initialize mobile project and offline architecture baseline | ✅ | 🟠 | RN 0.85 / React 19; the "no network at all" premise is superseded |
| 1-2 Implement app bootstrap and model warm-up | ✅ | 🟠 | Warm-up also drives language-pack setup now |
| 1-3 Establish offline-only configuration and security baseline | 🟡 | 🟠 | Encryption shipped; `INTERNET` is required on Android for packs |

### Epic 2 — On-Device STT

| Story | Status | File accuracy | Note |
|-------|--------|---------------|------|
| 2-1 Start and stop meeting capture from the meeting screen | ✅ | 🟢 | |
| 2-2 Capture microphone audio continuously in the native layer | ✅ | 🟢 | |
| 2-3 Process audio chunks through VAD and filter silence | ✅ | 🔴 | Implemented as an energy detector, not Silero VAD |
| 2-4 Emit streaming partial transcript during active speech | ✅ | 🟠 | Cadence is 500ms iOS / 900ms Android |
| 2-5 Emit final transcript and detected language at utterance end | ✅ | 🟠 | Silence window is 900ms iOS / 1400ms Android, not 600ms |
| 2-6 Vietnamese input engine *(no file — see git history for `feat/whisper-vi-stt`)* | ✅ | — | Zipformer-VI transducer, pinned to `vi` |
| 2-7 Background and locked-screen capture *(no file)* | ✅ | — | Android foreground service + iOS `UIBackgroundModes: audio` |

### Epic 3 — Translation

| Story | Status | File accuracy | Note |
|-------|--------|---------------|------|
| 3-1 Build Apple translator module for iOS | ✅ | 🟢 | |
| 3-2 Build Opus-MT translator module for Android | ❌ | 🔴 | Reversed — Android uses ML Kit. Do not implement. |
| 3-3 Build unified translation service | ✅ | 🟢 | |
| 3-4 Translate final STT results to Vietnamese on device | ✅ | 🟠 | Target is no longer fixed to Vietnamese |
| 3-5 Translate partial STT results as draft translations | ✅ | 🟢 | |
| 3-6 Implement translation cancellation and concurrency control | ✅ | 🟢 | |
| 3-7 Implement Vietnamese passthrough without translation | ✅ | 🟠 | Generalized: passthrough when source equals target |
| 3-8 Selectable target language + pack setup *(no file)* | ✅ | — | 5 targets, per-pair status, pre-meeting warning |

### Epic 4 — Meeting UI

| Story | Status | File accuracy | Note |
|-------|--------|---------------|------|
| 4-1 Build meeting screen with two-lane layout | ✅ | 🟢 | Split/single toggle added |
| 4-2 Implement recording indicator and session timer | ✅ | 🟢 | |
| 4-3 Implement auto-scroll and jump-to-latest | ✅ | 🟢 | |
| 4-4 Implement stop meeting and session save flow | ✅ | 🟠 | Saves to encrypted key-value storage, not SQLite |
| 4-5 Build waiting state before speech detected | ✅ | 🟢 | |
| 4-6 Deliver accessibility and dark mode for meeting screen | ✅ | 🟢 | |
| 4-7 Readiness surface before Start *(no file)* | ✅ | — | Model, prewarm, translator, and pack states each actionable |

### Epic 5 — Speaker Diarization

| Story | Status | File accuracy | Note |
|-------|--------|---------------|------|
| 5-1 Extract speaker embeddings from each utterance | ✅ | 🟢 | CAM++ 192-dim, both platforms |
| 5-2 Implement speaker cluster service | ✅ | 🟢 | Defaults in `architecture.md` §2.4 |
| 5-3 Display speaker badges in UI | ✅ | 🟢 | |
| 5-4 Ensure non-blocking fault tolerance | ✅ | 🟢 | |
| 5-5 Recalculate speakers on review screen | ✅ | 🟢 | |
| 5-6 Real segmentation model *(no file)* | ⬜ | — | Shipped `model.onnx` is a placeholder |

### Epic 6 — Recap & Export

| Story | Status | File accuracy | Note |
|-------|--------|---------------|------|
| 6-1 Build meeting summarizer service | 🟡 | 🔴 | Built as a rule-based recap service; no TF-IDF, no `SentenceScorer` |
| 6-2 Display summary card on review screen | ✅ | 🟠 | Delivered as the Insights tab |
| 6-3 Export meeting minutes as Markdown | ✅ | 🟢 | Share sheet + clipboard |
| 6-4 Display topic segments on review screen | ⬜ | 🟠 | Not implemented |
| 6-5 Action item detection *(no file)* | ⬜ | — | Not implemented |

### Epic 7 — Sessions, Settings & Polish

| Story | Status | File accuracy | Note |
|-------|--------|---------------|------|
| 7-1 Persist meeting data to SQLite | 🟡 | 🔴 | Persistence works; the store is encrypted key-value. SQLite schema drafted in `services/persistence/index.ts` |
| 7-2 Build session history list on home screen | ✅ | 🟢 | |
| 7-3 Build session review detail screen | ✅ | 🟠 | Four tabs: Transcript · Insights · Media · Export |
| 7-4 Implement session deletion and data cleanup | ✅ | 🟢 | |
| 7-5 Build settings screen | ✅ | 🟠 | Far larger than specified — engines, packs, TTS, app language, developer mode |
| 7-6 Implement local storage encryption | ✅ | 🟢 | AES-GCM, Keychain / Keystore |
| 7-7 Implement developer mode metrics overlay | ✅ | 🟢 | Plus clustering-parameter tuning |
| 7-8 Implement light and dark mode theming | ✅ | 🟢 | |
| 7-9 TTS read-back *(no file)* | ✅ | — | Off by default; rate control; Android voice-pack check |
| 7-10 App localization *(no file)* | ✅ | — | VI/EN/JA/KO/ZH |

### Epic 8 — Validation (no story files yet)

| Story | Status | Note |
|-------|--------|------|
| 8-1 Real-meeting WER | ⬜ | The formal go/no-go gate. Harness ready in `bench/` |
| 8-2 On-device RTF, both engines, iPhone + low-end Android | ⬜ | Needs a small in-app dev screen |
| 8-3 End-to-end latency | ⬜ | |
| 8-4 Peak RAM, both platforms | ⬜ | |
| 8-5 Battery drain per meeting hour | ⬜ | |
| 8-6 Zipformer-VI license clearance | ⬜ | Blocks release, not development |

### Epic 9 — Technical Debt (no story files yet)

| Story | Status | Note |
|-------|--------|------|
| 9-1 Remove dead `model_manager` download interface | ⬜ | |
| 9-2 Consolidate `MeetingPipeline` and `RealSpeechRecognizer` | ⬜ | |
| 9-3 Replace `console.warn` in persistence with the shared logger | ⬜ | Meeting content can reach device logs |
| 9-4 Raise test coverage (9 test files today) | ⬜ | |
| 9-5 Update `ux-design-specification.md` to v5.0 | ⬜ | Still describes the v4.0 product |

## Counts

| | Stories | Done | Partial | Not started | Retired |
|---|---:|---:|---:|---:|---:|
| Epics 1-7 (product) | 46 | 39 | 3 | 3 | 1 |
| Epic 8 (validation) | 6 | 0 | 0 | 6 | 0 |
| Epic 9 (debt) | 5 | 0 | 0 | 5 | 0 |

Eight of the 46 product stories have no story file — they were built after the
v4.0 catalog was generated (38 files + 8 = 46). Their behavior is specified in
`../planning-artifacts/prd.md`.

## Resource Reference

| Asset | Disk |
|-------|------|
| SenseVoice-Small int8 | ~234MB |
| Zipformer-VI int8 | ~74MB |
| Speaker diarization (segmentation + CAM++) | ~35MB |
| Translation models | 0 — Apple / ML Kit packs |

Model binaries are gitignored. `mobile/scripts/copy-required-model-assets.js`
fetches them from the sherpa-onnx releases and is wired into the Xcode build
phase, so a fresh clone builds without manual asset steps.

**RAM and latency budgets are targets, not measurements.** See Epic 8.

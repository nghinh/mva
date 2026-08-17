# Product Requirements Document — Meeting Voice Assistant

**Author:** nghinh
**Date:** 2026-08-17
**Version:** 5.0 (Reconciled with implementation)
**Status:** Approved — describes the app as built at commit `9a6ecf1`
**Change from v4.0:** Whisper-Small → SenseVoice-Small + Zipformer-VI, Opus-MT → Google ML Kit on Android, SQLite → encrypted key-value storage, translation target language made user-selectable, TTS read-back added, background recording added, app UI localized into 5 languages.

> **How to read this document.** v4.0 described an intended design. This revision
> describes what the code actually does, and marks anything still unbuilt as
> **Planned**. Where a v4.0 decision was reversed, the reason is recorded in
> §7 so the history is not lost.

---

## 1. Executive Summary

### 1.1 Purpose

This PRD defines requirements for **Meeting Voice Assistant (MVA)** — a mobile app enabling Vietnamese executives to understand multilingual meetings in real time via on-device speech recognition, translation, and speaker identification.

### 1.2 Problem Statement

Senior directors at Vietnamese telecom corporations frequently attend meetings with Japanese, Korean, Chinese, and international partners. Language barriers cause missed context, delayed responses, and reliance on human interpreters. Existing translation apps send meeting audio to the cloud, introduce privacy risks, and suffer from network-dependent latency.

### 1.3 Solution Overview

MVA runs its entire meeting pipeline on the user's smartphone:

- **On-device STT** — SenseVoice-Small int8 auto-detects EN/JA/KO/ZH; a dedicated Zipformer-VI transducer handles Vietnamese input. Both run through `react-native-sherpa-onnx` and are bundled in the app binary.
- **On-device translation** — Apple Translation Framework on iOS, Google ML Kit Translate on Android. Both run locally once their language packs are installed.
- **Speaker diarization** — 192-dim CAM++ embeddings per utterance, clustered in TypeScript into anonymous labels (S1/S2/S3…).
- **Meeting recap** — deterministic rule-based summary, key moments, speaker and language statistics generated when a session ends.
- **Spoken read-back (TTS)** — the translated lane can be read aloud through the platform speech synthesizer.
- **2-lane UI** — original transcript + translation, with language and speaker badges.

Audio never leaves the device and is never written to disk. Transcripts and translations are stored encrypted in the app's private sandbox.

### 1.4 Network Posture — Important Change from v4.0

MVA is **offline during meetings**, not offline in absolute terms.

| Phase | Network |
|-------|---------|
| Meeting capture, STT, diarization, recap, export | None. Airplane mode works. |
| First-run translation setup | **Required.** Apple / ML Kit language packs are downloaded once from the Splash screen. |
| Android TTS voice pack install | **Required**, one time, only if the user enables read-back and the voice is missing. |

The `INTERNET` permission is declared on Android for exactly these two package downloads. No meeting content is ever transmitted; there is no telemetry, analytics, or backend of any kind.

### 1.5 What This Product Is NOT

- NOT a conferencing/video-call app
- NOT a cloud service — there is no backend
- NOT an AI assistant (no LLM anywhere in the product)
- NOT a speaker identification system (anonymous labels only, no voice enrollment)
- NOT a certified interpreter — TTS read-back is an accessibility aid, not a substitute for a human interpreter

### 1.6 Success Metrics

| Metric | Target | Status |
|--------|--------|--------|
| STT Word Error Rate — Vietnamese | ≤ 15% | **Measured 10.09%** (Zipformer-VI, FLEURS-vi, 200 utterances — see `bench/`) |
| STT Word Error Rate — EN/JA/KO/ZH | ≤ 15% | Not yet measured |
| STT Word Error Rate on real meeting audio | ≤ 15% | Not yet measured — the formal go/no-go gate, see `bench/README.md` |
| Partial transcript p95 latency on device | < 2s | Not yet measured on iPhone |
| Translation display latency | ≤ 500ms (iOS) / ≤ 1s (Android) | Not yet measured |
| Speaker diarization accuracy (DER) | ≤ 25% for 2-4 speakers | Not yet measured |
| App cold start (models installed) | ≤ 8s | Not yet measured |
| RAM usage (all engines loaded) | ≤ 700MB (iOS) / ≤ 750MB (Android) | Not yet measured |
| Battery drain per hour | ≤ 6% | Not yet measured |
| App crash rate | < 0.5% per session | Not yet measured |

Only the Vietnamese WER figure has been produced by a repeatable harness. Every other row is an unvalidated target; closing them is tracked in Epic 8 (§ `epics.md`).

---

## 2. Target User & Use Cases

### 2.1 Primary Persona

**Nghi, 42, Director of Digital Solution Center** — attends 3-5 international meetings per week with Japanese, Korean, and Chinese partners. Places the phone on the meeting table. Needs privacy, low latency, and a reviewable record with speaker attribution.

### 2.2 Use Cases

| ID | Use Case | Description | Status |
|----|----------|-------------|--------|
| UC-01 | Live meeting translation | Transcribe EN/JA/KO/ZH, translate into the chosen target language with speaker labels | Built |
| UC-02 | Vietnamese-language meeting | Vietnamese speech transcribed by the dedicated VI engine and translated outward (e.g. VI→EN) | Built |
| UC-03 | Meeting continues in background | Capture survives screen lock and app backgrounding | Built |
| UC-04 | Meeting review | Review transcript + translations with speaker labels and recap | Built |
| UC-05 | Meeting recap | Auto-generated key points, key moments, speaker and language statistics | Built |
| UC-06 | Export | Share transcript, recap, or full minutes as Markdown via the system share sheet | Built |
| UC-07 | Spoken read-back | Hear the translation lane spoken aloud during the meeting | Built |
| UC-08 | Offline operation during the meeting | Works in airplane mode once language packs are installed | Built |

---

## 3. Functional Requirements

Status column: **Built** = implemented and reachable in the app · **Partial** = implemented with a documented gap · **Planned** = specified, not implemented.

### 3.1 Audio Capture

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-001 | Capture audio at 16kHz mono PCM through `react-native-sherpa-onnx`. | Must | Built |
| FR-002 | Audio capture continues while the user navigates within the app. | Must | Built |
| FR-003 | Audio is never written to disk and never transmitted. It is retained in memory for the duration of an utterance (STT + speaker embedding), then discarded. | Must | Built |
| FR-004 | Capture continues while the app is backgrounded or the screen is locked: Android foreground service of type `microphone` with a persistent notification; iOS `UIBackgroundModes: audio`. | Must | Built |
| FR-005 | The screen may be kept awake during an active meeting. | Should | Built |
| FR-006 | iOS: handle audio session interruption (phone call, Siri) and resume capture afterwards. | Must | Built |
| FR-007 | Android: apply a fixed input gain to the STT-bound signal only, because the capture path delivers unprocessed mic levels. Speech detection stays on the raw signal. | Must | Built |

### 3.2 Speech-to-Text

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-010 | On-device STT via `react-native-sherpa-onnx`, CPU provider, 2 threads, int8 preferred. | Must | Built |
| FR-010a | **Auto mode:** SenseVoice-Small int8 with inverse text normalization, auto-detecting EN/JA/KO/ZH. | Must | Built |
| FR-010b | **Vietnamese mode:** Zipformer-VI int8 offline transducer, selected in Settings. Pins every emitted event to `vi` — no heuristic language detection. | Must | Built |
| FR-011 | Partial results emitted while speech is in progress (every 500ms on iOS, 900ms on Android). | Must | Built |
| FR-012 | Final result emitted after a silence window (900ms iOS / 1400ms Android), with soft and hard caps to bound utterance length. | Must | Built |
| FR-013 | Detect source language per utterance in Auto mode. | Must | Built |
| FR-014 | Filter silence with an energy-based detector: dual-threshold hysteresis plus an adaptive noise floor, with 400ms pre-roll so soft word onsets are not clipped. | Must | Built |
| FR-015 | Discard utterances shorter than 200ms. | Should | Built |
| FR-016 | Vietnamese transducer output has no inverse text normalization — numbers are transcribed as words. | — | Known limitation |

### 3.3 Translation

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-020 | iOS: Apple Translation Framework via a native module. | Must | Built |
| FR-020a | Android: Google ML Kit Translate (`com.google.mlkit:translate:17.0.3`) via a native module. | Must | Built |
| FR-021 | Source languages EN/JA/KO/ZH/VI; target language user-selectable from EN/VI/ZH/KO/JA, defaulting to VI. | Must | Built |
| FR-022 | Partial STT results are translated as drafts and visibly marked as such. | Should | Built |
| FR-023 | In-flight translation is cancelled when a newer STT revision arrives. | Must | Built |
| FR-024 | When source and target language match, text passes through untranslated. | Must | Built |
| FR-025 | Language packs are downloaded once from the Splash screen; the user is warned before starting a meeting whose pair is not installed, and may continue without translation. | Must | Built |
| FR-026 | Settings shows per-pair pack status and allows downloading or deleting packs. | Should | Built |

### 3.4 Speaker Diarization

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-070 | Extract a 192-dim embedding per utterance using CAM++ (`3dspeaker_speech_campplus_sv_en_voxceleb_16k.onnx`) via a native module on both platforms. | Should | Built |
| FR-071 | Cluster embeddings in TypeScript: cosine similarity with a three-zone threshold, L2 normalization, temporal bias, cluster auto-merge, and a speaker cap. | Should | Built |
| FR-072 | Colored speaker badges (S1/S2/S3…) in both lanes. | Should | Built |
| FR-073 | Speaker count shown on session cards. | Should | Built |
| FR-074 | Non-fatal: diarization failure must not affect STT or translation. | Must | Built |
| FR-075 | "Recalculate Speakers" on the Review screen re-clusters a saved session. | Should | Built |
| FR-076 | Diarization sensitivity is adjustable at runtime (0.3–0.9) from Settings, with the advanced clustering parameters exposed under Developer mode. | Should | Built |
| FR-077 | Utterances shorter than 1 second are skipped by clustering. | Should | Built |
| FR-078 | A segmentation-model path exists alongside embedding clustering; the shipped `model.onnx` is a placeholder and the live flow derives utterance boundaries from the speech detector. | — | Partial |

### 3.5 Meeting Recap & Minutes

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-080 | Generate a deterministic, explainable recap when a session ends. Every highlight is labeled with the rule that selected it. | Should | Built |
| FR-081 | Selection rules: longest utterances, closing utterances, repeated keywords, speaker balance, language split. No AI, no LLM, no cloud. | Should | Built |
| FR-082 | Recap, key moments, and statistics displayed on the Review screen under an Insights tab. | Should | Built |
| FR-083 | Export recap, transcript, or full meeting minutes as Markdown through the system share sheet; transcript can also be copied to the clipboard. | Should | Built |
| FR-084 | Action-item detection by multilingual pattern matching. | Should | Planned |
| FR-085 | Topic segmentation by time gap and keyword shift. | Should | Planned |

> v4.0 specified a TF-IDF summarizer with action-item detection and topic
> segmentation. What shipped is a simpler deterministic recap service; FR-084
> and FR-085 remain open.

### 3.6 User Interface

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-030 | Two-lane layout — Transcript (language + speaker badges) and Translation — with a split/single lane toggle. | Must | Built |
| FR-031 | Language badges: EN, JA, KO, ZH, VI each with a distinct color. | Must | Built |
| FR-031a | Speaker badges S1–S5+, each with a distinct color. | Should | Built |
| FR-032 | Auto-scroll with a "Jump to latest" affordance. | Must | Built |
| FR-033 | Start/Stop controls with a recording indicator and session timer. | Must | Built |
| FR-034 | Draft indicator for partial translations. | Should | Built |
| FR-035 | Readiness surface before start: model state, prewarm state, translator state, missing language packs — each with an actionable message. | Must | Built |
| FR-036 | Light and dark themes following the system preference, with a manual override. | Should | Built |
| FR-037 | App UI localized into Vietnamese, English, Japanese, Korean, and Chinese. | Should | Built |

### 3.7 Session Management

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-040 | Persist sessions, utterances, translations, and speaker labels to encrypted local storage when a meeting stops. | Must | Built |
| FR-041 | Session list with date, duration, languages, and speaker count. | Must | Built |
| FR-042 | Review screen with Transcript, Insights, Media, and Export tabs. | Must | Built |
| FR-043 | Delete an individual session or all sessions; Settings reports total local storage used. | Must | Built |
| FR-044 | Crash recovery: a session left in `live` state at app start is marked `interrupted`; utterances written before the crash survive. | Must | Built |
| FR-045 | Migrate storage to SQLite (schema drafted in `services/persistence/index.ts`). | Should | Planned |

### 3.8 Speech Output (TTS)

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-050 | Read finalized translations aloud through the platform speech synthesizer, off by default. | Should | Built |
| FR-051 | Speaking rate selectable: slow / normal / fast. | Should | Built |
| FR-052 | Speaking indicator in the meeting UI; read-back stops when the session stops or is paused. | Should | Built |
| FR-053 | Android: detect a missing voice pack for the target language and deep-link to the system TTS settings. | Should | Built |

### 3.9 Settings

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-060 | Show engine info — STT engine and languages, translation engine per platform, speaker detection model — with bundled/installed state. | Should | Built |
| FR-061 | Input language mode (Auto / Vietnamese) and target language selector. | Must | Built |
| FR-062 | Diarization sensitivity slider. | Should | Built |
| FR-063 | Developer mode: real-time metrics overlay and clustering parameter tuning, unlocked deliberately. | Could | Built |
| FR-064 | Manage bundled models: verify installation and remove installed copies (Model Repository screen). | Should | Built |
| FR-065 | App language selector, theme selector, local data controls, about section. | Should | Built |

---

## 4. Non-Functional Requirements

### 4.1 Performance

All figures below are **targets**, not measurements. The measurement work is Epic 8.

| Metric | Target | Maximum |
|--------|--------|---------|
| Partial transcript cadence | 500ms (iOS) / 900ms (Android) | — (configured, verified in code) |
| Utterance finalization after silence | 900ms (iOS) / 1400ms (Android) | — (configured, verified in code) |
| Hard cap on a single utterance | 15s (iOS) / 20s (Android) | — (configured, verified in code) |
| Translation latency (iOS) | 100ms | 500ms |
| Translation latency (Android) | 300ms | 1,000ms |
| Speaker embedding extraction | 20ms | 50ms |
| End-to-end (end of speech → translation) | 600ms | 1,500ms |
| UI frame rate | 60fps | 30fps min |
| Cold start | 5s | 8s |
| RAM — iOS | 600MB | 700MB |
| RAM — Android | 650MB | 750MB |
| Recap generation | 300ms | 500ms |

### 4.2 Disk Footprint (verified)

| Asset | Size |
|-------|------|
| SenseVoice-Small int8 | ~234MB |
| Zipformer-VI int8 | bundled alongside SenseVoice (encoder/decoder/joiner int8) |
| Speaker diarization (segmentation + CAM++) | ~35MB |
| Translation models | 0 in-app — supplied by Apple / ML Kit language packs |

Bundled model files are copied out of the app bundle into the app's Documents directory on first run and excluded from iCloud backup on iOS.

### 4.3 Privacy & Security

- No meeting audio or text is ever transmitted. No telemetry, analytics, or crash reporting that carries meeting content.
- All meeting inference runs on-device.
- Network is used only to fetch translation language packs and, optionally, an Android TTS voice pack.
- Audio is never written to disk.
- Local data is encrypted at rest with AES-GCM using a device-bound key: iOS Keychain (`kSecAttrAccessibleWhenUnlockedThisDeviceOnly`), Android Keystore.
- Data lives in the app-private sandbox and is removed by uninstall.
- Only one third-party SDK with network capability is present — Google ML Kit Translate on Android, used solely for on-device model download and offline translation.

### 4.4 Compatibility

- **iOS:** deployment target 18.0. `isAppleTranslationAvailable()` gates on iOS 18.0+ and the app degrades gracefully below it.
- **Android:** `minSdk 24`, `compileSdk`/`targetSdk 36`. Foreground-service microphone type requires Android 14+ behavior; notification permission is requested on Android 13+.
- Reference devices: iPhone 14 Pro Max (iOS), plus one low-end Android handset still to be nominated for the performance gate.

---

## 5. Technical Constraints

### 5.1 Actual Stack

| Component | Technology | Notes |
|-----------|-----------|-------|
| Framework | React Native 0.85, React 19.2.3, TypeScript 5.6 | Node ≥ 20 |
| STT | SenseVoice-Small int8 + Zipformer-VI int8 via `react-native-sherpa-onnx` ^0.4.2 | Bundled |
| Translation (iOS) | Apple Translation Framework | Language packs managed by iOS |
| Translation (Android) | Google ML Kit Translate 17.0.3 | Packs downloaded on demand |
| Speaker diarization | CAM++ embedding via native modules on both platforms | Bundled |
| Recap | TypeScript, rule-based | No AI/LLM |
| State | Zustand 5 | Meeting, bootstrap, settings, metrics, diarization-progress stores |
| Storage | AsyncStorage (Android) / JSON files in Documents (iOS), AES-GCM encrypted | SQLite is a planned migration |
| Navigation | Custom lightweight router in `src/app/navigation` | React Navigation 7 present as a dependency |
| i18n | i18next + react-i18next | 5 UI languages |
| TTS | Platform speech synthesizers via native modules | iOS + Android |

### 5.2 Explicitly Excluded

| Excluded | Reason |
|----------|--------|
| NLLB-600M | Crashes iPhone 14 Pro Max (~650MB RAM). CC-BY-NC license. |
| Whisper-Small | ~5× slower than SenseVoice for the same job; Vietnamese solved instead by a dedicated transducer. |
| Opus-MT on Android | Would add ~200MB to the binary and needed two-hop routing for JA/KO/ZH. ML Kit gives direct pairs at zero bundle cost. |
| Omnilingual-300M | Benchmarked at 26.77% WER on FLEURS-vi, 9× slower. Rejected. |
| `zipformer-vi-30m` | Better WER (9.51%) but CC-BY-NC-ND — cannot ship. |
| Server/backend | The meeting pipeline is on-device by design. |
| AI/LLM summarization | RAM budget and the no-cloud constraint. |

---

## 6. Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| No on-device performance numbers exist yet | Certain | High | Epic 8 — measure RTF, latency, RAM, battery on iPhone and a low-end Android before any release commitment. |
| Real-meeting WER unknown (FLEURS is clean read speech) | High | High | Collect consented internal meeting audio and re-run `bench/` against it; this is the formal go/no-go gate. |
| `zzasdf/viet_iter3_pseudo_label` license (Apache-2.0 asserted at HF metadata level only) | Medium | High | Legal confirmation pending; tracked in `bench/README.md`. Blocks release, not development. |
| First-run language-pack download breaks the "fully offline" promise in user messaging | Certain | Medium | Documented here and surfaced in the Splash and Settings copy. |
| ML Kit translation quality for JA/KO/ZH→VI unverified | Medium | Medium | Spot-check against Apple output on the same transcripts. |
| Speaker diarization degrades above ~6 speakers | Medium | Low | Documented limitation; works best with 2-4 speakers. |
| Key-value storage will not scale to long meetings | Medium | Medium | FR-045 SQLite migration; the schema is already drafted in code. |
| Android app size with bundled models | Low | Medium | Essential for offline capture; no reduction planned. |

---

## 7. Decision Log — What Changed Since v4.0 and Why

| v4.0 decision | v5.0 reality | Why |
|---------------|--------------|-----|
| Whisper-Small int8 for all 5 languages | SenseVoice-Small (EN/JA/KO/ZH) + Zipformer-VI (VI) | SenseVoice is non-autoregressive and much faster, but scored 99.71% WER on Vietnamese — unusable. Rather than pay Whisper's 5× cost for all languages, a dedicated Vietnamese transducer was benchmarked in (10.09% WER, RTF 0.025). |
| Opus-MT tiny ×4 bundled on Android, two-hop via EN | Google ML Kit Translate | Removes ~200MB from the binary and the two-hop hop-loss for JA/KO/ZH, at the cost of a one-time pack download. |
| Silero VAD | Custom energy detector with hysteresis + adaptive noise floor | The two capture paths deliver very different absolute levels (iOS AGC'd, Android unprocessed); a single VAD threshold fragmented Android sentences into 1-2 word pieces. |
| All translation offline from the first launch | One-time pack download required | Direct consequence of using platform translation engines instead of bundled models. |
| SQLite | Encrypted AsyncStorage / JSON files | Shipped the simpler store first; SQLite schema is drafted and the migration is FR-045. |
| Translate everything into Vietnamese | Target language selectable among 5 | Vietnamese-hosted meetings need outward translation, which also made VI a valid source language. |
| "NOT a voice interpreter (no TTS)" | TTS read-back implemented, off by default | Requested as an accessibility aid; the user keeps control and it never replaces the transcript. |
| Capture only while in-app | Background/locked-screen capture | Meetings outlive screen timeouts. |
| TF-IDF summarizer, action items, topic segments | Rule-based recap; action items and topic segments not built | Deterministic and explainable was the priority; FR-084/FR-085 remain open. |
| Single-language UI | 5 UI languages | Non-Vietnamese participants also use the device. |

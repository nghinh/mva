# Product Requirements Document — Meeting Voice Assistant

**Author:** nghinh  
**Date:** 2026-04-13  
**Version:** 3.0 (Offline-Only)  
**Status:** Approved

---

## 1. Executive Summary

### 1.1 Purpose

This PRD defines the requirements for **Meeting Voice Assistant (MVA)** — a mobile app that enables Vietnamese executives to understand multilingual meetings in real time by performing on-device speech recognition and translation, entirely offline with zero server dependency.

### 1.2 Problem Statement

Senior directors at Vietnamese telecom corporations frequently attend meetings with Japanese, Korean, and international partners. Language barriers cause missed context, delayed responses, and reliance on human interpreters who may not always be available. Existing translation apps require internet connectivity, introduce privacy risks by sending meeting audio to cloud servers, and suffer from network-dependent latency.

### 1.3 Solution Overview

MVA runs entirely on the user's smartphone with no internet connection required:
- **On-device Speech-to-Text**: Captures room audio and transcribes speech in English, Japanese, or Korean using SenseVoice model via `react-native-sherpa-onnx`
- **On-device Translation**: Translates transcribed text to Vietnamese using NLLB-600M model via ONNX Runtime Mobile
- **2-lane UI**: Displays original transcript and Vietnamese translation side-by-side in real time

All processing happens on-device. No audio or text ever leaves the phone.

### 1.4 What This Product Is NOT

- NOT a conferencing/video-call app (no WebRTC, no LiveKit)
- NOT a cloud-connected service (no API calls, no server)
- NOT an AI assistant (no LLM, no response suggestions)
- NOT a voice interpreter (no text-to-speech output)

### 1.5 Success Metrics

| Metric | Target |
|--------|--------|
| STT Word Error Rate (quiet room) | ≤ 15% across EN/JA/KO |
| Translation display latency | ≤ 2s from end-of-speech |
| App cold start (model loaded) | ≤ 8s on flagship 2024+ |
| Battery drain per hour | ≤ 6% on flagship device |
| App crash rate | < 0.5% per session |
| User satisfaction (internal beta) | ≥ 4.0/5.0 |

---

## 2. Target User & Use Cases

### 2.1 Primary Persona

**Nghi, 42, Director of Digital Solution Center**
- Attends 3-5 international meetings per week with Japanese and Korean partners
- Places personal phone on meeting table to capture room audio
- Glances at phone screen periodically to read translations
- Needs privacy — meeting content must never leave the device
- Travels frequently — cannot rely on corporate network availability

### 2.2 Use Cases

| ID | Use Case | Description |
|----|----------|-------------|
| UC-01 | Live meeting translation | Phone captures room audio, transcribes EN/JA/KO speech, translates to Vietnamese in real time |
| UC-02 | Offline operation | App works identically with WiFi off, airplane mode on, or in areas with no connectivity |
| UC-03 | Meeting review | After meeting, user scrolls through transcript + translations to review discussion points |
| UC-04 | Transcript export | User exports meeting transcript (original + translation) as text file for sharing |

---

## 3. Functional Requirements

### 3.1 Audio Capture

| ID | Title | Priority | Description | Acceptance Criteria |
|----|-------|----------|-------------|-------------------|
| FR-001 | Microphone capture | Must | Capture audio at 16kHz mono PCM via native audio APIs. Audio stays in native layer, never crosses JS bridge. | Given mic permission granted, when speech is present, then PCM chunks are delivered to STT engine within 80ms. |
| FR-002 | Background capture | Must | Audio capture continues while user scrolls history or changes settings (app in foreground). | Given active session, when user navigates within app, then transcription continues uninterrupted. |
| FR-003 | Audio privacy | Must | Raw audio is never stored to disk, never transmitted over network. Audio exists only in memory buffer during processing. | Given any app state, when inspecting device storage and network traffic, then zero audio data is found. |

### 3.2 Speech-to-Text

| ID | Title | Priority | Description | Acceptance Criteria |
|----|-------|----------|-------------|-------------------|
| FR-010 | Streaming STT | Must | On-device streaming speech-to-text using `react-native-sherpa-onnx` with SenseVoice-Small int8 model. | Given model loaded, when speaker talks in EN/JA/KO, then partial text appears within 300ms of speech onset. |
| FR-011 | Partial results | Must | STT emits partial (intermediate) transcriptions every ~300ms while speech is ongoing. | Given active speech, when 300ms elapses, then updated partial text is emitted to JS layer. |
| FR-012 | Final results | Must | When VAD detects end-of-utterance (silence > 600ms), STT emits final transcription. | Given speaker finishes sentence, when 600ms silence detected, then final text is emitted and marked as complete. |
| FR-013 | Language detection | Must | STT auto-detects source language (EN/JA/KO) per utterance and includes language code in result. | Given speech in Japanese, when STT emits result, then `lang: "ja"` is included with ≥ 95% accuracy for utterances ≥ 3 words. |
| FR-014 | VAD | Must | Voice Activity Detection filters silence, only processing speech segments. | Given room noise without speech, when VAD processes audio, then no false STT results are emitted. |

### 3.3 Translation

| ID | Title | Priority | Description | Acceptance Criteria |
|----|-------|----------|-------------|-------------------|
| FR-020 | On-device translation | Must | Translate STT output to Vietnamese using NLLB-200-distilled-600M (int8 ONNX) running on-device via ONNX Runtime Mobile. | Given final STT result "The quarterly report shows growth", when translation runs, then Vietnamese text appears within 2 seconds. |
| FR-021 | Supported language pairs | Must | EN→VI, JA→VI, KO→VI using NLLB language codes: `eng_Latn`, `jpn_Jpan`, `kor_Hang` → `vie_Latn`. | Given speech in any of the 3 source languages, when translated, then Vietnamese output is produced with BLEU ≥ 20 on FLORES-200. |
| FR-022 | Partial translation | Should | When STT partial result reaches ≥ 5 words, translate on-device immediately without waiting for final result. | Given partial STT with 6 words, when translation runs, then partial Vietnamese text appears with "draft" indicator. |
| FR-023 | Translation cancellation | Must | If new STT result arrives while previous translation is still running, cancel previous and start new. | Given translation in progress, when new STT final arrives, then old translation is cancelled and new one starts within 50ms. |

### 3.4 User Interface

| ID | Title | Priority | Description | Acceptance Criteria |
|----|-------|----------|-------------|-------------------|
| FR-030 | Two-lane layout | Must | Main screen displays two vertically stacked lanes: (1) Original Transcript with language badge, (2) Vietnamese Translation. Each lane scrolls independently. | Given active meeting, when speech is transcribed and translated, then both lanes update independently at 60fps. |
| FR-031 | Language badge | Must | Each transcript entry shows a language badge (EN/JA/KO) that updates per utterance. | Given Japanese speech detected, when displayed, then "JA" badge appears in red next to the text. |
| FR-032 | Auto-scroll | Must | Both lanes auto-scroll to latest entry. Manual scroll pauses auto-scroll; "Jump to latest" button appears. | Given user scrolls up, when new entry arrives, then auto-scroll pauses and jump button appears. |
| FR-033 | Session controls | Must | Start/Stop Meeting button with recording indicator (pulsing dot + elapsed time). | Given user taps Start, then recording dot pulses, timer starts, and STT begins processing. |
| FR-034 | Draft indicator | Should | Partial/speculative translations show with lower opacity and "draft" label, replaced when final translation arrives. | Given partial translation displayed, when final translation arrives, then text smoothly replaces draft. |

### 3.5 Session Management

| ID | Title | Priority | Description | Acceptance Criteria |
|----|-------|----------|-------------|-------------------|
| FR-040 | Session persistence | Must | Each meeting session (original text + translations + timestamps) is saved locally on device. | Given meeting ends, when user opens app later, then full session history is available. |
| FR-041 | Session list | Must | Home screen shows list of past sessions with date, duration, language breakdown. | Given 5 past sessions exist, when viewing home screen, then all 5 are listed with metadata. |
| FR-042 | Transcript export | Should | Export session as `.txt` file with timestamps, original text, and translations. | Given completed session, when user taps Export, then shareable text file is generated. |
| FR-043 | Session delete | Must | User can delete individual sessions or all data. | Given user deletes session, when confirmed, then all associated data is permanently removed. |

### 3.6 Model Management

| ID | Title | Priority | Description | Acceptance Criteria |
|----|-------|----------|-------------|-------------------|
| FR-050 | First-launch download | Must | On first launch, download STT model (~234MB) and Translation model (~800MB) with progress indicator. | Given first launch with internet, when download starts, then progress bar shows per-model status. |
| FR-051 | Model caching | Must | Downloaded models are cached locally. Subsequent launches load from cache without re-download. | Given models cached, when app launches offline, then models load from local storage. |
| FR-052 | Model warm-up | Must | After model load, run dummy inference to warm up ONNX Runtime. First real utterance should not have cold-start penalty. | Given models loaded, when first real speech occurs, then latency matches subsequent utterances (no >200ms extra). |
| FR-053 | Storage management | Should | Settings shows model storage usage. User can delete models to free space. | Given settings open, when viewing storage, then total model size and free space are displayed. |

### 3.7 Settings

| ID | Title | Priority | Description | Acceptance Criteria |
|----|-------|----------|-------------|-------------------|
| FR-060 | Target language | Should | Select target translation language (default: Vietnamese). Future-ready for other targets. | Given settings open, when changing target language, then subsequent translations use new target. |
| FR-061 | STT model selection | Could | Choose between STT models if multiple are downloaded (SenseVoice, Whisper). | Given 2 models downloaded, when user selects one, then STT uses selected model. |
| FR-062 | Dev mode | Could | Toggle developer mode showing real-time metrics: STT latency, translation latency, RAM usage. | Given dev mode on, when meeting active, then metrics overlay appears with live numbers. |

---

## 4. Non-Functional Requirements

### 4.1 Performance

| ID | Metric | Target | Maximum |
|----|--------|--------|---------|
| NFR-001 | STT partial latency | 200ms | 400ms |
| NFR-002 | STT final latency | 200ms | 400ms |
| NFR-003 | Translation latency (on-device) | 500ms | 2,000ms |
| NFR-004 | Total end-to-end (speech → translation displayed) | 800ms | 2,500ms |
| NFR-005 | UI frame rate | 60fps | 30fps minimum |
| NFR-006 | App cold start (with model load) | 5s | 8s |
| NFR-007 | RAM usage (all models loaded) | 1.2GB | 1.8GB |
| NFR-008 | Model download (total, compressed) | 800MB | 1.2GB |
| NFR-009 | Battery drain per hour | 4% | 6% |

### 4.2 Privacy & Security

| ID | Requirement |
|----|-------------|
| NFR-010 | Zero network transmission — no audio, text, or metadata is ever sent over any network. App functions identically in airplane mode. |
| NFR-011 | No telemetry or analytics — no crash reporting, usage tracking, or any data collection. |
| NFR-012 | Local storage encryption — saved sessions encrypted using platform keychain (iOS Keychain / Android Keystore). |
| NFR-013 | No third-party SDKs with network access — only offline-capable libraries permitted. |

### 4.3 Compatibility

| ID | Requirement |
|----|-------------|
| NFR-020 | Android 10+ (API 29) with ≥ 6GB RAM |
| NFR-021 | iOS 15+ with A14 chip or later (iPhone 12+) |
| NFR-022 | Minimum 2GB free storage for models |

---

## 5. Technical Constraints

### 5.1 Fixed Stack

| Component | Technology | Notes |
|-----------|-----------|-------|
| Framework | React Native 0.76+ (New Architecture) | TurboModules required |
| STT | react-native-sherpa-onnx v0.3.3+ | Existing, no custom native code for STT |
| STT Model | SenseVoice-Small int8 (~234MB) | Auto-detect EN/JA/KO |
| Translation | ONNX Runtime Mobile + custom TurboModule | New native module required |
| Translation Model | NLLB-200-distilled-600M int8 ONNX (~800MB) | Split encoder/decoder with KV cache |
| State | Zustand | Lightweight |
| Local DB | SQLite (via expo-sqlite or op-sqlite) | Session persistence |

### 5.2 Explicitly Excluded

| Excluded | Reason |
|----------|--------|
| Any server/backend | 100% offline requirement |
| WebSocket/HTTP | No network communication |
| Cloud APIs (Google, AWS, etc.) | Privacy + offline |
| AI/LLM suggest | Removed from scope — STT + Translation only |
| LiveKit / WebRTC | Not a conferencing app |
| Text-to-Speech output | Out of scope for v1 |

---

## 6. Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| NLLB-600M translation quality KO→VI is poor | Medium | High | Benchmark BLEU on FLORES-200 in week 1. If BLEU < 18, try two-hop KO→EN→VI. |
| Total RAM (STT + Translation) exceeds device limit | Medium | High | Target ~1.2GB total. Test on devices with 6GB RAM. Unload STT model during translation if needed. |
| Translation latency > 2s on mid-range devices | High | Medium | Use greedy decoding (not beam search). Limit max_length=128. Use NNAPI/CoreML EP. |
| Cross-talk degrades STT accuracy | High | Medium | Document as known limitation. App works best with turn-taking speakers. |
| Model download >1GB deters users | Medium | Low | Support resume-from-offset. Allow pre-loading via USB/ADB for corporate provisioning. |
| react-native-sherpa-onnx becomes unmaintained | Low | High | Fork at v0.3.3 as baseline. Apache 2.0 license allows forking. |

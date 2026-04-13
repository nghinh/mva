# Story 2.2: Capture microphone audio continuously in the native layer

Status: ready-for-dev

## Story

As a developer,
I want continuous microphone audio captured at 16kHz mono in the native layer,
so that audio is available for STT without crossing the React Native bridge.

## Acceptance Criteria

1. **Given** a meeting session is active
   **When** audio is being captured
   **Then** PCM audio at 16kHz, mono, 16-bit is delivered in 80ms chunks to the sherpa-onnx native pipeline.
2. **Given** audio is flowing
   **When** the audio pipeline is inspected
   **Then** zero audio data crosses the React Native JS bridge — only text results are emitted to JS.
3. **Given** the app has microphone permission
   **When** capture starts
   **Then** audio latency from mic to STT input is ≤100ms.

## Tasks / Subtasks

- [ ] Configure audio capture via react-native-sherpa-onnx (AC: 1, 2)
  - [ ] Set sample rate 16000Hz, mono channel, 16-bit PCM.
  - [ ] Chunk size: 1280 samples (80ms at 16kHz).
  - [ ] Audio stays in native C++ layer — only text events emit to JS via TurboModule bridge.
- [ ] Handle audio session configuration per platform (AC: 1, 3)
  - [ ] Android: AudioRecord with VOICE_RECOGNITION source.
  - [ ] iOS: AVAudioSession with `.record` category, `.measurement` mode.
- [ ] Verify audio never persists to storage (AC: 2)
  - [ ] Audio exists only in native memory ring buffer.
  - [ ] No temp files, no audio logging, no recording to disk.

## Dev Notes

- Audio pipeline is handled entirely by react-native-sherpa-onnx. No custom native audio code needed. [Source: {ARCH_REF}#STT Component]
- Privacy requirement: raw audio never leaves native memory, never stored, never transmitted. [Source: {PRD_REF}#FR-003]

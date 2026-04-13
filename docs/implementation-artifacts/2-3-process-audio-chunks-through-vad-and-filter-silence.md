# Story 2.3: Process audio chunks through VAD and filter silence

Status: ready-for-dev

## Story

As a user,
I want background noise and silence filtered out automatically,
so that I only see transcriptions of actual speech.

## Acceptance Criteria

1. **Given** room audio with periods of silence and noise
   **When** VAD processes audio chunks
   **Then** only chunks containing speech are forwarded to the STT decoder.
2. **Given** Silero VAD is configured
   **When** speech onset is detected
   **Then** detection occurs within 30ms of actual speech start.
3. **Given** a speaker pauses for >600ms
   **When** VAD detects end-of-speech
   **Then** the current utterance is finalized and a new utterance boundary is created.

## Tasks / Subtasks

- [ ] Configure Silero VAD via react-native-sherpa-onnx (AC: 1, 2)
  - [ ] VAD chunk size: 32ms (512 samples at 16kHz).
  - [ ] Speech detection threshold: configurable, default 0.5.
  - [ ] Min speech duration: 250ms (reject very short noise bursts).
- [ ] Implement utterance boundary detection (AC: 3)
  - [ ] End-of-speech silence threshold: 600ms (configurable).
  - [ ] When silence exceeds threshold, emit final result for current utterance.
  - [ ] Reset utterance state for next speech segment.
- [ ] Test with meeting room audio samples (AC: 1, 2, 3)
  - [ ] Test with ambient office noise (AC, keyboard, fan).
  - [ ] Test with cross-talk (multiple speakers).
  - [ ] Verify no false positives from non-speech sounds.

## Dev Notes

- Silero VAD is bundled with sherpa-onnx. No separate model download needed. [Source: {ARCH_REF}#STT Component]
- VAD is critical for battery efficiency — STT decoder only processes speech segments, not continuous audio. [Source: {PRD_REF}#NFR-009]

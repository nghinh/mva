# Story 3.5: Implement translation cancellation and concurrency control

Status: ready-for-dev

## Story

As a developer,
I want translation requests to be cancellable and non-overlapping,
so that the app responds to the latest speech without wasting CPU on stale translations.

## Acceptance Criteria

1. **Given** a translation is in progress for utterance A
   **When** a new STT final arrives for utterance B
   **Then** utterance A's translation is cancelled (if still running) and utterance B's translation starts immediately.
2. **Given** rapid speech with short sentences
   **When** multiple STT finals arrive within 1 second
   **Then** translations are queued and processed sequentially — no two NLLB inferences run simultaneously.
3. **Given** a translation is cancelled mid-inference
   **When** the partial ONNX output is discarded
   **Then** no memory leaks occur and ONNX Runtime session remains in a valid state.

## Tasks / Subtasks

- [ ] Implement cancellation via version counter (AC: 1, 3)
  - [ ] Maintain `currentTranslationVersion: number` in OnDeviceTranslator service.
  - [ ] Before starting inference, increment version. After inference, check if version still matches. If not, discard result.
  - [ ] Ensure ONNX session is not corrupted by discarding mid-inference output.
- [ ] Implement sequential translation queue (AC: 2)
  - [ ] Use a simple FIFO queue with one active inference at a time.
  - [ ] New requests cancel the current one (if still running) and jump to front of queue.
  - [ ] Queue drains automatically.
- [ ] Stress test with rapid speech simulation (AC: 1, 2, 3)
  - [ ] Feed 10 STT finals in 5 seconds and verify only latest translations are rendered.
  - [ ] Monitor RAM to verify no leaks from cancelled inferences.

## Dev Notes

- ONNX Runtime sessions are thread-safe for single-inference-at-a-time. Do not attempt concurrent inferences on the same session. [Source: {ARCH_REF}#Component Architecture]
- STT and NLLB share device CPU. STT runs continuously; NLLB runs on-demand. No explicit contention management needed because STT partials are ~300ms apart, giving NLLB gaps to work in. [Source: {ARCH_REF}#Pipeline Orchestrator]

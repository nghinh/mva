# Story 2.4: Emit streaming partial transcript during active speech

Status: ready-for-dev

## Story

As a user,
I want to see words appearing in real time as someone speaks,
so that I can follow the conversation without waiting for the speaker to finish.

## Acceptance Criteria

1. **Given** a speaker is actively talking
   **When** 300ms of speech has been processed
   **Then** a partial transcript result is emitted to the JS layer with the current best-guess text.
2. **Given** partial results are being emitted
   **When** the speaker continues talking
   **Then** partial text updates approximately every 300ms, progressively refining the transcription.
3. **Given** partial text is displayed in the Transcript Lane
   **When** the partial updates
   **Then** text replacement occurs smoothly at 60fps with no visible jank.

## Tasks / Subtasks

- [ ] Configure streaming partial emission from sherpa-onnx (AC: 1, 2)
  - [ ] Set partial result callback interval to ~300ms.
  - [ ] Each partial includes: text, detected language, is_final=false, timestamp.
  - [ ] Emit via TurboModule event to JS layer.
- [ ] Update Zustand store with partial results (AC: 2, 3)
  - [ ] Create/update "current utterance" in conversation store.
  - [ ] Mark as `isFinal: false` so UI renders with streaming indicator.
- [ ] Trigger on-device partial translation when threshold met (AC: 1)
  - [ ] When partial text reaches ≥5 words (EN) or ≥12 grapheme clusters (JA/KO), trigger on-device NLLB translation.
  - [ ] Translation runs in background thread, does not block STT or UI.
- [ ] Optimize rendering for rapid partial updates (AC: 3)
  - [ ] Use React.memo / useMemo for TranscriptLane entries.
  - [ ] Batch state updates to avoid excessive re-renders.

## Dev Notes

- Partial → Translation trigger is now on-device (no server). Latency budget: STT partial in ~300ms + translation in ~500-1500ms = total ~800-1800ms from speech onset. [Source: {ARCH_REF}#Latency Budget]
- Only text results cross the TurboModule bridge. Audio stays in native C++. [Source: {ARCH_REF}#STT Component]

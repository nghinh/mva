# Project Context

**Last reconciled with the code:** 2026-08-17, commit `9a6ecf1`

This replaces the auto-generated placeholder. It is the orientation document for
anyone — human or agent — about to touch this repository.

## What This Is

**Meeting Voice Assistant (MVA)** — a React Native app that transcribes,
translates, and attributes multilingual meetings on the device, for Vietnamese
executives meeting Japanese, Korean, Chinese, and international partners.

The product exists because the alternative — cloud meeting tools — means sending
confidential meeting audio to a third party. Everything here follows from that
constraint.

## Repository Layout

| Path | Contents |
|------|----------|
| `mobile/` | The React Native app — all production code |
| `bench/` | Phase 0 STT benchmark harness (Python), with results |
| `docs/planning-artifacts/` | PRD, architecture, epics, UX spec |
| `docs/implementation-artifacts/` | Story catalog (38 files + reconciled index) |
| `_bmad/`, `vnpt-bmad-custom/` | BMAD agent bundle and VNPT customizations |

## Source of Truth, in Order

1. **The code**, at `mobile/src` and the native modules.
2. `docs/planning-artifacts/architecture.md` (v5.0) and `prd.md` (v5.0) — both reconciled against the code on 2026-08-17.
3. `docs/implementation-artifacts/index.md` — the reconciled story status.
4. **Individual story files** — written against architecture v4.0 and partly stale. The index marks which ones describe reversed decisions. Never implement from a story file marked 🔴.
5. `docs/planning-artifacts/ux-design-specification.md` — **not yet reconciled**; still describes the v4.0 product.

## What a New Contributor Gets Wrong

These are the traps, in the order people fall into them:

1. **"It uses Whisper."** It does not. SenseVoice-Small handles EN/JA/KO/ZH; a
   separate Zipformer-VI transducer handles Vietnamese, selected in Settings.
2. **"Android uses Opus-MT."** It uses Google ML Kit Translate. The Opus-MT plan
   was reversed; `scripts/prepare_opus_mt_android.py` at the repo root is a leftover.
3. **"Everything is in SQLite."** Storage is encrypted key-value — AsyncStorage on
   Android, JSON files on iOS. The SQLite schema exists only as a comment in
   `mobile/src/services/persistence/index.ts`, as the migration target.
4. **"It's fully offline, always."** Meetings are offline. *Setup* is not:
   translation language packs download once, and Android declares `INTERNET`
   for exactly that.
5. **"`MeetingPipeline` is the live path."** It is not. `RealSpeechRecognizer` is
   what runs during a meeting; `MeetingPipeline` + `VADProcessor` are the
   simulator path used by tests.
6. **"`model_manager` downloads models."** It is a mock with no callers. Models
   are bundled and installed by `BundledModelInstaller`.
7. **"Silero VAD filters silence."** Speech detection is energy-based with
   platform-specific thresholds. Do not "fix" the Android constants to match iOS —
   the two capture paths deliver different absolute levels, and that asymmetry is
   deliberate. See `architecture.md` ADR-007.

## Model Assets

Model binaries are gitignored. A fresh clone has folder structure and READMEs but
no `.onnx` files. `mobile/scripts/copy-required-model-assets.js` downloads the
archives from the sherpa-onnx releases and is wired into the Xcode build phase, so
an iOS build fetches them automatically. For Android, place them under
`mobile/android/app/src/main/assets/models/`.

## Project State

Feature-complete for a demo; **not validated for release.**

No performance or accuracy number in the documentation has been measured on a
phone. The one real measurement is Vietnamese WER of 10.09% (Zipformer-VI,
FLEURS-vi, 200 utterances) — and FLEURS is clean read speech, an optimistic upper
bound by construction. The formal go/no-go gate is WER on consented real meeting
audio, and it has not been run. Epic 8 in `epics.md` tracks all of this.

One release blocker is legal, not technical: the Zipformer-VI training-data
license (`zzasdf/viet_iter3_pseudo_label`) is asserted as Apache-2.0 at Hugging
Face metadata level only, and needs confirmation.

## Working Rules

- Follow the active story and the reconciled architecture document. When they
  disagree, the architecture document wins, and say so in the PR.
- Keep the no-network guarantee for the meeting path. Any new dependency that can
  reach the network during a meeting is a design change, not an implementation
  detail.
- Audio never touches disk. It lives in memory for the length of one utterance and
  is dropped once the speaker embedding is extracted.
- Diarization, recap, and TTS are all non-fatal. A failure in any of them must
  leave the transcript and translation working.
- When you change a threshold, a model, or a storage key, update
  `architecture.md` in the same change. This repository has been through one
  documentation drift already.

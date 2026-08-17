# VibeVoice — Meeting Voice Assistant (mobile app)

The React Native app. `vibevoice` is the internal package name; the product is Meeting Voice Assistant (MVA).

For product and architecture context, start at [`../docs/project-context.md`](../docs/project-context.md).

## Stack

| Layer | Choice |
|-------|--------|
| Framework | React Native 0.85 (bare — **not** Expo), React 19.2.3, TypeScript 5.6 |
| Navigation | Custom lightweight router in `src/app/navigation/` — React Navigation 7 is a dependency but does not drive routing |
| State | Zustand 5 |
| i18n | i18next + react-i18next — VI / EN / JA / KO / ZH |
| Inference | `react-native-sherpa-onnx` ^0.4.2 |
| Storage | AsyncStorage (Android) / `@dr.pogodin/react-native-fs` JSON files (iOS), AES-GCM encrypted |
| Native | Swift + Objective-C on iOS, Kotlin on Android |

Node ≥ 20. iOS deployment target 18.0. Android `minSdk 24`, `compileSdk`/`targetSdk 36`.

## Project structure

```
mobile/
├── src/
│   ├── app/navigation/       # RootNavigator + router
│   ├── features/
│   │   ├── bootstrap/        # Splash: model install, pack setup, readiness
│   │   ├── meeting/          # Meeting screen, useMeetingSession orchestrator
│   │   ├── history/          # Session list, review, recap, exporters
│   │   ├── models/           # Bundled model repository screen
│   │   └── settings/         # Settings screen
│   ├── native/
│   │   ├── stt/              # RealSpeechRecognizer (live), MeetingPipeline (simulator)
│   │   ├── vad/              # VADProcessor — simulator path only
│   │   ├── speaker/          # Embedding + offline diarization bridges
│   │   ├── models/           # bundledModels, BundledModelInstaller
│   │   ├── tts/              # NativeTTSSpeaker
│   │   ├── backgroundRecording/
│   │   └── model_manager/    # dead code — mock download interface, no callers
│   ├── services/             # TranslationService, persistence, clustering, TTS
│   ├── shared/               # store, theme, ui components, utils, config
│   └── i18n/
├── assets/models/            # model source of truth (binaries gitignored)
├── scripts/copy-required-model-assets.js
├── ios/                      # native modules + VibeVoiceNative Xcode project
└── android/                  # native modules + foreground service
```

## Running

```bash
npm install
npm run start            # Metro
npm run ios              # iOS debug
npm run ios:release      # iOS release
npm run android          # Android debug
npm run build:android:release
```

### iOS setup

Run once after cloning, or after any iOS dependency change:

```bash
npm ci
npm run ios:pods
npm run ios:open
```

Build from `ios/VibeVoiceNative.xcworkspace`, **not** `ios/VibeVoiceNative.xcodeproj` — the workspace carries the CocoaPods project and the generated `Pods/Target Support Files` configs Xcode needs.

TestFlight and device-build specifics: [`ios/BUILD-TESTFLIGHT.md`](ios/BUILD-TESTFLIGHT.md).

For a physical device on the LAN:

```bash
npm run start:lan
npm run ios:device       # runs sync-metro-host.js first
```

## Quality checks

```bash
npm run lint
npm run typecheck
npm test
```

Test coverage is thin — 9 test files. Anything you touch is worth a test.

## Model assets

Model `.onnx` binaries are gitignored. `scripts/copy-required-model-assets.js` downloads the archives from the sherpa-onnx releases when they are missing, and the Xcode build phase invokes it automatically, so an iOS build is self-sufficient. For Android, put the model folders under `android/app/src/main/assets/models/`.

At runtime `BundledModelInstaller` copies the model folders out of the app bundle into `Documents/models/` (excluded from iCloud backup on iOS) and every engine loads from there.

| Folder | Purpose |
|--------|---------|
| `sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17` | STT auto mode — EN/JA/KO/ZH |
| `sherpa-onnx-zipformer-vi-int8-2025-04-20` | STT Vietnamese mode |
| `speaker-diarization` | Segmentation placeholder + CAM++ embedding |

Keep the folder names in `src/native/models/bundledModels.ts` and in `scripts/copy-required-model-assets.js` in sync — they are duplicated by design and drift silently.

## Things worth knowing before you edit

- **`RealSpeechRecognizer` is the live STT path.** `MeetingPipeline` + `VADProcessor` + `AudioCaptureSimulator` are the simulator path used by tests. Do not assume a change to one affects the other.
- **Speech detection is energy-based**, with deliberately different thresholds per platform — iOS receives AGC'd audio, Android receives unprocessed audio. Aligning them breaks Android end-of-utterance detection. See `architecture.md` ADR-007.
- **`src/native/model_manager/` is dead code** — a download interface with a mock implementation and no callers. Models are bundled.
- **Storage is key-value, not SQLite.** The SQLite schema in the header of `src/services/persistence/index.ts` is the migration target, not the current state.
- **Diarization, recap, and TTS must stay non-fatal.** A failure in any of them has to leave transcript and translation working.
- Two theme locations exist: `src/shared/theme/` (tokens) and `src/shared/constants/theme.ts`. Check which one a component uses before editing.

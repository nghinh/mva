# MVA (VibeVoice)

![Platform](https://img.shields.io/badge/platform-iOS%20%7C%20Android-111827)
![React Native](https://img.shields.io/badge/React%20Native-0.85-61DAFB)
![React](https://img.shields.io/badge/React-19-149ECA)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6)
![License](https://img.shields.io/badge/license-MIT-green)

Mobile voice assistant for multilingual meetings.
Private, offline-first, and built for teams that need fast transcription, translation, and post-meeting review directly on device.

## Overview

MVA is a mobile product for capturing and understanding conversations in multilingual meetings.
It focuses on a local-first workflow: record what matters, turn speech into structured meeting content, translate across languages, and make the session easy to review afterward.

Unlike many meeting tools that depend heavily on cloud-only pipelines, MVA explores a more privacy-aware approach with on-device AI workflows, native mobile UX, and local model lifecycle management.

## Why MVA is interesting

- Built for multilingual meeting scenarios
- Offline-first product direction
- On-device speech workflow integration
- React Native app with native iOS bridges
- Local AI model management inside mobile UX
- Release build already validated on a physical iPad

## Core capabilities

### Live meeting workspace
- Live transcript lane
- Translation lane
- Meeting status bar
- Active session state handling

### Session history and review
- Browse saved sessions
- Review transcripts after meetings
- Generate recap content
- Export transcript artifacts

### Local AI model lifecycle
- Browse available models
- Download and cache models
- Track readiness and progress
- Remove local assets when needed

### Startup readiness flow
- Bootstrap checks for app state
- Prewarm visibility
- Server connectivity status
- Actionable degraded and failure states

## Product highlights

- Mobile-first experience
- Privacy-aware local-first direction
- On-device speech-to-text pipeline
- Real-time translation flow
- Meeting review workflow
- Native iOS integration points
- Model management UX built into app

## App screens

- Splash / bootstrap readiness
- Meeting screen
- History list
- Session review
- Model repository
- Settings

## Screenshots and demo

Add real product media here to make repository more compelling.

```text
README assets suggestion:
- docs/media/meeting-screen.svg
- docs/media/session-review.svg
- docs/media/model-repository.svg
- docs/media/demo.svg
```

| Meeting | Review | Models |
|---|---|---|
| ![Meeting screen](docs/media/meeting-screen.svg) | ![Session review](docs/media/session-review.svg) | ![Model repository](docs/media/model-repository.svg) |

![Demo GIF](docs/media/demo.svg)

## Tech stack

- React Native 0.85
- React 19
- TypeScript
- React Navigation 7
- TanStack Query 5
- Zustand
- Swift / Objective-C bridge on iOS
- `react-native-sherpa-onnx` for on-device inference integration

## Repository structure

```text
.
└── mobile/
    ├── src/
    │   ├── app/
    │   ├── features/
    │   │   ├── bootstrap/
    │   │   ├── history/
    │   │   ├── meeting/
    │   │   ├── models/
    │   │   └── settings/
    │   ├── native/
    │   └── shared/
    ├── ios/
    └── android/
```

## Quick start

### Requirements
- Node.js 20+
- Xcode for iOS
- Android Studio for Android
- CocoaPods for iOS dependencies

### Install and start

```bash
cd mobile
npm install
npm run start
```

### Run on iOS

```bash
cd mobile
npm run ios
```

### Run iOS release build

```bash
cd mobile
npm run ios:release
```

### Run on Android

```bash
cd mobile
npm run android
```

### Build Android release

```bash
cd mobile
npm run build:android:release
```

## Quality checks

```bash
cd mobile
npm run lint
npm run typecheck
npm test
```

## Notes for cloning

Large local model artifacts and machine-specific files are intentionally excluded from git history.
If you want full offline AI flows, prepare local model assets separately after cloning.

## Who this repo is for

This repo is a good fit for:
- Engineers exploring on-device AI on mobile
- Product teams prototyping multilingual meeting assistants
- Developers learning React Native plus native bridge integration
- Builders interested in privacy-aware speech products

## Roadmap

- Better diarization UX
- Richer meeting summaries
- More export formats
- Easier model setup
- Stronger Android and iPad production polish

## Contributing

Issues and pull requests are welcome.


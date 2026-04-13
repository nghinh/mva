# VibeVoice - Meeting Voice Assistant

A mobile AI assistant for enterprise multilingual meetings.

## Project Overview

VibeVoice is a React Native (Expo) application that provides:
- On-device speech-to-text transcription
- Real-time translation
- AI-powered meeting assistance
- Offline-first operation

## Architecture

This project follows the architecture defined in `/docs/planning-artifacts/architecture.md`.

### Key Technologies

- **Expo SDK 52** with file-based routing
- **React Navigation 7** for navigation
- **TanStack Query 5** for server state
- **Zustand 4** for UI state
- **TypeScript** for type safety

### Project Structure

```
mobile/
├── src/
│   ├── app/              # App entry point and navigation
│   ├── features/         # Feature modules
│   │   ├── bootstrap/    # Splash/initialization screens
│   │   ├── models/       # Model management screens
│   │   └── settings/     # Settings screens
│   ├── native/           # Native module interfaces
│   │   └── model_manager/
│   └── shared/           # Shared code
│       ├── components/ui/ # Reusable UI components
│       ├── constants/    # Theme and constants
│       ├── store/        # Zustand stores
│       └── types/        # TypeScript types
├── assets/               # Images and fonts
├── App.tsx               # Expo Router entry
└── package.json
```

## Epic 1: Bootstrap/Model UX Slice

This implementation covers Stories 1-2, 1-3, and 1-4:

### Story 1-2: Secure App Bootstrap and Startup Readiness Flow
- Splash/initialization screen with model, pre-warm, and server status
- Combined readiness orchestration via Zustand store
- Actionable failure and degraded states

### Story 1-3: Model Download, Cache, and Local Lifecycle Management
- Model repository screen with available models
- Download progress visualization
- Delete functionality with confirmation

### Story 1-4: Pre-warm the STT Model
- Pre-warm state tracking in bootstrap store
- Integration with splash screen readiness display

## Components

### Reusable UI Components

- `ReadinessStatus` - Shows readiness state for model/prewarm/server
- `ProgressCard` - Model download progress display
- `ModelCard` - Model information and actions
- `ServerSettingsForm` - Server URL configuration

### State Management

- `useBootstrapStore` - Zustand store for bootstrap state
  - `model` - Model state (status, currentModel, downloadProgress)
  - `prewarm` - Pre-warm state (status, startedAt, completedAt)
  - `server` - Server state (status, url, latencyMs)

## Running the App

```bash
cd mobile
npm install
npm start
```

## Development Notes

- Mock data/state is used where real backend/native integration is not yet available
- State is shaped for model, prewarm, and server readiness
- Dark mode first, executive product tone

## Design Tokens

See `/mobile/src/shared/constants/theme.ts` for the complete design system including:
- Color palette (dark mode primary)
- Typography scale
- Spacing scale
- Border radius
- Shadow definitions

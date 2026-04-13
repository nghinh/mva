# bmad-vnpt-mobile-react

BMAD custom package for React Native / Expo mobile work.

Default stance:
- Expo-first for new VNPT mobile apps
- TypeScript-first
- Expo Router for Expo projects
- React Navigation-compatible patterns when working in bare React Native or non-router projects
- TanStack Query for server state
- Zustand for small-to-medium client UI state
- SecureStore for encrypted secrets on Expo projects
- AsyncStorage only for non-sensitive preferences/cache
- Hermes / New Architecture aware
- Testing-first with Jest + React Native Testing Library, with optional Detox/Maestro style E2E based on repo choice

Package contents:
- OpenCode command: `bmad-vnpt-mobile-react`
- Skill: `.opencode/skills/bmad-vnpt-mobile-react`
- Workflow registration under `src/workflows/`
- Templates, scripts, and an Expo-style skeleton

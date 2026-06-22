# Android TTS Voice Output — Design Spec

**Date:** 2026-06-22  
**Status:** Approved  
**Scope:** Port iOS "Đầu ra giọng nói" (Voice Output) feature to Android

---

## Context

The app currently has a TTS (Text-to-Speech) feature that reads translated text aloud through earphones. It is implemented for iOS only (`TTSSpeakerModule.swift` + `AVSpeechSynthesizer`) and is hidden on Android via a `Platform.OS === 'ios'` guard in `SettingsScreen.tsx:361`.

This spec covers porting the feature to Android using a custom Kotlin native module, mirroring the iOS implementation as closely as possible.

No existing documentation covers this feature (the original PRD explicitly excluded TTS; it was added to iOS post-scope).

---

## Goals

- Android users can enable "Đọc bản dịch to" in Settings, identical to iOS
- TTS plays through earphones during active meetings without dropping mic frames
- If the device lacks a Vietnamese voice pack, the app prompts the user to install it
- All UI text is translated across all 5 supported UI languages (EN, JA, KO, VI, ZH)

---

## Architecture

### Data Flow (identical to iOS)

```
useTTSSpeaker.ts
    → TTSService.speak(text, lang, rate)
        → NativeTTSSpeaker.speakText()
            → TTSSpeakerModule.kt
                → TextToSpeech (queue → speak)
                    → UtteranceProgressListener
                        → emit "tts_started" / "tts_finished"
                            → useTTSSpeaker.ts updates state
```

### Files Changed / Created

| File | Action | Notes |
|------|--------|-------|
| `android/app/src/main/java/com/vibevoicenative/TTSSpeakerModule.kt` | **Create** | Main native module |
| `android/app/src/main/java/com/vibevoicenative/TTSSpeakerPackage.kt` | **Create** | Registers module with RN |
| `android/app/src/main/java/com/vibevoicenative/MainApplication.kt` | **Edit** | Add TTSSpeakerPackage |
| `src/native/tts/NativeTTSSpeaker.ts` | **Edit** | Remove iOS-only guard on emitter; add `checkLanguageAvailable` |
| `src/features/settings/screens/SettingsScreen.tsx` | **Edit** | Remove iOS guard; add Android voice pack banner; platform-aware engine badge |
| `src/i18n/locales/vi.json` | **Edit** | Add 3 new keys |
| `src/i18n/locales/en.json` | **Edit** | Add 3 new keys |
| `src/i18n/locales/ja.json` | **Edit** | Add 3 new keys |
| `src/i18n/locales/ko.json` | **Edit** | Add 3 new keys |
| `src/i18n/locales/zh.json` | **Edit** | Add 3 new keys |

**No changes needed:** `TTSService.ts`, `useTTSSpeaker.ts`, `settingsStore.ts` — already platform-agnostic.

---

## Section 1: Kotlin TTSSpeakerModule

File: `android/app/src/main/java/com/vibevoicenative/TTSSpeakerModule.kt`

### Responsibilities

- Wrap Android `TextToSpeech` API
- Manage a FIFO queue of `(text, language, rate)` items — same logic as iOS
- Emit `tts_started` and `tts_finished` events to JS via `RCTDeviceEventEmitter`
- Handle async TTS initialization (buffer `speak()` calls before `onInit` fires)
- Manage audio focus during playback
- Expose `checkLanguageAvailable(lang)` for voice pack detection

### Public API (mirrors iOS)

```kotlin
@ReactMethod fun speak(text: String, language: String, rate: Float)
@ReactMethod fun stopAndClear(promise: Promise)
@ReactMethod fun isSpeaking(promise: Promise)
@ReactMethod fun checkLanguageAvailable(language: String, promise: Promise)
```

### Queue Management

- `speak()` appends to queue; calls `drainQueue()` if not busy and TTS is ready
- `drainQueue()` pops the first item, calls `tts.speak()` with a unique utterance ID
- `UtteranceProgressListener.onDone()` calls `drainQueue()` — continues chain
- `stopAndClear()` clears queue + calls `tts.stop()`
- If `speak()` is called before `onInit(SUCCESS)`, items queue up and `drainQueue()` runs on init

### Language Mapping

```kotlin
private fun toLocale(lang: String): Locale = when (lang.lowercase()) {
    "vi" -> Locale("vi", "VN")
    "en" -> Locale.US
    "ja" -> Locale.JAPAN
    "ko" -> Locale.KOREA
    "zh" -> Locale.CHINA
    else -> Locale(lang)
}
```

### Rate Mapping

iOS sends float values from `TTSService.ts` (slow=0.42, normal=0.52, fast=0.62). Android `setSpeechRate()` uses a different scale (1.0 = normal). Map at the Kotlin layer:

```kotlin
// Android TextToSpeech.setSpeechRate scale: 1.0 = normal, 0.5 = slow, 2.0 = fast
private fun toAndroidRate(rate: Float): Float = when {
    rate < 0.45f -> 0.75f  // slow
    rate < 0.57f -> 1.0f   // normal
    else         -> 1.4f   // fast
}
```

---

## Section 2: Audio Focus Management

### Strategy: `AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK`

Request audio focus when starting to speak, abandon when queue empties or `stopAndClear()` is called.

```kotlin
private fun requestAudioFocus() {
    val attrs = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_ASSISTANT)
        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
        .build()

    focusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
        .setAudioAttributes(attrs)
        .setWillPauseWhenDucked(false)
        .build()

    audioManager.requestAudioFocus(focusRequest!!)
}

private fun abandonAudioFocus() {
    focusRequest?.let { audioManager.abandonAudioFocusRequest(it) }
    focusRequest = null
}
```

**Why `TRANSIENT_MAY_DUCK`:**
- `TRANSIENT` — TTS is temporary; mic recording remains the primary audio owner
- `MAY_DUCK` — background music apps lower volume; they are not stopped
- `AudioRecord` (mic) ignores audio focus requests — mic frames are never dropped

**Why not share the audio session like iOS:**  
Android's audio focus is an advisory system, not a shared session. `AudioRecord` bypasses focus. `TRANSIENT_MAY_DUCK` is the correct Android equivalent of iOS's `usesApplicationAudioSession = true`.

---

## Section 3: JS Layer Changes

### `NativeTTSSpeaker.ts`

Remove the `Platform.OS === 'ios'` guard on the event emitter:

```ts
// Before:
export const TTSSpeakerEmitter =
  Platform.OS === 'ios' && TTSSpeakerModule
    ? new NativeEventEmitter(TTSSpeakerModule)
    : null;

// After:
export const TTSSpeakerEmitter =
  TTSSpeakerModule
    ? new NativeEventEmitter(TTSSpeakerModule)
    : null;
```

Add voice language check:

```ts
export function checkAndroidTtsLanguage(lang: string): Promise<boolean> {
  if (Platform.OS !== 'android') return Promise.resolve(true);
  return NativeTTSSpeaker?.checkLanguageAvailable(lang) ?? Promise.resolve(false);
}
```

### `SettingsScreen.tsx`

**Change 1** — Remove `Platform.OS === 'ios'` guard at line 361:
```tsx
// Remove the wrapper: {Platform.OS === 'ios' && (...)}
// Keep the inner <View style={styles.section}>...</View> as-is
```

**Change 2** — Platform-aware engine badge:
```tsx
<Text style={...}>
  {Platform.OS === 'ios' ? t('ttsEngineSystem') : t('ttsEngineSystemAndroid')}
</Text>
```

**Change 3** — Android voice pack banner (shown only on Android when vi-VN unavailable):
```tsx
{Platform.OS === 'android' && !androidVoiceReady && (
  <TouchableOpacity
    style={[styles.warningBanner, {backgroundColor: theme.colors.warning + '20'}]}
    onPress={openTtsSettings}
    activeOpacity={0.8}>
    <Text style={[styles.warningText, {color: theme.colors.warning}]}>
      {t('ttsVoiceNotInstalled')}
    </Text>
    <Text style={[styles.warningAction, {color: theme.colors.primary}]}>
      {t('ttsVoiceInstallAction')}
    </Text>
  </TouchableOpacity>
)}
```

`openTtsSettings` fires `Intent(ACTION_INSTALL_TTS_DATA)` via `Linking.openURL` or a native utility call.

`androidVoiceReady` is local state checked on mount and on screen focus:
```ts
const [androidVoiceReady, setAndroidVoiceReady] = useState(true);

useFocusEffect(useCallback(() => {
  checkAndroidTtsLanguage('vi').then(setAndroidVoiceReady);
}, []));
```

---

## Section 4: i18n Additions

Add to **all 5 locale files** (`vi.json`, `en.json`, `ja.json`, `ko.json`, `zh.json`):

| Key | vi | en | ja | ko | zh |
|-----|----|----|----|----|-----|
| `ttsEngineSystemAndroid` | "Hệ thống Android" | "System Android" | "Android システム" | "Android 시스템" | "Android 系统" |
| `ttsVoiceNotInstalled` | "Cần cài giọng đọc tiếng Việt" | "Vietnamese voice not installed" | "ベトナム語の音声が未インストール" | "베트남어 음성 미설치" | "越南语语音未安装" |
| `ttsVoiceInstallAction` | "Cài đặt →" | "Install →" | "インストール →" | "설치 →" | "安装 →" |

**Note:** `ttsEngineSystem` ("System iOS") in existing locale files is left unchanged — iOS still uses it.

---

## Voice Pack Check Flow

```
SettingsScreen mounts / regains focus (Android)
    → checkAndroidTtsLanguage("vi")
        → TTSSpeakerModule.checkLanguageAvailable("vi")
            → tts.isLanguageAvailable(Locale("vi", "VN"))
                LANG_AVAILABLE      → androidVoiceReady = true  → normal toggle UI
                LANG_MISSING_DATA   → androidVoiceReady = false → show install banner
                LANG_NOT_SUPPORTED  → androidVoiceReady = false → show install banner

User taps "Cài đặt →"
    → Intent(TextToSpeech.Engine.ACTION_INSTALL_TTS_DATA)
        → Android system TTS settings screen opens
            → User installs voice pack, returns to app
                → useFocusEffect re-checks → banner disappears
```

---

## What Does NOT Change

- `TTSService.ts` — rate mapping and speak/stop API unchanged
- `useTTSSpeaker.ts` — hook logic unchanged; works with Android events as-is
- `settingsStore.ts` — `ttsEnabled`, `ttsRate` state unchanged
- iOS implementation — no modifications to `TTSSpeakerModule.swift` or `.m`

---

## Out of Scope

- Supporting non-Vietnamese TTS output (app always translates to Vietnamese)
- Custom voice selection beyond system default
- TTS in the meeting review/history screen (same as iOS — only live meeting)

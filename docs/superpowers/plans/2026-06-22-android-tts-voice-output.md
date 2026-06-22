# Android TTS Voice Output Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the iOS "Đầu ra giọng nói" TTS feature to Android using a custom Kotlin native module.

**Architecture:** A new `TTSSpeakerModule.kt` wraps Android's built-in `TextToSpeech` API with a FIFO queue, audio focus management, and `UtteranceProgressListener` events — mirroring `TTSSpeakerModule.swift`. The JS bridge (`NativeTTSSpeaker.ts`) drops its iOS-only guard, and `SettingsScreen.tsx` shows the Voice Output section on both platforms.

**Tech Stack:** Kotlin, Android `TextToSpeech` API (built-in, no new dependencies), React Native `ReactContextBaseJavaModule`, Jest for JS-layer tests.

## Global Constraints

- Package name: `com.vibevoicenative`
- Native module pattern: `@ReactModule` annotation + `BaseReactPackage` (matches `KeepAwakeModule`/`KeepAwakePackage`)
- TTS rates sent from JS: slow=0.42, normal=0.52, fast=0.62 (from `TTSService.ts`)
- All UI strings must use `t()` — no hardcoded text
- 5 locale files must all be updated: `vi.json`, `en.json`, `ja.json`, `ko.json`, `zh.json`
- Test runner: `cd mobile && yarn test` (Jest 29, `@react-native/jest-preset`)
- Min Android API: 26 (uses `AudioFocusRequest` builder API)

---

## File Map

| File | Action |
|------|--------|
| `mobile/android/app/src/main/java/com/vibevoicenative/tts/TTSSpeakerModule.kt` | **Create** |
| `mobile/android/app/src/main/java/com/vibevoicenative/tts/TTSSpeakerPackage.kt` | **Create** |
| `mobile/android/app/src/main/java/com/vibevoicenative/MainApplication.kt` | **Edit** — add `TTSSpeakerPackage` |
| `mobile/src/native/tts/NativeTTSSpeaker.ts` | **Edit** — remove iOS guard, add `checkAndroidTtsLanguage` |
| `mobile/src/native/tts/NativeTTSSpeaker.test.ts` | **Create** — Jest tests |
| `mobile/src/features/settings/screens/SettingsScreen.tsx` | **Edit** — remove iOS guard, add banner, fix badge |
| `mobile/src/i18n/locales/vi.json` | **Edit** — add 3 keys |
| `mobile/src/i18n/locales/en.json` | **Edit** — add 3 keys |
| `mobile/src/i18n/locales/ja.json` | **Edit** — add 3 keys |
| `mobile/src/i18n/locales/ko.json` | **Edit** — add 3 keys |
| `mobile/src/i18n/locales/zh.json` | **Edit** — add 3 keys |

---

## Task 1: Kotlin TTSSpeakerModule

**Files:**
- Create: `mobile/android/app/src/main/java/com/vibevoicenative/tts/TTSSpeakerModule.kt`
- Create: `mobile/android/app/src/main/java/com/vibevoicenative/tts/TTSSpeakerPackage.kt`
- Modify: `mobile/android/app/src/main/java/com/vibevoicenative/MainApplication.kt`

**Interfaces:**
- Produces: `TTSSpeakerModule` with name `"TTSSpeakerModule"`, methods: `speak(text, language, rate)`, `stopAndClear(promise)`, `isSpeaking(promise)`, `checkLanguageAvailable(language, promise)`
- Produces: events `"tts_started"` and `"tts_finished"` via `RCTDeviceEventEmitter`

- [ ] **Step 1: Create the `tts/` subdirectory and write `TTSSpeakerModule.kt`**

Create file `mobile/android/app/src/main/java/com/vibevoicenative/tts/TTSSpeakerModule.kt`:

```kotlin
package com.vibevoicenative.tts

import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.Locale
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

@ReactModule(name = TTSSpeakerModule.NAME)
class TTSSpeakerModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext), TextToSpeech.OnInitListener {

  companion object {
    const val NAME = "TTSSpeakerModule"
    private const val EVENT_STARTED = "tts_started"
    private const val EVENT_FINISHED = "tts_finished"
  }

  private var tts: TextToSpeech? = null
  private var isReady = false
  private val isBusy = AtomicBoolean(false)
  private val utteranceCounter = AtomicInteger(0)
  private val queue = ArrayDeque<Triple<String, String, Float>>()
  private val audioManager = reactContext.getSystemService(android.content.Context.AUDIO_SERVICE) as AudioManager
  private var focusRequest: AudioFocusRequest? = null

  init {
    tts = TextToSpeech(reactContext.applicationContext, this)
  }

  override fun getName(): String = NAME

  // Called by Android when TTS engine finishes initializing
  override fun onInit(status: Int) {
    if (status == TextToSpeech.SUCCESS) {
      isReady = true
      // Drain any speak() calls that arrived before init completed
      UiThreadUtil.runOnUiThread { drainQueue() }
    }
  }

  @ReactMethod
  fun speak(text: String, language: String, rate: Float) {
    UiThreadUtil.runOnUiThread {
      queue.addLast(Triple(text, language, rate))
      if (!isBusy.get() && isReady) {
        drainQueue()
      }
    }
  }

  @ReactMethod
  fun stopAndClear(promise: Promise) {
    UiThreadUtil.runOnUiThread {
      queue.clear()
      isBusy.set(false)
      tts?.stop()
      abandonAudioFocus()
      promise.resolve(true)
    }
  }

  @ReactMethod
  fun isSpeaking(promise: Promise) {
    promise.resolve(tts?.isSpeaking ?: false)
  }

  @ReactMethod
  fun checkLanguageAvailable(language: String, promise: Promise) {
    val locale = toLocale(language)
    val result = tts?.isLanguageAvailable(locale) ?: TextToSpeech.LANG_NOT_SUPPORTED
    promise.resolve(result >= TextToSpeech.LANG_AVAILABLE)
  }

  private fun drainQueue() {
    if (queue.isEmpty()) {
      isBusy.set(false)
      abandonAudioFocus()
      return
    }
    isBusy.set(true)
    val (text, language, rate) = queue.removeFirst()
    speakItem(text, language, rate)
  }

  private fun speakItem(text: String, language: String, rate: Float) {
    val ttsEngine = tts ?: return
    val locale = toLocale(language)
    val available = ttsEngine.isLanguageAvailable(locale)
    if (available >= TextToSpeech.LANG_AVAILABLE) {
      ttsEngine.language = locale
    }
    ttsEngine.setSpeechRate(toAndroidRate(rate))

    requestAudioFocus()

    val utteranceId = "utt_${utteranceCounter.incrementAndGet()}"
    val params = Bundle()
    params.putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, utteranceId)

    ttsEngine.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
      override fun onStart(utteranceId: String?) {
        emitEvent(EVENT_STARTED)
      }
      override fun onDone(utteranceId: String?) {
        emitEvent(EVENT_FINISHED)
        UiThreadUtil.runOnUiThread { drainQueue() }
      }
      @Deprecated("Deprecated in Java")
      override fun onError(utteranceId: String?) {
        UiThreadUtil.runOnUiThread {
          isBusy.set(false)
          abandonAudioFocus()
          drainQueue()
        }
      }
    })

    ttsEngine.speak(text, TextToSpeech.QUEUE_FLUSH, params, utteranceId)
  }

  private fun requestAudioFocus() {
    val attrs = AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_ASSISTANT)
      .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
      .build()
    focusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
      .setAudioAttributes(attrs)
      .setWillPauseWhenDucked(false)
      .build()
    focusRequest?.let { audioManager.requestAudioFocus(it) }
  }

  private fun abandonAudioFocus() {
    focusRequest?.let { audioManager.abandonAudioFocusRequest(it) }
    focusRequest = null
  }

  private fun emitEvent(eventName: String) {
    reactApplicationContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(eventName, null)
  }

  private fun toLocale(lang: String): Locale = when (lang.lowercase()) {
    "vi" -> Locale("vi", "VN")
    "en" -> Locale.US
    "ja" -> Locale.JAPAN
    "ko" -> Locale.KOREA
    "zh" -> Locale.CHINA
    else -> Locale(lang)
  }

  // Map iOS-scale float rates (0.42/0.52/0.62) to Android setSpeechRate scale (1.0 = normal)
  private fun toAndroidRate(rate: Float): Float = when {
    rate < 0.45f -> 0.75f   // slow
    rate < 0.57f -> 1.0f    // normal
    else         -> 1.4f    // fast
  }

  override fun invalidate() {
    tts?.shutdown()
    tts = null
    super.invalidate()
  }
}
```

- [ ] **Step 2: Write `TTSSpeakerPackage.kt`**

Create file `mobile/android/app/src/main/java/com/vibevoicenative/tts/TTSSpeakerPackage.kt`:

```kotlin
package com.vibevoicenative.tts

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class TTSSpeakerPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    if (name == TTSSpeakerModule.NAME) TTSSpeakerModule(reactContext) else null

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
    mapOf(
      TTSSpeakerModule.NAME to ReactModuleInfo(
        TTSSpeakerModule.NAME,
        TTSSpeakerModule.NAME,
        false,
        false,
        true,
        false,
        false,
      ),
    )
  }
}
```

- [ ] **Step 3: Register `TTSSpeakerPackage` in `MainApplication.kt`**

In `mobile/android/app/src/main/java/com/vibevoicenative/MainApplication.kt`, add the import and package:

```kotlin
// Add import after existing imports:
import com.vibevoicenative.tts.TTSSpeakerPackage

// Add to getPackages() list:
add(TTSSpeakerPackage())
```

Full `getPackages()` after change:
```kotlin
override fun getPackages(): List<ReactPackage> =
    PackageList(this).packages.apply {
      add(KeepAwakePackage())
      add(SecureStorageBridgePackage())
      add(OfflineSpeakerDiarizationPackage())
      add(SpeakerEmbeddingPackage())
      add(MLKitTranslatorPackage())
      add(TTSSpeakerPackage())
    }
```

- [ ] **Step 4: Build Android to verify no compile errors**

```bash
cd mobile/android && ./gradlew assembleDebug 2>&1 | tail -20
```

Expected: `BUILD SUCCESSFUL`

- [ ] **Step 5: Commit**

```bash
git add mobile/android/app/src/main/java/com/vibevoicenative/tts/TTSSpeakerModule.kt \
        mobile/android/app/src/main/java/com/vibevoicenative/tts/TTSSpeakerPackage.kt \
        mobile/android/app/src/main/java/com/vibevoicenative/MainApplication.kt
git commit -m "feat(android): add TTSSpeakerModule native TTS module"
```

---

## Task 2: Update NativeTTSSpeaker.ts

**Files:**
- Modify: `mobile/src/native/tts/NativeTTSSpeaker.ts`
- Create: `mobile/src/native/tts/NativeTTSSpeaker.test.ts`

**Interfaces:**
- Consumes: `TTSSpeakerModule` (from Task 1) via `NativeModules.TTSSpeakerModule`
- Produces: `TTSSpeakerEmitter` (non-null on Android when module exists), `checkAndroidTtsLanguage(lang: string): Promise<boolean>`

- [ ] **Step 1: Write failing Jest test**

Create `mobile/src/native/tts/NativeTTSSpeaker.test.ts`:

```typescript
import {Platform} from 'react-native';

// Mock NativeModules before importing the module under test
const mockSpeak = jest.fn();
const mockStopAndClear = jest.fn().mockResolvedValue(true);
const mockIsSpeaking = jest.fn().mockResolvedValue(false);
const mockCheckLanguageAvailable = jest.fn().mockResolvedValue(true);

jest.mock('react-native', () => ({
  NativeModules: {
    TTSSpeakerModule: {
      speak: mockSpeak,
      stopAndClear: mockStopAndClear,
      isSpeaking: mockIsSpeaking,
      checkLanguageAvailable: mockCheckLanguageAvailable,
    },
  },
  NativeEventEmitter: jest.fn().mockImplementation(() => ({
    addListener: jest.fn(),
    removeAllListeners: jest.fn(),
  })),
  Platform: {OS: 'android'},
}));

describe('NativeTTSSpeaker', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('TTSSpeakerEmitter is non-null on Android when module exists', async () => {
    const {TTSSpeakerEmitter} = await import('./NativeTTSSpeaker');
    expect(TTSSpeakerEmitter).not.toBeNull();
  });

  it('checkAndroidTtsLanguage resolves true when language is available', async () => {
    mockCheckLanguageAvailable.mockResolvedValue(true);
    const {checkAndroidTtsLanguage} = await import('./NativeTTSSpeaker');
    const result = await checkAndroidTtsLanguage('vi');
    expect(result).toBe(true);
    expect(mockCheckLanguageAvailable).toHaveBeenCalledWith('vi');
  });

  it('checkAndroidTtsLanguage resolves false when language is unavailable', async () => {
    mockCheckLanguageAvailable.mockResolvedValue(false);
    const {checkAndroidTtsLanguage} = await import('./NativeTTSSpeaker');
    const result = await checkAndroidTtsLanguage('vi');
    expect(result).toBe(false);
  });

  it('checkAndroidTtsLanguage returns true on iOS without calling native', async () => {
    (Platform as any).OS = 'ios';
    const {checkAndroidTtsLanguage} = await import('./NativeTTSSpeaker');
    const result = await checkAndroidTtsLanguage('vi');
    expect(result).toBe(true);
    expect(mockCheckLanguageAvailable).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd mobile && yarn test src/native/tts/NativeTTSSpeaker.test.ts --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `Cannot find module './NativeTTSSpeaker'` or import errors on `checkAndroidTtsLanguage`.

- [ ] **Step 3: Update `NativeTTSSpeaker.ts`**

Replace the full content of `mobile/src/native/tts/NativeTTSSpeaker.ts`:

```typescript
import {NativeModules, NativeEventEmitter, Platform} from 'react-native';

const {TTSSpeakerModule} = NativeModules;

export const NativeTTSSpeaker = TTSSpeakerModule as {
  speak(text: string, language: string, rate: number): void;
  stopAndClear(): Promise<boolean>;
  isSpeaking(): Promise<boolean>;
  checkLanguageAvailable(language: string): Promise<boolean>;
} | null;

export const TTSSpeakerEmitter =
  TTSSpeakerModule
    ? new NativeEventEmitter(TTSSpeakerModule)
    : null;

export function speakText(text: string, language: string, rate: number): void {
  NativeTTSSpeaker?.speak(text, language, rate);
}

export function stopTTS(): Promise<boolean> {
  return NativeTTSSpeaker?.stopAndClear() ?? Promise.resolve(false);
}

export function isTTSSpeaking(): Promise<boolean> {
  return NativeTTSSpeaker?.isSpeaking() ?? Promise.resolve(false);
}

export function checkAndroidTtsLanguage(lang: string): Promise<boolean> {
  if (Platform.OS !== 'android') return Promise.resolve(true);
  return NativeTTSSpeaker?.checkLanguageAvailable(lang) ?? Promise.resolve(false);
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
cd mobile && yarn test src/native/tts/NativeTTSSpeaker.test.ts --no-coverage 2>&1 | tail -20
```

Expected: PASS — 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/native/tts/NativeTTSSpeaker.ts \
        mobile/src/native/tts/NativeTTSSpeaker.test.ts
git commit -m "feat(tts): expose TTSSpeakerEmitter on Android, add checkAndroidTtsLanguage"
```

---

## Task 3: Update SettingsScreen.tsx

**Files:**
- Modify: `mobile/src/features/settings/screens/SettingsScreen.tsx`

**Interfaces:**
- Consumes: `checkAndroidTtsLanguage` from `NativeTTSSpeaker.ts` (Task 2)
- Consumes: `ttsEngineSystemAndroid`, `ttsVoiceNotInstalled`, `ttsVoiceInstallAction` i18n keys (Task 4 — add i18n task first, or add keys to locale files before this task)

**Note:** Add i18n keys (Task 4) before running this task so the TypeScript compiler doesn't complain about missing keys.

- [ ] **Step 1: Add imports to `SettingsScreen.tsx`**

At the top of `mobile/src/features/settings/screens/SettingsScreen.tsx`, add these imports. `useFocusEffect` and `useCallback` are needed for the voice pack re-check on screen focus.

**a)** Add `Linking` to the existing `react-native` destructure (line 9). Find:
```typescript
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  SafeAreaView,
  Modal,
  ActivityIndicator,
  LayoutAnimation,
} from 'react-native';
```
Replace with:
```typescript
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  SafeAreaView,
  Modal,
  ActivityIndicator,
  LayoutAnimation,
  Linking,
} from 'react-native';
```

**b)** Add `useFocusEffect` and `checkAndroidTtsLanguage` imports. Find:
```typescript
import {useNavigation} from '../../../app/navigation/router';
```
Add after it:
```typescript
import {useFocusEffect} from '@react-navigation/native';
import {checkAndroidTtsLanguage} from '../../../native/tts/NativeTTSSpeaker';
```

- [ ] **Step 2: Add `androidVoiceReady` state and focus check**

In `SettingsScreen()` function body, after the existing `ttsRate` lines (around line 92):

```typescript
const [androidVoiceReady, setAndroidVoiceReady] = useState(true);

useFocusEffect(
  useCallback(() => {
    if (Platform.OS === 'android') {
      checkAndroidTtsLanguage('vi').then(setAndroidVoiceReady);
    }
  }, []),
);

const openTtsSettings = useCallback(() => {
  Linking.openSettings();
}, []);
```

- [ ] **Step 3: Remove the `Platform.OS === 'ios'` guard at line 361**

Find:
```tsx
        {/* Voice Output Section (iOS only) */}
        {Platform.OS === 'ios' && (
          <View style={styles.section}>
```

Replace with:
```tsx
        {/* Voice Output Section */}
        <View style={styles.section}>
```

And find the closing of that conditional (line 431):
```tsx
        )}
```
Remove just that closing `)}` — the `</View>` for the section stays. The section ends with:
```tsx
          </View>
        </View>
```
So remove the extra `)` wrapping the entire block.

- [ ] **Step 4: Add Android voice pack banner inside the Voice Output section**

Find inside the Voice Output section, right before the card `<View>`:
```tsx
            <View style={[styles.card, {backgroundColor: theme.colors.surface.primary}]}>
```

Add before it:
```tsx
            {Platform.OS === 'android' && !androidVoiceReady && (
              <TouchableOpacity
                style={[styles.card, {
                  backgroundColor: theme.colors.warning
                    ? theme.colors.warning + '20'
                    : '#F590201A',
                  borderWidth: 1,
                  borderColor: theme.colors.warning ?? '#F59020',
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: spacing.sm,
                }]}
                onPress={openTtsSettings}
                activeOpacity={0.8}>
                <Text style={[styles.settingLabel, {color: theme.colors.text.primary}]}>
                  {t('ttsVoiceNotInstalled')}
                </Text>
                <Text style={[styles.settingDesc, {color: theme.colors.primary}]}>
                  {t('ttsVoiceInstallAction')}
                </Text>
              </TouchableOpacity>
            )}
```

- [ ] **Step 5: Fix engine badge to be platform-aware**

Find:
```tsx
                        {t('ttsEngineSystem')}
```

Replace with:
```tsx
                        {Platform.OS === 'ios' ? t('ttsEngineSystem') : t('ttsEngineSystemAndroid')}
```

- [ ] **Step 6: Run TypeScript check**

```bash
cd mobile && yarn tsc --noEmit 2>&1 | grep -E "error|warning" | head -20
```

Expected: No errors related to the changed files.

- [ ] **Step 7: Commit**

```bash
git add mobile/src/features/settings/screens/SettingsScreen.tsx
git commit -m "feat(settings): show Voice Output section on Android with voice pack check"
```

---

## Task 4: Add i18n Strings to All 5 Locales

**Files:**
- Modify: `mobile/src/i18n/locales/vi.json`
- Modify: `mobile/src/i18n/locales/en.json`
- Modify: `mobile/src/i18n/locales/ja.json`
- Modify: `mobile/src/i18n/locales/ko.json`
- Modify: `mobile/src/i18n/locales/zh.json`

**Note:** Do this task **before** Task 3 to avoid TypeScript errors on missing i18n keys.

**Interfaces:**
- Produces: keys `ttsEngineSystemAndroid`, `ttsVoiceNotInstalled`, `ttsVoiceInstallAction` in namespace `settings`

- [ ] **Step 1: Add keys to `vi.json`**

In `mobile/src/i18n/locales/vi.json`, find line 193:
```json
    "ttsEngineSystem": "Hệ thống iOS"
```

Add after it (before the closing `}`):
```json
    "ttsEngineSystemAndroid": "Hệ thống Android",
    "ttsVoiceNotInstalled": "Cần cài giọng đọc tiếng Việt",
    "ttsVoiceInstallAction": "Cài đặt →"
```

- [ ] **Step 2: Add keys to `en.json`**

In `mobile/src/i18n/locales/en.json`, find line 193:
```json
    "ttsEngineSystem": "System iOS"
```

Add after it:
```json
    "ttsEngineSystemAndroid": "System Android",
    "ttsVoiceNotInstalled": "Vietnamese voice not installed",
    "ttsVoiceInstallAction": "Install →"
```

- [ ] **Step 3: Add keys to `ja.json`**

In `mobile/src/i18n/locales/ja.json`, find:
```json
    "ttsEngineSystem": "システム iOS"
```

Add after it:
```json
    "ttsEngineSystemAndroid": "Android システム",
    "ttsVoiceNotInstalled": "ベトナム語の音声が未インストール",
    "ttsVoiceInstallAction": "インストール →"
```

- [ ] **Step 4: Add keys to `ko.json`**

In `mobile/src/i18n/locales/ko.json`, find:
```json
    "ttsEngineSystem": "시스템 iOS"
```

Add after it:
```json
    "ttsEngineSystemAndroid": "Android 시스템",
    "ttsVoiceNotInstalled": "베트남어 음성 미설치",
    "ttsVoiceInstallAction": "설치 →"
```

- [ ] **Step 5: Add keys to `zh.json`**

In `mobile/src/i18n/locales/zh.json`, find:
```json
    "ttsEngineSystem": "系统 iOS"
```

Add after it:
```json
    "ttsEngineSystemAndroid": "Android 系统",
    "ttsVoiceNotInstalled": "越南语语音未安装",
    "ttsVoiceInstallAction": "安装 →"
```

- [ ] **Step 6: Run full test suite to catch any regressions**

```bash
cd mobile && yarn test --no-coverage 2>&1 | tail -15
```

Expected: All tests pass (same count as before this PR).

- [ ] **Step 7: Commit**

```bash
git add mobile/src/i18n/locales/vi.json \
        mobile/src/i18n/locales/en.json \
        mobile/src/i18n/locales/ja.json \
        mobile/src/i18n/locales/ko.json \
        mobile/src/i18n/locales/zh.json
git commit -m "i18n: add Android TTS voice output strings to all 5 locales"
```

---

## Recommended Task Order

Tasks 4 → 1 → 2 → 3

Run Task 4 first (i18n) so TypeScript doesn't complain in Task 3. Tasks 1 and 2 can be done in any order relative to each other. Task 3 depends on Task 2 (imports `checkAndroidTtsLanguage`) and Task 4 (uses new i18n keys).

---

## Manual Verification Checklist (after all tasks)

Run on a physical Android device or emulator (API 26+):

- [ ] Settings screen shows "Đầu ra giọng nói" section on Android
- [ ] Toggle "Đọc bản dịch to" can be turned on/off
- [ ] With vi-VN voice installed: toggle works, no banner shown
- [ ] With vi-VN voice not installed: yellow banner appears, tapping opens Android TTS settings
- [ ] After installing voice and returning: banner disappears
- [ ] Start a meeting, enable TTS, speak in EN/JA/KO — Vietnamese translation is read aloud
- [ ] Mic continues recording during TTS playback (no audio dropout)
- [ ] "Hệ thống Android" badge appears (not "Hệ thống iOS")
- [ ] iOS unchanged: "Hệ thống iOS" badge still shows on iOS

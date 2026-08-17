# Android Background Recording Service — Design Spec

**Date:** 2026-06-23
**Status:** Approved
**Scope:** Keep audio capture alive when app goes to Android background during a meeting

---

## Problem

On Android, when the app goes to background, the process priority drops and the sherpa-onnx PCM audio stream can be throttled or killed by the system. iOS solves this via `UIBackgroundModes: audio` in Info.plist. Android requires an explicit **Foreground Service** to keep the process alive with high priority.

Currently the app only has `KeepAwakeModule` (prevents screen-off) — this does NOT prevent app suspension.

---

## Goals

- Audio capture continues uninterrupted when app goes to background on Android
- User sees a persistent notification: meeting name + elapsed timer + Pause button
- Tapping Pause in notification pauses the meeting (mic off, session preserved)
- Timer counts total meeting duration (from meeting start, not from backgrounding)
- Notification channel name and strings use Android string resources (system language)
- No new npm dependencies

---

## Architecture

### Flow

```
Meeting starts (JS)
  → NativeBackgroundRecording.startService(meetingName, startTimestamp)
      → startForegroundService(Intent with extras)
          → MeetingRecordingService.onStartCommand()
              → startForeground(notification: name + Chronometer + Pause button)
              → Process now at foreground priority — mic stream continues

App goes to background → system cannot kill process

User taps "Pause" in notification
  → PendingIntent fires broadcast ACTION_PAUSE_MEETING
      → PauseReceiver.onReceive()
          → RCTDeviceEventEmitter.emit("meeting_bg_pause", null)
              → useMeetingSession.ts handles event → pauseMeeting()
          → notification updates to paused state

Meeting stops (JS)
  → NativeBackgroundRecording.stopService()
      → stopForeground(STOP_FOREGROUND_REMOVE)
      → stopSelf()
```

### Notification Layout

```
┌─────────────────────────────────────────┐
│ 🎙 Executive MVA                        │
│ Đang ghi âm: [Tên cuộc họp]            │
│ ⏱ 00:15:32              [Tạm dừng]     │
└─────────────────────────────────────────┘
```

- **Title:** app name (from `R.string.app_name`)
- **Text:** `R.string.notification_recording` + meeting name (passed via Intent extra)
- **Timer:** Android `Chronometer` — `base = SystemClock.elapsedRealtime() - elapsedSinceStart`
- **Pause action:** PendingIntent broadcast, label from `R.string.notification_action_pause`
- **Channel:** `"meeting_recording"`, `IMPORTANCE_LOW` (silent, no vibration)

---

## Section 1: Kotlin Files

### `MeetingRecordingService.kt`

**Location:** `android/app/src/main/java/com/vibevoicenative/tts/MeetingRecordingService.kt`

**Responsibilities:**
- Extends `Service`, runs as Foreground Service
- Creates notification channel on first start
- Builds and shows notification with Chronometer + Pause action
- Inner `PauseReceiver : BroadcastReceiver` handles ACTION_PAUSE_MEETING
- Emits `"meeting_bg_pause"` event to JS via `RCTDeviceEventEmitter`
- `START_STICKY` — system restarts service if killed under memory pressure

**Key constants:**
```kotlin
companion object {
  const val ACTION_PAUSE_MEETING = "com.vibevoicenative.ACTION_PAUSE_MEETING"
  const val EXTRA_MEETING_NAME = "meeting_name"
  const val EXTRA_START_TIMESTAMP = "start_timestamp"   // Unix ms
  const val NOTIFICATION_ID = 1001
  const val CHANNEL_ID = "meeting_recording"
}
```

**Lifecycle:**
- `onCreate()` — create notification channel, register PauseReceiver, set `reactContext` from `ReactContextHolder`
- `onStartCommand(intent)` — extract meetingName + startTimestamp, call `startForeground()`, return `START_STICKY`
- `onDestroy()` — unregister PauseReceiver, `stopForeground(STOP_FOREGROUND_REMOVE)`
- `onBind()` — returns null (not a bound service)

**Notification build:**
```kotlin
private fun buildNotification(meetingName: String, startTimestamp: Long): Notification {
  val elapsed = System.currentTimeMillis() - startTimestamp
  val chronoBase = SystemClock.elapsedRealtime() - elapsed

  val pauseIntent = PendingIntent.getBroadcast(
    this, 0,
    Intent(ACTION_PAUSE_MEETING),
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
  )

  return NotificationCompat.Builder(this, CHANNEL_ID)
    .setSmallIcon(android.R.drawable.ic_btn_speak_now)
    .setContentTitle(getString(R.string.app_name))
    .setContentText("${getString(R.string.notification_recording)} $meetingName")
    .setUsesChronometer(true)
    .setChronometerCountDown(false)
    .setWhen(System.currentTimeMillis() - elapsed)
    .setShowWhen(true)
    .addAction(0, getString(R.string.notification_action_pause), pauseIntent)
    .setOngoing(true)
    .build()
}
```

**ReactContext access:**
The service needs `ReactApplicationContext` to emit events. Access via a static holder:
```kotlin
// In MainApplication or a singleton
object ReactContextHolder {
  var context: ReactApplicationContext? = null
}
```
Set in `BackgroundRecordingModule.init {}`, used in `MeetingRecordingService`.

### `BackgroundRecordingModule.kt`

**Location:** `android/app/src/main/java/com/vibevoicenative/tts/BackgroundRecordingModule.kt`

**Responsibilities:**
- `ReactContextBaseJavaModule` exposing 2 JS-callable methods
- Sets `ReactContextHolder.context` on init

**API:**
```kotlin
@ReactMethod
fun startService(meetingName: String, startTimestamp: Double)
// Calls context.startForegroundService(Intent(...).apply {
//   putExtra(EXTRA_MEETING_NAME, meetingName)
//   putExtra(EXTRA_START_TIMESTAMP, startTimestamp.toLong())
// })

@ReactMethod
fun stopService()
// Calls context.stopService(Intent(context, MeetingRecordingService::class.java))
```

### `BackgroundRecordingPackage.kt`

**Location:** `android/app/src/main/java/com/vibevoicenative/tts/BackgroundRecordingPackage.kt`

Same `BaseReactPackage` pattern as `KeepAwakePackage` and `TTSSpeakerPackage`.

---

## Section 2: AndroidManifest.xml Changes

**File:** `android/app/src/main/AndroidManifest.xml`

### Permissions (add after existing `RECORD_AUDIO`):

```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

### Service declaration (inside `<application>`):

```xml
<service
  android:name=".tts.MeetingRecordingService"
  android:foregroundServiceType="microphone"
  android:exported="false" />
```

`foregroundServiceType="microphone"` is mandatory from Android 14 — missing causes crash on `startForeground()`.

---

## Section 3: Android String Resources

Create/update these files with keys below:

| String key | vi | en (default) | ja | ko | zh |
|------------|----|----|----|----|-----|
| `notification_channel_meeting_recording` | "Ghi âm cuộc họp" | "Meeting Recording" | "会議録音" | "회의 녹음" | "会议录音" |
| `notification_recording` | "Đang ghi âm:" | "Recording:" | "録音中:" | "녹음 중:" | "录音中:" |
| `notification_action_pause` | "Tạm dừng" | "Pause" | "一時停止" | "일시정지" | "暂停" |

**Files:**
- `android/app/src/main/res/values/strings.xml` — English (default)
- `android/app/src/main/res/values-vi/strings.xml`
- `android/app/src/main/res/values-ja/strings.xml`
- `android/app/src/main/res/values-ko/strings.xml`
- `android/app/src/main/res/values-zh/strings.xml`

---

## Section 4: JS Layer Changes

### `NativeBackgroundRecording.ts`

**Location:** `mobile/src/native/backgroundRecording/NativeBackgroundRecording.ts`

```typescript
import {NativeModules, NativeEventEmitter, Platform} from 'react-native';

const {BackgroundRecordingModule} = NativeModules;

export const BackgroundRecordingEmitter =
  Platform.OS === 'android' && BackgroundRecordingModule
    ? new NativeEventEmitter(BackgroundRecordingModule)
    : null;

export function startBackgroundRecording(
  meetingName: string,
  startTimestamp: number,
): void {
  if (Platform.OS !== 'android') return;
  BackgroundRecordingModule?.startService(meetingName, startTimestamp);
}

export function stopBackgroundRecording(): void {
  if (Platform.OS !== 'android') return;
  BackgroundRecordingModule?.stopService();
}
```

### `useMeetingSession.ts` — 3 changes

**1. Import (top of file):**
```typescript
import {
  startBackgroundRecording,
  stopBackgroundRecording,
  BackgroundRecordingEmitter,
} from '../../../native/backgroundRecording/NativeBackgroundRecording';
```

**2. In `startMeeting()`, after recognizer starts:**
```typescript
if (Platform.OS === 'android') {
  startBackgroundRecording(
    sessionName ?? t('defaultMeetingName'),
    sessionStartTime,  // Unix ms timestamp
  );
}
```

**3. In `stopMeeting()`, before cleanup:**
```typescript
if (Platform.OS === 'android') {
  stopBackgroundRecording();
}
```

**4. New `useEffect` for pause event (inside hook body):**
```typescript
useEffect(() => {
  if (Platform.OS !== 'android') return;
  const sub = BackgroundRecordingEmitter?.addListener(
    'meeting_bg_pause',
    () => { pauseMeeting(); },
  );
  return () => sub?.remove();
}, [pauseMeeting]);
```

### `POST_NOTIFICATIONS` runtime permission

Add to app startup (e.g., `App.tsx` or `useMeetingSession.ts`):
```typescript
useEffect(() => {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
  }
}, []);
```

---

## Section 5: MainApplication.kt

Add import and registration:
```kotlin
import com.vibevoicenative.tts.BackgroundRecordingPackage

// in getPackages():
add(BackgroundRecordingPackage())
```

---

## ReactContext Access Pattern

`MeetingRecordingService` is a plain Android `Service` — not a React Native module — so it cannot inject `ReactApplicationContext` directly. Use a static holder set by `BackgroundRecordingModule`:

```kotlin
// BackgroundRecordingModule.kt
init {
  ReactContextHolder.context = reactApplicationContext
}

// MeetingRecordingService.kt — in PauseReceiver.onReceive():
ReactContextHolder.context
  ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
  ?.emit("meeting_bg_pause", null)
```

**Null safety:** If context is null (app not initialized), pause event is silently dropped — acceptable since if context is null, the JS meeting session doesn't exist either.

---

## What Does NOT Change

- `RealSpeechRecognizer.ts` — no changes; sherpa-onnx PCM stream continues as-is
- iOS — no changes; iOS already uses `UIBackgroundModes: audio`
- `KeepAwakeModule` — remains for screen-on behavior, orthogonal to this feature
- Pause/resume logic in `useMeetingSession.ts` — reuses existing `pauseMeeting()`

---

## Out of Scope

- Resume from notification (tapping notification body to bring app to foreground) — can be added later via `contentIntent`
- Notification showing paused state with different text — minor UI polish, not required for correctness
- Handling system restart (`BOOT_COMPLETED`) — meetings don't survive app kill

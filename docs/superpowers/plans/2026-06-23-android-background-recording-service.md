# Android Background Recording Foreground Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep audio capture alive when the MVA app is backgrounded on Android by running a Foreground Service that holds the process at foreground priority, shows a persistent notification with meeting elapsed time and a Pause button.

**Architecture:** A Kotlin `MeetingRecordingService` (plain `Service`) runs as a Foreground Service with `foregroundServiceType="microphone"`. A `BackgroundRecordingModule` (`ReactContextBaseJavaModule`) exposes `startService`/`stopService` to JS and holds a `ReactContextHolder` singleton so the service can emit events back to JS. The React Native layer calls `startBackgroundRecording` after the recognizer starts and `stopBackgroundRecording` before session cleanup; a `useEffect` listener in `useMeetingSession` catches the `meeting_bg_pause` event and calls the existing `pauseMeeting()`.

**Tech Stack:** Kotlin · Android Foreground Service API · `NotificationCompat` (AndroidX) · `NativeEventEmitter` · React Native `NativeModules`

## Global Constraints

- Package name: `com.vibevoicenative` — all Kotlin files under `mobile/android/app/src/main/java/com/vibevoicenative/`
- New Kotlin files live in the `tts` sub-package (alongside `TTSSpeakerModule.kt`) at `com.vibevoicenative.tts`
- `BaseReactPackage` pattern — match `TTSSpeakerPackage.kt` exactly
- `minSdkVersion = 24` — all API 26+ / API 29+ / API 33+ / API 34+ calls must be version-guarded
- No new npm dependencies
- Notification channel ID: `"meeting_recording"`, importance: `IMPORTANCE_LOW` (silent)
- Foreground service notification ID: `1001`
- JS event name: `"meeting_bg_pause"`
- Native module name (JS bridge key): `"BackgroundRecordingModule"`
- TS bridge file: `mobile/src/native/backgroundRecording/NativeBackgroundRecording.ts`
- i18n string keys added in Task 1 to Android string resources (not RN locale files)

---

## File Map

**Create:**
- `mobile/android/app/src/main/res/values-vi/strings.xml`
- `mobile/android/app/src/main/res/values-ja/strings.xml`
- `mobile/android/app/src/main/res/values-ko/strings.xml`
- `mobile/android/app/src/main/res/values-zh/strings.xml`
- `mobile/android/app/src/main/java/com/vibevoicenative/tts/ReactContextHolder.kt`
- `mobile/android/app/src/main/java/com/vibevoicenative/tts/MeetingRecordingService.kt`
- `mobile/android/app/src/main/java/com/vibevoicenative/tts/BackgroundRecordingModule.kt`
- `mobile/android/app/src/main/java/com/vibevoicenative/tts/BackgroundRecordingPackage.kt`
- `mobile/src/native/backgroundRecording/NativeBackgroundRecording.ts`
- `mobile/src/native/backgroundRecording/NativeBackgroundRecording.test.ts`

**Modify:**
- `mobile/android/app/src/main/res/values/strings.xml` — add 3 notification string keys
- `mobile/android/app/src/main/AndroidManifest.xml` — 3 permissions + `<service>` declaration
- `mobile/android/app/src/main/java/com/vibevoicenative/MainApplication.kt` — register package
- `mobile/src/app/App.tsx` — request `POST_NOTIFICATIONS` permission once at startup
- `mobile/src/features/meeting/hooks/useMeetingSession.ts` — start/stop service + pause event

---

### Task 1: Android String Resources

**Files:**
- Modify: `mobile/android/app/src/main/res/values/strings.xml`
- Create: `mobile/android/app/src/main/res/values-vi/strings.xml`
- Create: `mobile/android/app/src/main/res/values-ja/strings.xml`
- Create: `mobile/android/app/src/main/res/values-ko/strings.xml`
- Create: `mobile/android/app/src/main/res/values-zh/strings.xml`

**Interfaces:**
- Produces: Android string resources `notification_channel_meeting_recording`, `notification_recording`, `notification_action_pause` — used by `MeetingRecordingService.kt` in Task 2 via `getString(R.string.*)`.

- [ ] **Step 1: Update the English default strings.xml**

Replace the entire file `mobile/android/app/src/main/res/values/strings.xml`:

```xml
<resources>
    <string name="app_name">MVA</string>
    <string name="notification_channel_meeting_recording">Meeting Recording</string>
    <string name="notification_recording">Recording:</string>
    <string name="notification_action_pause">Pause</string>
</resources>
```

- [ ] **Step 2: Create Vietnamese strings**

Create `mobile/android/app/src/main/res/values-vi/strings.xml`:

```xml
<resources>
    <string name="notification_channel_meeting_recording">Ghi âm cuộc họp</string>
    <string name="notification_recording">Đang ghi âm:</string>
    <string name="notification_action_pause">Tạm dừng</string>
</resources>
```

- [ ] **Step 3: Create Japanese strings**

Create `mobile/android/app/src/main/res/values-ja/strings.xml`:

```xml
<resources>
    <string name="notification_channel_meeting_recording">会議録音</string>
    <string name="notification_recording">録音中:</string>
    <string name="notification_action_pause">一時停止</string>
</resources>
```

- [ ] **Step 4: Create Korean strings**

Create `mobile/android/app/src/main/res/values-ko/strings.xml`:

```xml
<resources>
    <string name="notification_channel_meeting_recording">회의 녹음</string>
    <string name="notification_recording">녹음 중:</string>
    <string name="notification_action_pause">일시정지</string>
</resources>
```

- [ ] **Step 5: Create Chinese strings**

Create `mobile/android/app/src/main/res/values-zh/strings.xml`:

```xml
<resources>
    <string name="notification_channel_meeting_recording">会议录音</string>
    <string name="notification_recording">录音中:</string>
    <string name="notification_action_pause">暂停</string>
</resources>
```

- [ ] **Step 6: Verify the resource directory structure**

Run:
```bash
find mobile/android/app/src/main/res -name "strings.xml" | sort
```

Expected output:
```
mobile/android/app/src/main/res/values-ja/strings.xml
mobile/android/app/src/main/res/values-ko/strings.xml
mobile/android/app/src/main/res/values-vi/strings.xml
mobile/android/app/src/main/res/values-zh/strings.xml
mobile/android/app/src/main/res/values/strings.xml
```

- [ ] **Step 7: Commit**

```bash
git add mobile/android/app/src/main/res/values/strings.xml \
        mobile/android/app/src/main/res/values-vi/strings.xml \
        mobile/android/app/src/main/res/values-ja/strings.xml \
        mobile/android/app/src/main/res/values-ko/strings.xml \
        mobile/android/app/src/main/res/values-zh/strings.xml
git commit -m "feat(android): add notification string resources for background recording service"
```

---

### Task 2: ReactContextHolder + MeetingRecordingService

**Files:**
- Create: `mobile/android/app/src/main/java/com/vibevoicenative/tts/ReactContextHolder.kt`
- Create: `mobile/android/app/src/main/java/com/vibevoicenative/tts/MeetingRecordingService.kt`

**Interfaces:**
- Consumes: `R.string.notification_channel_meeting_recording`, `R.string.notification_recording`, `R.string.notification_action_pause` from Task 1.
- Produces:
  - `ReactContextHolder.context: ReactApplicationContext?` — set by `BackgroundRecordingModule` in Task 3, read here in `PauseReceiver`.
  - `MeetingRecordingService` class — referenced by `BackgroundRecordingModule` in Task 3 and `AndroidManifest.xml` in Task 4.
  - `MeetingRecordingService.EXTRA_MEETING_NAME: String` — Intent extra key used by `BackgroundRecordingModule.startService()`.
  - `MeetingRecordingService.EXTRA_START_TIMESTAMP: String` — Intent extra key used by `BackgroundRecordingModule.startService()`.

- [ ] **Step 1: Create ReactContextHolder.kt**

Create `mobile/android/app/src/main/java/com/vibevoicenative/tts/ReactContextHolder.kt`:

```kotlin
package com.vibevoicenative.tts

import com.facebook.react.bridge.ReactApplicationContext

object ReactContextHolder {
  var context: ReactApplicationContext? = null
}
```

- [ ] **Step 2: Create MeetingRecordingService.kt**

Create `mobile/android/app/src/main/java/com/vibevoicenative/tts/MeetingRecordingService.kt`:

```kotlin
package com.vibevoicenative.tts

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.SystemClock
import androidx.core.app.NotificationCompat
import com.facebook.react.modules.core.DeviceEventManagerModule

class MeetingRecordingService : Service() {

  companion object {
    const val ACTION_PAUSE_MEETING = "com.vibevoicenative.ACTION_PAUSE_MEETING"
    const val EXTRA_MEETING_NAME = "meeting_name"
    const val EXTRA_START_TIMESTAMP = "start_timestamp"
    const val NOTIFICATION_ID = 1001
    const val CHANNEL_ID = "meeting_recording"
  }

  private val pauseReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      ReactContextHolder.context
        ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        ?.emit("meeting_bg_pause", null)
    }
  }

  override fun onCreate() {
    super.onCreate()
    createNotificationChannel()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      registerReceiver(pauseReceiver, IntentFilter(ACTION_PAUSE_MEETING), RECEIVER_NOT_EXPORTED)
    } else {
      @Suppress("UnspecifiedRegisterReceiverFlag")
      registerReceiver(pauseReceiver, IntentFilter(ACTION_PAUSE_MEETING))
    }
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val meetingName = intent?.getStringExtra(EXTRA_MEETING_NAME) ?: getString(R.string.app_name)
    val startTimestamp = intent?.getLongExtra(EXTRA_START_TIMESTAMP, System.currentTimeMillis())
      ?: System.currentTimeMillis()

    val notification = buildNotification(meetingName, startTimestamp)

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }

    return START_STICKY
  }

  override fun onDestroy() {
    unregisterReceiver(pauseReceiver)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      stopForeground(STOP_FOREGROUND_REMOVE)
    } else {
      @Suppress("DEPRECATION")
      stopForeground(true)
    }
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        CHANNEL_ID,
        getString(R.string.notification_channel_meeting_recording),
        NotificationManager.IMPORTANCE_LOW,
      )
      channel.setShowBadge(false)
      val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      nm.createNotificationChannel(channel)
    }
  }

  private fun buildNotification(meetingName: String, startTimestamp: Long): Notification {
    val elapsed = System.currentTimeMillis() - startTimestamp
    val chronoBase = SystemClock.elapsedRealtime() - elapsed

    val pauseIntent = PendingIntent.getBroadcast(
      this,
      0,
      Intent(ACTION_PAUSE_MEETING),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_btn_speak_now)
      .setContentTitle(getString(R.string.app_name))
      .setContentText("${getString(R.string.notification_recording)} $meetingName")
      .setUsesChronometer(true)
      .setWhen(chronoBase)
      .setShowWhen(true)
      .addAction(0, getString(R.string.notification_action_pause), pauseIntent)
      .setOngoing(true)
      .build()
  }
}
```

- [ ] **Step 3: Verify the files exist**

Run:
```bash
ls mobile/android/app/src/main/java/com/vibevoicenative/tts/
```

Expected output includes:
```
BackgroundRecordingModule.kt  (will exist after Task 3)
BackgroundRecordingPackage.kt (will exist after Task 3)
MeetingRecordingService.kt
ReactContextHolder.kt
TTSSpeakerModule.kt
TTSSpeakerPackage.kt
```

(At this step, only `ReactContextHolder.kt` and `MeetingRecordingService.kt` are new.)

- [ ] **Step 4: Commit**

```bash
git add mobile/android/app/src/main/java/com/vibevoicenative/tts/ReactContextHolder.kt \
        mobile/android/app/src/main/java/com/vibevoicenative/tts/MeetingRecordingService.kt
git commit -m "feat(android): add ReactContextHolder singleton and MeetingRecordingService foreground service"
```

---

### Task 3: BackgroundRecordingModule + BackgroundRecordingPackage

**Files:**
- Create: `mobile/android/app/src/main/java/com/vibevoicenative/tts/BackgroundRecordingModule.kt`
- Create: `mobile/android/app/src/main/java/com/vibevoicenative/tts/BackgroundRecordingPackage.kt`

**Interfaces:**
- Consumes: `ReactContextHolder` (Task 2), `MeetingRecordingService.EXTRA_MEETING_NAME`, `MeetingRecordingService.EXTRA_START_TIMESTAMP` (Task 2).
- Produces:
  - `BackgroundRecordingModule.NAME = "BackgroundRecordingModule"` — the key by which JS accesses `NativeModules.BackgroundRecordingModule`.
  - `BackgroundRecordingPackage` class — registered in `MainApplication.kt` in Task 4.

- [ ] **Step 1: Create BackgroundRecordingModule.kt**

Create `mobile/android/app/src/main/java/com/vibevoicenative/tts/BackgroundRecordingModule.kt`:

```kotlin
package com.vibevoicenative.tts

import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = BackgroundRecordingModule.NAME)
class BackgroundRecordingModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  companion object {
    const val NAME = "BackgroundRecordingModule"
  }

  init {
    ReactContextHolder.context = reactContext
  }

  override fun getName(): String = NAME

  @ReactMethod
  fun startService(meetingName: String, startTimestamp: Double) {
    val intent = Intent(reactApplicationContext, MeetingRecordingService::class.java).apply {
      putExtra(MeetingRecordingService.EXTRA_MEETING_NAME, meetingName)
      putExtra(MeetingRecordingService.EXTRA_START_TIMESTAMP, startTimestamp.toLong())
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      reactApplicationContext.startForegroundService(intent)
    } else {
      reactApplicationContext.startService(intent)
    }
  }

  @ReactMethod
  fun stopService() {
    reactApplicationContext.stopService(
      Intent(reactApplicationContext, MeetingRecordingService::class.java)
    )
  }
}
```

- [ ] **Step 2: Create BackgroundRecordingPackage.kt**

Create `mobile/android/app/src/main/java/com/vibevoicenative/tts/BackgroundRecordingPackage.kt`:

```kotlin
package com.vibevoicenative.tts

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class BackgroundRecordingPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    if (name == BackgroundRecordingModule.NAME) BackgroundRecordingModule(reactContext) else null

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
    mapOf(
      BackgroundRecordingModule.NAME to ReactModuleInfo(
        BackgroundRecordingModule.NAME,
        BackgroundRecordingModule.NAME,
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

- [ ] **Step 3: Commit**

```bash
git add mobile/android/app/src/main/java/com/vibevoicenative/tts/BackgroundRecordingModule.kt \
        mobile/android/app/src/main/java/com/vibevoicenative/tts/BackgroundRecordingPackage.kt
git commit -m "feat(android): add BackgroundRecordingModule and BackgroundRecordingPackage"
```

---

### Task 4: AndroidManifest + MainApplication

**Files:**
- Modify: `mobile/android/app/src/main/AndroidManifest.xml`
- Modify: `mobile/android/app/src/main/java/com/vibevoicenative/MainApplication.kt`

**Interfaces:**
- Consumes: `BackgroundRecordingPackage` (Task 3), `MeetingRecordingService` class name (Task 2).
- Produces: The Android system can now start `MeetingRecordingService` as a foreground service; `NativeModules.BackgroundRecordingModule` is available in JS.

- [ ] **Step 1: Update AndroidManifest.xml**

Replace the entire content of `mobile/android/app/src/main/AndroidManifest.xml`:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

    <application
      android:name=".MainApplication"
      android:label="@string/app_name"
      android:icon="@mipmap/ic_launcher"
      android:roundIcon="@mipmap/ic_launcher_round"
      android:allowBackup="false"
      android:theme="@style/AppTheme"
      android:usesCleartextTraffic="${usesCleartextTraffic}"
      android:supportsRtl="true">
      <activity
        android:name=".MainActivity"
        android:label="@string/app_name"
        android:configChanges="keyboard|keyboardHidden|orientation|screenLayout|screenSize|smallestScreenSize|uiMode"
        android:launchMode="singleTask"
        android:windowSoftInputMode="adjustResize"
        android:exported="true">
        <intent-filter>
            <action android:name="android.intent.action.MAIN" />
            <category android:name="android.intent.category.LAUNCHER" />
        </intent-filter>
      </activity>
      <service
        android:name=".tts.MeetingRecordingService"
        android:foregroundServiceType="microphone"
        android:exported="false" />
    </application>
</manifest>
```

- [ ] **Step 2: Update MainApplication.kt**

Add the import and package registration. The full updated file:

```kotlin
package com.vibevoicenative

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.vibevoicenative.keepawake.KeepAwakePackage
import com.vibevoicenative.securestorage.SecureStorageBridgePackage
import com.vibevoicenative.speaker.OfflineSpeakerDiarizationPackage
import com.vibevoicenative.speaker.SpeakerEmbeddingPackage
import com.vibevoicenative.translation.MLKitTranslatorPackage
import com.vibevoicenative.tts.BackgroundRecordingPackage
import com.vibevoicenative.tts.TTSSpeakerPackage

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost =
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
              add(KeepAwakePackage())
              add(SecureStorageBridgePackage())
              add(OfflineSpeakerDiarizationPackage())
              add(SpeakerEmbeddingPackage())
              add(MLKitTranslatorPackage())
              add(TTSSpeakerPackage())
              add(BackgroundRecordingPackage())
            }

        override fun getJSMainModuleName(): String = "index"

        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override val isNewArchEnabled: Boolean = true
      }

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(applicationContext, reactNativeHost)
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}
```

- [ ] **Step 3: Verify the Android project compiles**

Run a debug build (faster than release, same compile-time check):
```bash
cd mobile/android && ./gradlew assembleDebug 2>&1 | tail -20
```

Expected output ends with:
```
BUILD SUCCESSFUL in ...
```

If it fails with `Unresolved reference: R` in MeetingRecordingService — check that `values/strings.xml` has all 3 keys from Task 1.

- [ ] **Step 4: Commit**

```bash
git add mobile/android/app/src/main/AndroidManifest.xml \
        mobile/android/app/src/main/java/com/vibevoicenative/MainApplication.kt
git commit -m "feat(android): add foreground service permissions and register BackgroundRecordingPackage"
```

---

### Task 5: NativeBackgroundRecording.ts + tests

**Files:**
- Create: `mobile/src/native/backgroundRecording/NativeBackgroundRecording.ts`
- Create: `mobile/src/native/backgroundRecording/NativeBackgroundRecording.test.ts`

**Interfaces:**
- Produces:
  - `startBackgroundRecording(meetingName: string, startTimestamp: number): void` — called in `useMeetingSession.ts` Task 6.
  - `stopBackgroundRecording(): void` — called in `useMeetingSession.ts` Task 6.
  - `BackgroundRecordingEmitter: NativeEventEmitter | null` — used by `useMeetingSession.ts` Task 6 to subscribe to `"meeting_bg_pause"`.

- [ ] **Step 1: Write the failing tests**

Create `mobile/src/native/backgroundRecording/NativeBackgroundRecording.test.ts`:

```typescript
const mockStartService = jest.fn();
const mockStopService = jest.fn();
const mockPlatform = {OS: 'android' as string, Version: 33};

jest.mock('react-native', () => ({
  NativeModules: {
    BackgroundRecordingModule: {
      startService: mockStartService,
      stopService: mockStopService,
    },
  },
  NativeEventEmitter: jest.fn().mockImplementation(() => ({
    addListener: jest.fn(),
    removeAllListeners: jest.fn(),
  })),
  get Platform() {
    return mockPlatform;
  },
}));

describe('NativeBackgroundRecording', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockPlatform.OS = 'android';
  });

  it('BackgroundRecordingEmitter is non-null on Android when module exists', () => {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const {BackgroundRecordingEmitter} = require('./NativeBackgroundRecording');
      expect(BackgroundRecordingEmitter).not.toBeNull();
    });
  });

  it('BackgroundRecordingEmitter is null on iOS', () => {
    mockPlatform.OS = 'ios';
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const {BackgroundRecordingEmitter} = require('./NativeBackgroundRecording');
      expect(BackgroundRecordingEmitter).toBeNull();
    });
  });

  it('startBackgroundRecording calls native startService on Android', () => {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const {startBackgroundRecording} = require('./NativeBackgroundRecording');
      startBackgroundRecording('MVA', 1700000000000);
      expect(mockStartService).toHaveBeenCalledWith('MVA', 1700000000000);
    });
  });

  it('startBackgroundRecording is a no-op on iOS', () => {
    mockPlatform.OS = 'ios';
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const {startBackgroundRecording} = require('./NativeBackgroundRecording');
      startBackgroundRecording('MVA', 1700000000000);
      expect(mockStartService).not.toHaveBeenCalled();
    });
  });

  it('stopBackgroundRecording calls native stopService on Android', () => {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const {stopBackgroundRecording} = require('./NativeBackgroundRecording');
      stopBackgroundRecording();
      expect(mockStopService).toHaveBeenCalled();
    });
  });

  it('stopBackgroundRecording is a no-op on iOS', () => {
    mockPlatform.OS = 'ios';
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const {stopBackgroundRecording} = require('./NativeBackgroundRecording');
      stopBackgroundRecording();
      expect(mockStopService).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd mobile && npx jest src/native/backgroundRecording/NativeBackgroundRecording.test.ts --no-coverage 2>&1 | tail -20
```

Expected: Tests FAIL with `Cannot find module './NativeBackgroundRecording'`.

- [ ] **Step 3: Create NativeBackgroundRecording.ts**

Create `mobile/src/native/backgroundRecording/NativeBackgroundRecording.ts`:

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

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd mobile && npx jest src/native/backgroundRecording/NativeBackgroundRecording.test.ts --no-coverage 2>&1 | tail -20
```

Expected output:
```
PASS src/native/backgroundRecording/NativeBackgroundRecording.test.ts
  NativeBackgroundRecording
    ✓ BackgroundRecordingEmitter is non-null on Android when module exists
    ✓ BackgroundRecordingEmitter is null on iOS
    ✓ startBackgroundRecording calls native startService on Android
    ✓ startBackgroundRecording is a no-op on iOS
    ✓ stopBackgroundRecording calls native stopService on Android
    ✓ stopBackgroundRecording is a no-op on iOS

Test Suites: 1 passed, 1 total
Tests:       6 passed, 6 total
```

- [ ] **Step 5: Commit**

```bash
git add mobile/src/native/backgroundRecording/NativeBackgroundRecording.ts \
        mobile/src/native/backgroundRecording/NativeBackgroundRecording.test.ts
git commit -m "feat(tts): add NativeBackgroundRecording TS bridge with tests"
```

---

### Task 6: App.tsx + useMeetingSession.ts integration

**Files:**
- Modify: `mobile/src/app/App.tsx` — request POST_NOTIFICATIONS permission at startup
- Modify: `mobile/src/features/meeting/hooks/useMeetingSession.ts` — start/stop service + pause event listener

**Interfaces:**
- Consumes: `startBackgroundRecording`, `stopBackgroundRecording`, `BackgroundRecordingEmitter` from Task 5.

- [ ] **Step 1: Update App.tsx to request POST_NOTIFICATIONS**

The file is at `mobile/src/app/App.tsx`. Replace the entire file:

```typescript
import React, {useEffect} from 'react';
import {Appearance, PermissionsAndroid, Platform, StatusBar} from 'react-native';
import {RootNavigator} from './navigation/RootNavigator';
import {initI18n} from '../i18n';
import {useSettingsStore} from '../shared/store/settingsStore';

export function App(): React.JSX.Element {
  const isLight = Appearance.getColorScheme() === 'light';

  useEffect(() => {
    const applyStored = (state: {appLanguage: string}) => {
      initI18n(state.appLanguage as any);
    };
    if (useSettingsStore.persist.hasHydrated()) {
      applyStored(useSettingsStore.getState());
    }
    const unsub = useSettingsStore.persist.onFinishHydration(applyStored);
    return () => { unsub(); };
  }, []);

  useEffect(() => {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS).catch(
        () => undefined,
      );
    }
  }, []);

  return (
    <>
      <StatusBar barStyle={isLight ? 'dark-content' : 'light-content'} translucent />
      <RootNavigator />
    </>
  );
}

export default App;
```

- [ ] **Step 2: Add imports to useMeetingSession.ts**

In `mobile/src/features/meeting/hooks/useMeetingSession.ts`, find the existing import block (lines 1-44). Add the following import after line 9 (`import {AppState, Platform} from 'react-native';`):

Old line 9:
```typescript
import {AppState, Platform} from 'react-native';
```

New line 9:
```typescript
import {AppState, Platform} from 'react-native';
import {
  startBackgroundRecording,
  stopBackgroundRecording,
  BackgroundRecordingEmitter,
} from '../../../native/backgroundRecording/NativeBackgroundRecording';
```

- [ ] **Step 3: Start foreground service in startMeeting**

In `useMeetingSession.ts`, find this block inside `startMeeting` (around line 1175):

```typescript
          await realSpeechRecognizer.start(sessionId, handleIncomingPipelineEvent, effectiveSourceLanguage);
          console.warn('[useMeetingSession] real recognizer start: success', {sessionId});
          startedWithRealRecognizer = true;
```

Replace with:

```typescript
          await realSpeechRecognizer.start(sessionId, handleIncomingPipelineEvent, effectiveSourceLanguage);
          console.warn('[useMeetingSession] real recognizer start: success', {sessionId});
          startedWithRealRecognizer = true;
          if (Platform.OS === 'android') {
            startBackgroundRecording('MVA', currentSession.startedAt ?? Date.now());
          }
```

- [ ] **Step 4: Stop foreground service in stopMeeting**

In `useMeetingSession.ts`, find this line inside `stopMeeting` (around line 1279):

```typescript
    const currentSession = useMeetingStore.getState().session;
    store.stopSession();
```

Replace with:

```typescript
    const currentSession = useMeetingStore.getState().session;
    if (Platform.OS === 'android') {
      stopBackgroundRecording();
    }
    store.stopSession();
```

- [ ] **Step 5: Add meeting_bg_pause event listener useEffect**

In `useMeetingSession.ts`, find the end of the existing AppState `useEffect` block (around line 1064):

```typescript
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!session.id) {
```

Insert a new `useEffect` between those two blocks:

```typescript
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackgroundRecordingEmitter?.addListener(
      'meeting_bg_pause',
      () => { pauseMeeting(); },
    );
    return () => sub?.remove();
  }, [pauseMeeting]);

  useEffect(() => {
    if (!session.id) {
```

- [ ] **Step 6: TypeScript type-check**

```bash
cd mobile && npx tsc --noEmit 2>&1 | grep -E "error TS|NativeBackground|useMeeting" | head -20
```

Expected: No output (0 errors). If there are errors, fix them before committing.

- [ ] **Step 7: Run existing tests to check no regressions**

```bash
cd mobile && npx jest src/native/backgroundRecording/ src/native/tts/ --no-coverage 2>&1 | tail -20
```

Expected:
```
Test Suites: 2 passed, 2 total
Tests:       10 passed, 10 total
```

- [ ] **Step 8: Commit**

```bash
git add mobile/src/app/App.tsx \
        mobile/src/features/meeting/hooks/useMeetingSession.ts
git commit -m "feat(meeting): start/stop Android background recording foreground service during meeting"
```

---

## Manual Verification Checklist

After all 6 tasks are committed, build and test on a physical Android device (API 29+):

1. **Service starts:** Begin a meeting → pull down notification shade → confirm "MVA" notification with "Recording: MVA" text and a running timer appears.
2. **Background keeps alive:** Lock the screen or switch to another app during a meeting → speak → confirm transcript entries still appear when returning to MVA.
3. **Pause from notification:** Tap the "Pause" button in the notification → confirm the meeting UI transitions to paused state (mic stops, session preserved).
4. **Service stops:** Tap "Stop Meeting" → confirm the notification disappears immediately.
5. **iOS unaffected:** Build and run on iOS → confirm no regressions in meeting flow (service start/stop calls are guarded by `Platform.OS !== 'android'`).
6. **Notification language:** Set Android system language to Vietnamese → start meeting → confirm notification shows "Đang ghi âm:" and "Tạm dừng".

---

## Build Command

```bash
cd mobile/android && ./gradlew assembleDebug
```

For a release APK:
```bash
cd mobile/android && ./gradlew assembleRelease
```

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
  fun pauseService() {
    reactApplicationContext.sendBroadcast(
      Intent(MeetingRecordingService.ACTION_PAUSE_FROM_UI).setPackage(reactApplicationContext.packageName)
    )
  }

  @ReactMethod
  fun resumeService(pausedTotalMs: Double) {
    reactApplicationContext.sendBroadcast(
      Intent(MeetingRecordingService.ACTION_RESUME_FROM_UI).setPackage(reactApplicationContext.packageName)
        .putExtra(MeetingRecordingService.EXTRA_PAUSED_TOTAL_MS, pausedTotalMs.toLong())
    )
  }

  @ReactMethod
  fun stopService() {
    reactApplicationContext.stopService(
      Intent(reactApplicationContext, MeetingRecordingService::class.java)
    )
  }
}

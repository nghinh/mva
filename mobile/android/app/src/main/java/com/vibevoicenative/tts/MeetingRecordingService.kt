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
import android.util.Log
import androidx.core.app.NotificationCompat
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.vibevoicenative.R

class MeetingRecordingService : Service() {

  companion object {
    const val ACTION_PAUSE_MEETING = "com.vibevoicenative.ACTION_PAUSE_MEETING"
    const val ACTION_RESUME_MEETING = "com.vibevoicenative.ACTION_RESUME_MEETING"
    // Sent from JS (UI button) — service updates notification without re-emitting JS event
    const val ACTION_PAUSE_FROM_UI = "com.vibevoicenative.ACTION_PAUSE_FROM_UI"
    const val ACTION_RESUME_FROM_UI = "com.vibevoicenative.ACTION_RESUME_FROM_UI"
    const val EXTRA_MEETING_NAME = "meeting_name"
    const val EXTRA_START_TIMESTAMP = "start_timestamp"
    const val EXTRA_PAUSED_TOTAL_MS = "paused_total_ms"
    const val NOTIFICATION_ID = 1001
    const val CHANNEL_ID = "meeting_recording"
  }

  private var meetingName: String = ""
  private var startTimestamp: Long = 0L
  private var isPaused: Boolean = false
  private var pausedAt: Long = 0L
  private var totalPausedMs: Long = 0L

  private val actionReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      Log.d("MVA_BG", "onReceive action=${intent?.action} isPaused=$isPaused")
      when (intent?.action) {
        ACTION_PAUSE_MEETING -> {
          doPause()
          val ctx = ReactContextHolder.context
          Log.d("MVA_BG", "emit meeting_bg_pause, reactCtx=${ctx != null}")
          ctx?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            ?.emit("meeting_bg_pause", null)
        }
        ACTION_RESUME_MEETING -> {
          doResume()
          val ctx = ReactContextHolder.context
          Log.d("MVA_BG", "emit meeting_bg_resume, reactCtx=${ctx != null}")
          ctx?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            ?.emit("meeting_bg_resume", null)
        }
        ACTION_PAUSE_FROM_UI -> {
          Log.d("MVA_BG", "pause from UI")
          doPause()
        }
        ACTION_RESUME_FROM_UI -> {
          val jsPausedTotalMs = intent?.getLongExtra(EXTRA_PAUSED_TOTAL_MS, -1L) ?: -1L
          Log.d("MVA_BG", "resume from UI, jsPausedTotalMs=$jsPausedTotalMs")
          if (jsPausedTotalMs >= 0) {
            // Use JS store value as source of truth to keep timers in sync
            if (isPaused) {
              isPaused = false
              totalPausedMs = jsPausedTotalMs
              updateNotification()
            }
          } else {
            doResume()
          }
        }
      }
    }
  }

  private fun doPause() {
    Log.d("MVA_BG", "doPause called, already isPaused=$isPaused")
    if (isPaused) return
    isPaused = true
    pausedAt = System.currentTimeMillis()
    updateNotification()
    Log.d("MVA_BG", "doPause done, notification updated")
  }

  private fun doResume() {
    Log.d("MVA_BG", "doResume called, isPaused=$isPaused")
    if (!isPaused) return
    totalPausedMs += System.currentTimeMillis() - pausedAt
    isPaused = false
    updateNotification()
    Log.d("MVA_BG", "doResume done, totalPausedMs=$totalPausedMs")
  }

  override fun onCreate() {
    super.onCreate()
    createNotificationChannel()
    val filter = IntentFilter().apply {
      addAction(ACTION_PAUSE_MEETING)
      addAction(ACTION_RESUME_MEETING)
      addAction(ACTION_PAUSE_FROM_UI)
      addAction(ACTION_RESUME_FROM_UI)
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      registerReceiver(actionReceiver, filter, RECEIVER_NOT_EXPORTED)
    } else {
      @Suppress("UnspecifiedRegisterReceiverFlag")
      registerReceiver(actionReceiver, filter)
    }
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    meetingName = intent?.getStringExtra(EXTRA_MEETING_NAME) ?: getString(R.string.app_name)
    startTimestamp = intent?.getLongExtra(EXTRA_START_TIMESTAMP, System.currentTimeMillis())
      ?: System.currentTimeMillis()
    isPaused = false
    pausedAt = 0L
    totalPausedMs = 0L

    val notification = buildNotification()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
    return START_STICKY
  }

  override fun onDestroy() {
    unregisterReceiver(actionReceiver)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      stopForeground(STOP_FOREGROUND_REMOVE)
    } else {
      @Suppress("DEPRECATION")
      stopForeground(true)
    }
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun updateNotification() {
    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    nm.notify(NOTIFICATION_ID, buildNotification())
  }

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

  private fun buildNotification(): Notification {
    val toggleIntent = if (isPaused) {
      PendingIntent.getBroadcast(
        this, 1,
        Intent(ACTION_RESUME_MEETING).setPackage(packageName),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    } else {
      PendingIntent.getBroadcast(
        this, 0,
        Intent(ACTION_PAUSE_MEETING).setPackage(packageName),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    }

    val toggleLabel = if (isPaused) {
      getString(R.string.notification_action_resume)
    } else {
      getString(R.string.notification_action_pause)
    }

    val openAppIntent = PendingIntent.getActivity(
      this,
      2,
      packageManager.getLaunchIntentForPackage(packageName)?.apply {
        addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
      },
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    val builder = NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_btn_speak_now)
      .setContentTitle(getString(R.string.app_name))
      .setContentText("${getString(R.string.notification_recording)} $meetingName")
      .setContentIntent(openAppIntent)
      .addAction(0, toggleLabel, toggleIntent)
      .setOngoing(true)

    if (isPaused) {
      val elapsedAtPause = pausedAt - startTimestamp - totalPausedMs
      val minutes = (elapsedAtPause / 60000).toInt()
      val seconds = ((elapsedAtPause % 60000) / 1000).toInt()
      builder
        .setUsesChronometer(false)
        .setShowWhen(false)
        .setContentText(
          "${getString(R.string.notification_recording)} $meetingName  %02d:%02d ⏸".format(minutes, seconds)
        )
    } else {
      builder
        .setUsesChronometer(true)
        .setShowWhen(true)
        .setWhen(startTimestamp + totalPausedMs)
    }

    return builder.build()
  }
}

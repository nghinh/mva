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
import com.vibevoicenative.R

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

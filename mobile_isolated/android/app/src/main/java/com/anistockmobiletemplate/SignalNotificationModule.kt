package com.anistockmobiletemplate

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.media.AudioManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class SignalNotificationModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "SignalNotification"

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }
    val manager = reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (manager.getNotificationChannel(CHANNEL_ID) != null) {
      return
    }
    val channel =
        NotificationChannel(CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_HIGH).apply {
          description = "New advisor and entry-ready trading signals"
          enableVibration(true)
          vibrationPattern = VIBRATION_PATTERN
        }
    manager.createNotificationChannel(channel)
  }

  private fun isSilentOrVibrateOnly(): Boolean {
    val audio = reactContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    val mode = audio.ringerMode
    return mode == AudioManager.RINGER_MODE_SILENT || mode == AudioManager.RINGER_MODE_VIBRATE
  }

  @ReactMethod
  fun show(title: String, message: String, promise: Promise) {
    try {
      ensureChannel()
      val silentOrVibrateOnly = isSilentOrVibrateOnly()
      val builder =
          NotificationCompat.Builder(reactContext, CHANNEL_ID)
              .setSmallIcon(R.mipmap.ic_launcher)
              .setContentTitle(title.ifBlank { "ANI Stock signal" })
              .setContentText(message.ifBlank { "Tap to open signals" })
              .setStyle(NotificationCompat.BigTextStyle().bigText(message))
              .setPriority(NotificationCompat.PRIORITY_HIGH)
              .setCategory(NotificationCompat.CATEGORY_RECOMMENDATION)
              .setAutoCancel(true)

      if (silentOrVibrateOnly) {
        builder.setSound(null)
        builder.setVibrate(VIBRATION_PATTERN)
        builder.setDefaults(NotificationCompat.DEFAULT_VIBRATE)
      } else {
        builder.setDefaults(NotificationCompat.DEFAULT_ALL)
      }

      val manager = NotificationManagerCompat.from(reactContext)
      val notificationId = (System.currentTimeMillis() % Int.MAX_VALUE).toInt()
      manager.notify(notificationId, builder.build())
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("NOTIFY_FAILED", error.message ?: "Could not show signal notification.", error)
    }
  }

  companion object {
    private const val CHANNEL_ID = "advisor_signals"
    private const val CHANNEL_NAME = "Advisor signals"
    private val VIBRATION_PATTERN = longArrayOf(0, 280, 120, 280)
  }
}

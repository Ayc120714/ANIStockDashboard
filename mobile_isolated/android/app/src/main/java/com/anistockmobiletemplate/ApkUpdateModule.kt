package com.anistockmobiletemplate

import android.app.PendingIntent
import android.content.ClipData
import android.content.Intent
import android.content.pm.PackageInstaller
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL

class ApkUpdateModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "ApkUpdate"

  @ReactMethod
  fun downloadAndInstall(apkUrl: String, promise: Promise) {
    val activity = reactContext.currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "Cannot start update — app activity is not available.")
      return
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
        !activity.packageManager.canRequestPackageInstalls()) {
      try {
        val settingsIntent =
            Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES)
                .setData(Uri.parse("package:${reactContext.packageName}"))
        activity.startActivity(settingsIntent)
      } catch (_: Exception) {
        // Settings screen unavailable on some devices.
      }
      promise.reject(
          "INSTALL_PERMISSION",
          "Allow \"Install unknown apps\" for ANI Stock in Settings, then tap Update again.")
      return
    }

    Thread {
          try {
            val file = downloadApk(apkUrl)
            activity.runOnUiThread {
              try {
                installApk(file)
                promise.resolve(true)
              } catch (e: Exception) {
                promise.reject(
                    "INSTALL_FAILED", e.message ?: "Could not open the package installer.", e)
              }
            }
          } catch (e: Exception) {
            promise.reject("DOWNLOAD_FAILED", e.message ?: "Could not download the update APK.", e)
          }
        }
        .start()
  }

  private fun installApk(apkFile: File) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
      try {
        installWithPackageInstaller(apkFile)
        return
      } catch (_: Exception) {
        // Fall back to the system package viewer intent.
      }
    }
    launchPackageInstallerIntent(apkFile)
  }

  private fun installWithPackageInstaller(apkFile: File) {
    val installer = reactContext.packageManager.packageInstaller
    val params =
        PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)
    val sessionId = installer.createSession(params)
    val session = installer.openSession(sessionId)
    FileInputStream(apkFile).use { input ->
      session.openWrite("base.apk", 0, apkFile.length()).use { output ->
        input.copyTo(output)
        session.fsync(output)
      }
    }
    val callbackIntent =
        Intent(reactContext, InstallResultReceiver::class.java).apply {
          action = InstallResultReceiver.ACTION
        }
    val pendingFlags =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        } else {
          PendingIntent.FLAG_UPDATE_CURRENT
        }
    val pendingIntent =
        PendingIntent.getBroadcast(reactContext, sessionId, callbackIntent, pendingFlags)
    session.commit(pendingIntent.intentSender)
    session.close()
  }

  private fun launchPackageInstallerIntent(apkFile: File) {
    val activity =
        reactContext.currentActivity ?: throw IllegalStateException("Activity not available.")
    val authority = "${reactContext.packageName}.fileprovider"
    val uri = FileProvider.getUriForFile(reactContext, authority, apkFile)
    val intent =
        Intent(Intent.ACTION_VIEW).apply {
          setDataAndType(uri, "application/vnd.android.package-archive")
          addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
          clipData = ClipData.newRawUri("", uri)
        }
    activity.startActivity(intent)
  }

  private fun downloadApk(apkUrl: String): File {
    val connection = openConnectionFollowingRedirects(apkUrl)
    try {
      val code = connection.responseCode
      if (code !in 200..299) {
        throw IllegalStateException("Download failed with HTTP $code")
      }
      val outFile = File(reactContext.cacheDir, "ani-stock-update.apk")
      connection.inputStream.use { input ->
        FileOutputStream(outFile).use { output -> input.copyTo(output) }
      }
      if (!outFile.exists() || outFile.length() < 1024) {
        throw IllegalStateException("Downloaded APK file is empty or missing.")
      }
      validateApkMagic(outFile)
      return outFile
    } finally {
      connection.disconnect()
    }
  }

  private fun validateApkMagic(apkFile: File) {
    FileInputStream(apkFile).use { input ->
      val header = ByteArray(4)
      if (input.read(header) != 4) {
        throw IllegalStateException("Downloaded file is not a valid APK.")
      }
      // ZIP local file header signature (APK is a ZIP archive).
      if (header[0] != 0x50.toByte() || header[1] != 0x4B.toByte()) {
        throw IllegalStateException("Downloaded file is not a valid APK.")
      }
    }
  }

  private fun openConnectionFollowingRedirects(startUrl: String): HttpURLConnection {
    var url = URL(startUrl)
    repeat(5) {
      val connection = (url.openConnection() as HttpURLConnection).apply {
        instanceFollowRedirects = false
        connectTimeout = 30_000
        readTimeout = 120_000
        requestMethod = "GET"
        setRequestProperty("Accept", "application/vnd.android.package-archive,*/*")
      }
      when (connection.responseCode) {
        HttpURLConnection.HTTP_MOVED_PERM,
        HttpURLConnection.HTTP_MOVED_TEMP,
        HttpURLConnection.HTTP_SEE_OTHER,
        307,
        308 -> {
          val next = connection.getHeaderField("Location")
          connection.disconnect()
          if (next.isNullOrBlank()) {
            throw IllegalStateException("Redirect response missing Location header.")
          }
          url = URL(next)
        }
        else -> return connection
      }
    }
    throw IllegalStateException("Too many redirects while downloading APK.")
  }
}

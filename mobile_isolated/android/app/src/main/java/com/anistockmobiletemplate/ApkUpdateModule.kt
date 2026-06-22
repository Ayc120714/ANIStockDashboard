package com.anistockmobiletemplate

import android.app.Activity
import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.widget.Toast
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

  private var downloadReceiver: BroadcastReceiver? = null

  override fun getName(): String = "ApkUpdate"

  @ReactMethod
  fun canRequestPackageInstalls(promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      promise.resolve(true)
      return
    }
    promise.resolve(reactContext.packageManager.canRequestPackageInstalls())
  }

  @ReactMethod
  fun downloadAndInstall(apkUrl: String, promise: Promise) {
    downloadAndInstallWithActivityRetry(apkUrl, promise, 0)
  }

  @ReactMethod
  fun installDownloadedApkIfPresent(promise: Promise) {
    val activity = reactContext.currentActivity
    if (activity == null) {
      promise.resolve(false)
      return
    }

    val apkFile =
        File(
            reactContext.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS),
            "ani-stock-release.apk",
        )
    if (!apkFile.exists() || apkFile.length() < 1024) {
      promise.resolve(false)
      return
    }

    try {
      validateApkMagic(apkFile)
      launchPackageInstallerIntent(activity, apkFile)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.resolve(false)
    }
  }

  @ReactMethod
  fun openApkInBrowser(apkUrl: String, promise: Promise) {
    try {
      val activity = reactContext.currentActivity
      val intent =
          Intent(Intent.ACTION_VIEW, Uri.parse(apkUrl)).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          }
      if (activity != null) {
        activity.startActivity(intent)
      } else {
        reactContext.startActivity(intent)
      }
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("OPEN_BROWSER_FAILED", e.message ?: "Could not open download link.", e)
    }
  }

  private fun downloadAndInstallWithActivityRetry(
      apkUrl: String,
      promise: Promise,
      attempt: Int,
  ) {
    val activity = reactContext.currentActivity
    if (activity == null) {
      if (attempt < 15) {
        Handler(Looper.getMainLooper())
            .postDelayed({ downloadAndInstallWithActivityRetry(apkUrl, promise, attempt + 1) }, 200)
        return
      }
      promise.reject("NO_ACTIVITY", "Cannot start update — app activity is not available.")
      return
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
        !reactContext.packageManager.canRequestPackageInstalls()) {
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
          "Allow \"Install unknown apps\" for ANI Stock in Settings, then return to the app.")
      return
    }

    Toast.makeText(activity, "Downloading update…", Toast.LENGTH_LONG).show()

    try {
      enqueueDownloadManager(activity, apkUrl, promise)
    } catch (e: Exception) {
      downloadInlineFallback(activity, apkUrl, promise)
    }
  }

  private fun enqueueDownloadManager(activity: Activity, apkUrl: String, promise: Promise) {
    ensureDownloadReceiverRegistered()
    val dm = reactContext.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
    val fileName = "ani-stock-release.apk"
    val request =
        DownloadManager.Request(Uri.parse(apkUrl)).apply {
          setTitle("ANI Stock update")
          setDescription("Downloading the latest app version")
          setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
          setAllowedOverMetered(true)
          setAllowedOverRoaming(true)
          setMimeType("application/vnd.android.package-archive")
          setDestinationInExternalFilesDir(
              reactContext, Environment.DIRECTORY_DOWNLOADS, fileName)
        }

    synchronized(ApkDownloadCoordinator) {
      ApkDownloadCoordinator.promise = promise
      ApkDownloadCoordinator.downloadId = dm.enqueue(request)
    }
  }

  private fun ensureDownloadReceiverRegistered() {
    if (downloadReceiver != null) return
    downloadReceiver = ApkDownloadReceiver()
    val filter = IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      reactContext.registerReceiver(downloadReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
    } else {
      reactContext.registerReceiver(downloadReceiver, filter)
    }
  }

  /** Fallback when DownloadManager is unavailable on the device. */
  private fun downloadInlineFallback(activity: Activity, apkUrl: String, promise: Promise) {
    Thread {
          try {
            val file = downloadApkInline(apkUrl)
            activity.runOnUiThread {
              try {
                launchPackageInstallerIntent(activity, file)
                promise.resolve(true)
              } catch (e: Exception) {
                promise.reject(
                    "INSTALL_FAILED", e.message ?: "Could not open the package installer.", e)
              }
            }
          } catch (e: Exception) {
            activity.runOnUiThread {
              promise.reject("DOWNLOAD_FAILED", e.message ?: "Could not download the update APK.", e)
            }
          }
        }
        .start()
  }

  private fun launchPackageInstallerIntent(activity: Activity, apkFile: File) {
    val authority = "${reactContext.packageName}.fileprovider"
    val uri = FileProvider.getUriForFile(reactContext, authority, apkFile)
    val installIntent =
        Intent(Intent.ACTION_VIEW).apply {
          setDataAndType(uri, "application/vnd.android.package-archive")
          addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
          clipData = ClipData.newRawUri("apk", uri)
        }

    val packageManager = activity.packageManager
    if (installIntent.resolveActivity(packageManager) == null) {
      throw IllegalStateException("No app on this device can install APK files.")
    }

    val chooser =
        Intent.createChooser(installIntent, "Install ANI Stock update").apply {
          addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
          if (clipData == null) {
            clipData = ClipData.newRawUri("apk", uri)
          }
        }
    activity.startActivity(chooser)
  }

  private fun downloadApkInline(apkUrl: String): File {
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
        connectTimeout = 60_000
        readTimeout = 600_000
        requestMethod = "GET"
        setRequestProperty("Accept", "application/vnd.android.package-archive,*/*")
        setRequestProperty("User-Agent", "ANIStockMobile/1.0")
      }
      connection.connect()
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
          url = if (next.startsWith("http")) URL(next) else URL(url, next)
        }
        else -> return connection
      }
    }
    throw IllegalStateException("Too many redirects while downloading APK.")
  }
}

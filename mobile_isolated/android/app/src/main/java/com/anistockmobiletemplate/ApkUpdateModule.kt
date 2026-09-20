package com.anistockmobiletemplate

import android.app.Activity
import android.app.DownloadManager
import android.content.BroadcastReceiver
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
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL

class ApkUpdateModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  private var downloadReceiver: BroadcastReceiver? = null
  private val mainHandler = Handler(Looper.getMainLooper())

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

    val apkFile = ApkInstallHelper.existingInstallableApk(reactContext)
    if (apkFile == null) {
      promise.resolve(false)
      return
    }

    ApkDownloadCoordinator.installStarted = false
    ApkInstallHelper.launchInstallerAsync(
        activity,
        apkFile,
        { promise.resolve(true) },
        {
          ApkDownloadCoordinator.installStarted = false
          // Stale/corrupt leftover — delete so the next attempt re-downloads.
          ApkInstallHelper.deleteStaleDownloads(reactContext)
          promise.resolve(false)
        },
    )
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
        mainHandler.postDelayed(
            { downloadAndInstallWithActivityRetry(apkUrl, promise, attempt + 1) }, 200)
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

    val cached = ApkInstallHelper.existingInstallableApk(reactContext)
    if (cached != null) {
      ApkDownloadCoordinator.beginDownload(promise, -1L)
      if (ApkDownloadCoordinator.markInstallStarted()) {
        ApkInstallHelper.launchInstallerAsync(
            activity,
            cached,
            { ApkDownloadCoordinator.resolveIfPending() },
            {
              ApkDownloadCoordinator.installStarted = false
              ApkInstallHelper.deleteStaleDownloads(reactContext)
              downloadInlineFallback(
                  activity, apkUrl, ApkDownloadCoordinator.takePromise() ?: promise)
            },
        )
        return
      }
    }

    // Drop any corrupt leftover so DownloadManager / inline write a fresh file.
    ApkInstallHelper.deleteStaleDownloads(reactContext)
    Toast.makeText(activity, "Downloading update…", Toast.LENGTH_LONG).show()

    // Inline HTTP first — more reliable than DownloadManager for app-private installs.
    // DownloadManager remains as a secondary path if inline fails mid-flight.
    downloadInlineFallback(activity, apkUrl, promise)
  }

  private fun enqueueDownloadManager(activity: Activity, apkUrl: String, promise: Promise) {
    ensureDownloadReceiverRegistered()
    ApkInstallHelper.deleteStaleDownloads(reactContext)
    val dm = reactContext.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
    val request =
        DownloadManager.Request(Uri.parse(apkUrl)).apply {
          setTitle("ANI Stock update")
          setDescription("Downloading the latest app version")
          setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
          setAllowedOverMetered(true)
          setAllowedOverRoaming(true)
          setMimeType("application/vnd.android.package-archive")
          // Prefer app-specific external files dir (avoids file:// Uri.fromFile failures on API 29+).
          setDestinationInExternalFilesDir(
              reactContext, Environment.DIRECTORY_DOWNLOADS, ApkInstallHelper.DOWNLOAD_FILE_NAME)
        }

    val downloadId = dm.enqueue(request)
    ApkDownloadCoordinator.beginDownload(promise, downloadId)
    watchDownload(activity, apkUrl)
  }

  private fun watchDownload(activity: Activity, apkUrl: String) {
    val id = ApkDownloadCoordinator.downloadId
    val poller =
        object : Runnable {
          private var ticks = 0

          override fun run() {
            if (ApkDownloadCoordinator.downloadId != id || id < 0) {
              return
            }
            ticks += 1
            val dm = reactContext.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            dm.query(DownloadManager.Query().setFilterById(id)).use { cursor ->
              if (!cursor.moveToFirst()) {
                if (ticks >= 900) {
                  fallbackInline(activity, apkUrl)
                } else {
                  mainHandler.postDelayed(this, 1000)
                }
                return
              }
              val status =
                  cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
              when (status) {
                DownloadManager.STATUS_SUCCESSFUL -> installDownloadedAndResolve(activity, apkUrl)
                DownloadManager.STATUS_FAILED -> fallbackInline(activity, apkUrl)
                else -> {
                  if (ticks >= 900) {
                    fallbackInline(activity, apkUrl)
                  } else {
                    mainHandler.postDelayed(this, 1000)
                  }
                }
              }
            }
          }
        }
    mainHandler.postDelayed(poller, 1500)
  }

  private fun installDownloadedAndResolve(activity: Activity, apkUrl: String) {
    if (!ApkDownloadCoordinator.markInstallStarted()) {
      return
    }
    val apkFile =
        ApkInstallHelper.existingInstallableApk(reactContext)
            ?: ApkInstallHelper.downloadDestination(reactContext)
    if (!ApkInstallHelper.isNewerInstallableApk(reactContext, apkFile)) {
      ApkDownloadCoordinator.installStarted = false
      ApkInstallHelper.deleteStaleDownloads(reactContext)
      fallbackInline(activity, apkUrl)
      return
    }
    ApkInstallHelper.launchInstallerAsync(
        activity,
        apkFile,
        { ApkDownloadCoordinator.resolveIfPending() },
        { error ->
          ApkDownloadCoordinator.installStarted = false
          ApkDownloadCoordinator.rejectIfPending(
              "INSTALL_FAILED", error.message ?: "Could not open the package installer.")
        },
    )
  }

  private fun fallbackInline(activity: Activity, apkUrl: String) {
    val pending = ApkDownloadCoordinator.takePromise() ?: return
    downloadInlineFallback(activity, apkUrl, pending)
  }

  private fun ensureDownloadReceiverRegistered() {
    if (downloadReceiver != null) return
    downloadReceiver = ApkDownloadReceiver()
    val filter = IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      reactContext.registerReceiver(downloadReceiver, filter, Context.RECEIVER_EXPORTED)
    } else {
      reactContext.registerReceiver(downloadReceiver, filter)
    }
  }

  /** Primary download path: in-process HTTPS to app cache, then PackageInstaller. */
  private fun downloadInlineFallback(activity: Activity, apkUrl: String, promise: Promise) {
    Thread {
          try {
            val file = downloadApkInline(apkUrl)
            activity.runOnUiThread {
              ApkInstallHelper.launchInstallerAsync(
                  activity,
                  file,
                  { promise.resolve(true) },
                  { e ->
                    // Last resort: system DownloadManager (notification shade progress).
                    try {
                      enqueueDownloadManager(activity, apkUrl, promise)
                    } catch (dmError: Exception) {
                      promise.reject(
                          "INSTALL_FAILED",
                          e.message
                              ?: dmError.message
                              ?: "Could not open the package installer.",
                          e)
                    }
                  },
              )
            }
          } catch (e: Exception) {
            activity.runOnUiThread {
              try {
                enqueueDownloadManager(activity, apkUrl, promise)
              } catch (dmError: Exception) {
                promise.reject(
                    "DOWNLOAD_FAILED",
                    e.message ?: dmError.message ?: "Could not download the update APK.",
                    e)
              }
            }
          }
        }
        .start()
  }

  private fun downloadApkInline(apkUrl: String): File {
    val connection = openConnectionFollowingRedirects(apkUrl)
    try {
      val code = connection.responseCode
      if (code !in 200..299) {
        throw IllegalStateException("Download failed with HTTP $code")
      }
      val outFile = ApkInstallHelper.cacheDestination(reactContext)
      if (outFile.exists()) {
        outFile.delete()
      }
      connection.inputStream.use { input ->
        FileOutputStream(outFile).use { output -> input.copyTo(output) }
      }
      if (!ApkInstallHelper.isNewerInstallableApk(reactContext, outFile)) {
        outFile.delete()
        throw IllegalStateException(
            "Downloaded APK is empty, corrupt, or not newer than the installed app.")
      }
      return outFile
    } finally {
      connection.disconnect()
    }
  }

  private fun openConnectionFollowingRedirects(startUrl: String): HttpURLConnection {
    var url = URL(startUrl)
    repeat(5) {
      val connection =
          (url.openConnection() as HttpURLConnection).apply {
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

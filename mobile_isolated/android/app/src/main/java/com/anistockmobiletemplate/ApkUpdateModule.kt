package com.anistockmobiletemplate

import android.content.Intent
import androidx.core.content.FileProvider
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

  override fun getName(): String = "ApkUpdate"

  @ReactMethod
  fun downloadAndInstall(apkUrl: String, promise: Promise) {
    val activity = reactContext.currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "Cannot start update — app activity is not available.")
      return
    }

    Thread {
      try {
        val file = downloadApk(apkUrl)
        activity.runOnUiThread {
          try {
            launchPackageInstaller(file)
            promise.resolve(true)
          } catch (e: Exception) {
            promise.reject("INSTALL_FAILED", e.message ?: "Could not open the package installer.", e)
          }
        }
      } catch (e: Exception) {
        promise.reject("DOWNLOAD_FAILED", e.message ?: "Could not download the update APK.", e)
      }
    }.start()
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
      return outFile
    } finally {
      connection.disconnect()
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

  private fun launchPackageInstaller(apkFile: File) {
    val authority = "${reactContext.packageName}.fileprovider"
    val uri = FileProvider.getUriForFile(reactContext, authority, apkFile)
    val intent =
        Intent(Intent.ACTION_VIEW).apply {
          setDataAndType(uri, "application/vnd.android.package-archive")
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
    val activity = reactContext.currentActivity ?: throw IllegalStateException("Activity not available.")
    activity.startActivity(intent)
  }
}

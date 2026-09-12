package com.anistockmobiletemplate

import android.app.PendingIntent
import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.content.pm.PackageManager
import android.os.Build
import android.os.Environment
import android.os.Handler
import android.os.Looper
import androidx.core.content.FileProvider
import java.io.File
import java.io.FileInputStream
import java.util.concurrent.CountDownLatch

/** Shared APK destination + installer launch for DownloadManager and inline downloads. */
object ApkInstallHelper {
  const val DOWNLOAD_FILE_NAME = "ani-stock-release.apk"
  const val CACHE_FILE_NAME = "ani-stock-update.apk"

  fun downloadDestination(context: Context): File {
    val dir =
        context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
            ?: File(context.filesDir, "Download").apply { mkdirs() }
    if (!dir.exists()) {
      dir.mkdirs()
    }
    return File(dir, DOWNLOAD_FILE_NAME)
  }

  fun cacheDestination(context: Context): File = File(context.cacheDir, CACHE_FILE_NAME)

  fun existingInstallableApk(context: Context): File? {
    return listOf(downloadDestination(context), cacheDestination(context)).firstOrNull { file ->
      isInstallableApk(file)
    }
  }

  fun deleteStaleDownloads(context: Context) {
    listOf(downloadDestination(context), cacheDestination(context)).forEach { file ->
      if (file.exists()) {
        file.delete()
      }
    }
  }

  fun isInstallableApk(file: File): Boolean {
    if (!file.exists() || file.length() < 1024) {
      return false
    }
    return hasZipMagic(file)
  }

  fun hasZipMagic(file: File): Boolean {
    FileInputStream(file).use { input ->
      val header = ByteArray(4)
      if (input.read(header) != 4) {
        return false
      }
      return header[0] == 0x50.toByte() && header[1] == 0x4B.toByte()
    }
  }

  fun launchInstaller(context: Context, apkFile: File) {
    ApkDownloadCoordinator.lastApkPath = apkFile.absolutePath
    try {
      commitPackageInstallerSession(context, apkFile)
    } catch (_: Exception) {
      runOnMainThread { launchViewIntent(context, apkFile) }
    }
  }

  fun launchInstallerAsync(
      context: Context,
      apkFile: File,
      onLaunched: () -> Unit,
      onError: (Exception) -> Unit,
  ) {
    Thread {
          try {
            launchInstaller(context, apkFile)
            Handler(Looper.getMainLooper()).post { onLaunched() }
          } catch (error: Exception) {
            Handler(Looper.getMainLooper()).post { onError(error) }
          }
        }
        .start()
  }

  fun launchViewIntent(context: Context, apkFile: File) {
    val authority = "${context.packageName}.fileprovider"
    val uri = FileProvider.getUriForFile(context, authority, apkFile)
    val installIntent =
        Intent(Intent.ACTION_VIEW).apply {
          setDataAndType(uri, "application/vnd.android.package-archive")
          addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          clipData = ClipData.newRawUri("apk", uri)
        }

    val resolver = context.packageManager
    val matches = resolver.queryIntentActivities(installIntent, PackageManager.MATCH_DEFAULT_ONLY)
    for (resolveInfo in matches) {
      val packageName = resolveInfo.activityInfo?.packageName ?: continue
      context.grantUriPermission(
          packageName,
          uri,
          Intent.FLAG_GRANT_READ_URI_PERMISSION,
      )
    }

    if (installIntent.resolveActivity(resolver) == null) {
      throw IllegalStateException("No app on this device can install APK files.")
    }
    context.startActivity(installIntent)
  }

  private fun commitPackageInstallerSession(context: Context, apkFile: File) {
    val installer = context.packageManager.packageInstaller
    val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)
    params.setAppPackageName(context.packageName)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_REQUIRED)
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      params.setPackageSource(PackageInstaller.PACKAGE_SOURCE_LOCAL_FILE)
    }

    val sessionId = installer.createSession(params)
    installer.openSession(sessionId).use { session ->
      session.openWrite(DOWNLOAD_FILE_NAME, 0, apkFile.length()).use { out ->
        FileInputStream(apkFile).use { input -> input.copyTo(out) }
        session.fsync(out)
      }

      val callbackIntent =
          Intent(context, InstallResultReceiver::class.java).apply {
            action = InstallResultReceiver.ACTION
          }
      var flags = PendingIntent.FLAG_UPDATE_CURRENT
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        flags = flags or PendingIntent.FLAG_MUTABLE
      }
      val pending = PendingIntent.getBroadcast(context, sessionId, callbackIntent, flags)
      session.commit(pending.intentSender)
    }
  }

  private fun runOnMainThread(block: () -> Unit) {
    if (Looper.myLooper() == Looper.getMainLooper()) {
      block()
      return
    }
    val latch = CountDownLatch(1)
    var error: Exception? = null
    Handler(Looper.getMainLooper()).post {
      try {
        block()
      } catch (e: Exception) {
        error = e
      } finally {
        latch.countDown()
      }
    }
    latch.await()
    error?.let { throw it }
  }
}

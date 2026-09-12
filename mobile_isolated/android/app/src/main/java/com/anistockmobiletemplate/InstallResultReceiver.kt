package com.anistockmobiletemplate

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.os.Build
import android.widget.Toast
import java.io.File

class InstallResultReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)
    when (status) {
      PackageInstaller.STATUS_PENDING_USER_ACTION -> {
        val confirmIntent = extraConfirmIntent(intent) ?: return
        confirmIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try {
          context.startActivity(confirmIntent)
        } catch (_: Exception) {
          fallbackViewInstall(context)
        }
      }
      PackageInstaller.STATUS_SUCCESS -> {
        AppRelauncher.reopen(context)
      }
      PackageInstaller.STATUS_FAILURE_ABORTED -> {
        // User cancelled the system install sheet.
      }
      PackageInstaller.STATUS_FAILURE,
      PackageInstaller.STATUS_FAILURE_BLOCKED,
      PackageInstaller.STATUS_FAILURE_CONFLICT,
      PackageInstaller.STATUS_FAILURE_INCOMPATIBLE,
      PackageInstaller.STATUS_FAILURE_INVALID,
      PackageInstaller.STATUS_FAILURE_STORAGE -> {
        fallbackViewInstall(context)
      }
      else -> fallbackViewInstall(context)
    }
  }

  private fun extraConfirmIntent(intent: Intent): Intent? {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent::class.java)
    } else {
      @Suppress("DEPRECATION")
      intent.getParcelableExtra(Intent.EXTRA_INTENT)
    }
  }

  private fun fallbackViewInstall(context: Context) {
    val path = ApkDownloadCoordinator.lastApkPath ?: return
    val apkFile = File(path)
    if (!ApkInstallHelper.isInstallableApk(apkFile)) {
      return
    }
    try {
      ApkInstallHelper.launchViewIntent(context, apkFile)
    } catch (_: Exception) {
      Toast.makeText(
              context,
              "Open Downloads and tap ani-stock-release.apk to finish installing.",
              Toast.LENGTH_LONG)
          .show()
    }
  }

  companion object {
    const val ACTION = "com.anistockmobiletemplate.APK_INSTALL_STATUS"
  }
}

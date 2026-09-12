package com.anistockmobiletemplate

import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.widget.Toast

class ApkDownloadReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (DownloadManager.ACTION_DOWNLOAD_COMPLETE != intent.action) return

    val finishedId = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L)
    if (finishedId < 0 || finishedId != ApkDownloadCoordinator.downloadId) return

    val dm = context.getSystemService(DownloadManager::class.java)
    val query = DownloadManager.Query().setFilterById(finishedId)
    dm.query(query).use { cursor ->
      if (!cursor.moveToFirst()) {
        return
      }

      val status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
      when (status) {
        DownloadManager.STATUS_SUCCESSFUL -> {
          val apkFile =
              ApkInstallHelper.existingInstallableApk(context)
                  ?: ApkInstallHelper.downloadDestination(context)
          if (!ApkInstallHelper.isInstallableApk(apkFile)) {
            return
          }
          if (!ApkDownloadCoordinator.markInstallStarted()) {
            return
          }
          ApkInstallHelper.launchInstallerAsync(
              context,
              apkFile,
              {
                Toast.makeText(context, "Tap Install to finish updating.", Toast.LENGTH_LONG)
                    .show()
                ApkDownloadCoordinator.resolveIfPending()
              },
              { error ->
                ApkDownloadCoordinator.installStarted = false
                ApkDownloadCoordinator.rejectIfPending(
                    "INSTALL_FAILED",
                    error.message ?: "Could not open the package installer.",
                )
              },
          )
        }
        DownloadManager.STATUS_FAILED -> {
          // Leave the promise pending so ApkUpdateModule.watchDownload can
          // fall back to an in-process HTTP download instead of failing the
          // in-app update immediately.
        }
        else -> {
          // ACTION_DOWNLOAD_COMPLETE should only fire for a terminal state.
          // Ignore non-success here; the poller handles timeout/fallback.
        }
      }
    }
  }
}

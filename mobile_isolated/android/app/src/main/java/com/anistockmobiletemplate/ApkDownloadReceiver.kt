package com.anistockmobiletemplate

import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
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
        ApkDownloadCoordinator.rejectIfPending("DOWNLOAD_FAILED", "Download record not found.")
        return
      }

      val status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
      when (status) {
        DownloadManager.STATUS_SUCCESSFUL -> {
          try {
            val uri = dm.getUriForDownloadedFile(finishedId)
            if (uri == null) {
              throw IllegalStateException("Downloaded APK URI is missing.")
            }
            launchInstallIntent(context, uri)
            Toast.makeText(context, "Tap Install to finish updating.", Toast.LENGTH_LONG).show()
            ApkDownloadCoordinator.resolveIfPending()
          } catch (e: Exception) {
            ApkDownloadCoordinator.rejectIfPending(
                "INSTALL_FAILED", e.message ?: "Could not open the package installer.")
          }
        }
        DownloadManager.STATUS_FAILED -> {
          val reason =
              cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON))
          ApkDownloadCoordinator.rejectIfPending(
              "DOWNLOAD_FAILED", "Download failed (reason $reason). Check connection and retry.")
        }
        else -> {
          ApkDownloadCoordinator.rejectIfPending(
              "DOWNLOAD_FAILED", "Download did not complete (status $status).")
        }
      }
    }
  }

  private fun launchInstallIntent(context: Context, uri: Uri) {
    val installIntent =
        Intent(Intent.ACTION_VIEW).apply {
          setDataAndType(uri, "application/vnd.android.package-archive")
          addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
    context.startActivity(installIntent)
  }
}

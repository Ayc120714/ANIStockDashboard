package com.anistockmobiletemplate

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller

class InstallResultReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)
    if (status == PackageInstaller.STATUS_SUCCESS) {
      AppRelauncher.reopen(context)
    }
  }

  companion object {
    const val ACTION = "com.anistockmobiletemplate.APK_INSTALL_STATUS"
  }
}

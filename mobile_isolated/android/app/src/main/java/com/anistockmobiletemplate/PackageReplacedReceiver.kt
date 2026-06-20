package com.anistockmobiletemplate

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Relaunch after the user completes an in-app APK update. */
class PackageReplacedReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (Intent.ACTION_MY_PACKAGE_REPLACED == intent.action) {
      AppRelauncher.reopen(context)
    }
  }
}

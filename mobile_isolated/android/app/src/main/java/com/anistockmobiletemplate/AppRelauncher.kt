package com.anistockmobiletemplate

import android.content.Context
import android.content.Intent

object AppRelauncher {
  fun reopen(context: Context) {
    val launch =
        context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return
    launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    context.startActivity(launch)
  }
}

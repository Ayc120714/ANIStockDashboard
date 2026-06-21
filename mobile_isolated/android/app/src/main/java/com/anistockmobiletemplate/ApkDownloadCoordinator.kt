package com.anistockmobiletemplate

import com.facebook.react.bridge.Promise

/** Holds the in-flight DownloadManager promise (one update at a time). */
object ApkDownloadCoordinator {
  @Volatile var promise: Promise? = null
  @Volatile var downloadId: Long = -1L

  fun rejectIfPending(code: String, message: String) {
    synchronized(this) {
      val pending = promise ?: return
      promise = null
      downloadId = -1L
      pending.reject(code, message)
    }
  }

  fun resolveIfPending() {
    synchronized(this) {
      val pending = promise ?: return
      promise = null
      downloadId = -1L
      pending.resolve(true)
    }
  }
}

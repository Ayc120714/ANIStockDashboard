package com.anistockmobiletemplate

import com.facebook.react.bridge.Promise

/** Holds the in-flight DownloadManager promise (one update at a time). */
object ApkDownloadCoordinator {
  @Volatile var promise: Promise? = null
  @Volatile var downloadId: Long = -1L
  @Volatile var installStarted: Boolean = false
  @Volatile var lastApkPath: String? = null

  fun beginDownload(pending: Promise, id: Long) {
    synchronized(this) {
      promise = pending
      downloadId = id
      installStarted = false
    }
  }

  fun markInstallStarted(): Boolean {
    synchronized(this) {
      if (installStarted) return false
      installStarted = true
      return true
    }
  }

  fun takePromise(): Promise? {
    synchronized(this) {
      val pending = promise
      promise = null
      downloadId = -1L
      return pending
    }
  }

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

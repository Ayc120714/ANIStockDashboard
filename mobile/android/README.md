# Android Build & Install

This folder is isolated for Android native configuration, signing keys, and Gradle files.

Use these commands from `mobile/`:

- `npm run android` to run on a connected Android device/emulator.
- `npm run android:apk:debug` to build debug APK.
- `npm run android:apk:release` to build release APK.
- `npm run android:aab:release` to build Play Store AAB.

Install built APK on a connected device:

- `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`
- `adb install -r android/app/build/outputs/apk/release/app-release.apk`

Configure release signing only inside this `mobile/android` tree.

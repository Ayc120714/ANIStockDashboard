# Android Studio Setup (APK Validation Flow)

Use this sequence to build and verify the APK from Android Studio with fewer runtime issues.

## 1) Prerequisites

- Android Studio (latest stable)
- JDK 17 (Android Studio bundled JDK is fine)
- Android SDK with:
  - Android SDK Platform 36
  - Android SDK Build-Tools 36.x
  - Android SDK Platform-Tools
- Node.js 24 LTS (`>=24.15.0`)

## 2) Open Project in Android Studio

1. Open Android Studio.
2. Click **Open** and select: `mobile_isolated/android`.
3. Wait for Gradle sync to complete.
4. If prompted for SDK path, set it once in `local.properties`:
   - `sdk.dir=/path/to/Android/Sdk`

## 3) Environment for API

Set production API values in `mobile_isolated/.env.production`:

- `MOBILE_API_URL=https://www.aycindustries.com:8443/api`
- `MOBILE_TRADE_API_URL=https://www.aycindustries.com:8443/api`

## 4) Debug Build + Run (for Android Studio verification)

From Android Studio:

1. Select build variant: `debug`.
2. Choose device/emulator.
3. Click **Run app**.

If app installs but shows blank/close behavior, clear app data once and relaunch.

## 5) Release Signing Setup (one-time)

Do not commit keys into repo.

1. Generate upload key on your machine:
   `keytool -genkeypair -v -storetype PKCS12 -keystore ani-stock-upload-key.jks -alias ani-stock-key -keyalg RSA -keysize 2048 -validity 10000`
2. Put the key in a secure local path.
3. Add signing props to `~/.gradle/gradle.properties`:

   - `ANI_UPLOAD_STORE_FILE=/absolute/path/to/ani-stock-upload-key.jks`
   - `ANI_UPLOAD_STORE_PASSWORD=...`
   - `ANI_UPLOAD_KEY_ALIAS=ani-stock-key`
   - `ANI_UPLOAD_KEY_PASSWORD=...`

The project is configured to use these automatically for release builds.

## 6) Build Release APK in Android Studio

Option A (recommended): **Build > Generate Signed Bundle / APK > APK > release**

Option B (terminal):

- `cd mobile_isolated/android && ./gradlew assembleRelease`

Output:

- `mobile_isolated/android/app/build/outputs/apk/release/app-release.apk`

## 7) Install on Physical Device

1. Enable Developer Options + USB Debugging on phone.
2. Connect device and accept RSA prompt.
3. Install:
   - `adb install -r mobile_isolated/android/app/build/outputs/apk/release/app-release.apk`

## 8) Crash Check in Android Studio (Logcat)

If app closes:

1. Open **Logcat**.
2. Filter by package: `com.anistockmobiletemplate`.
3. Reproduce once and capture `FATAL EXCEPTION` stack trace.

## 9) Quick Release Checklist

- Backend API reachable from phone (`https://www.aycindustries.com:8443/api`).
- Login + OTP works.
- Dashboard loads data.
- Alerts load and update.
- App relaunch survives process kill.
- No startup crash on cold open.

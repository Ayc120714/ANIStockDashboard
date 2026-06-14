# Android mobile app — VPS build & Google Play upload

The mobile app lives in **`mobile_isolated/`** (React Native, separate from the web bundle).

## Prerequisites on the build host

| Tool | Version |
|------|---------|
| Node.js | `24.15.0` (`mobile_isolated/.nvmrc`) |
| Java | 17 |
| Android SDK | Platform 36 + build-tools (see `mobile_isolated/android`) |
| `ANDROID_HOME` | e.g. `/root/Android/Sdk` |

Backend must be reachable at **`https://www.aycindustries.com/api`** (nginx → uvicorn `:8000`).

## One-time: Play Store upload keystore

Do **not** commit the keystore or passwords to git.

```bash
mkdir -p /opt/ani-stock/secrets
keytool -genkeypair -v -storetype PKCS12 \
  -keystore /opt/ani-stock/secrets/ani-stock-upload-key.jks \
  -alias ani-stock-key -keyalg RSA -keysize 2048 -validity 10000
chmod 600 /opt/ani-stock/secrets/ani-stock-upload-key.jks
```

Add to **`~/.gradle/gradle.properties`** (machine-local):

```properties
ANI_UPLOAD_STORE_FILE=/opt/ani-stock/secrets/ani-stock-upload-key.jks
ANI_UPLOAD_STORE_PASSWORD=your_store_password
ANI_UPLOAD_KEY_ALIAS=ani-stock-key
ANI_UPLOAD_KEY_PASSWORD=your_key_password
```

Without these properties, release builds fall back to the debug keystore (fine for internal APK tests, **not** for Play Console).

## Build on the VPS

```bash
cd /opt/ani-stock/stockdashboard
chmod +x docs/deployment/deploy_mobile_android.sh
./docs/deployment/deploy_mobile_android.sh
```

Outputs (copied for download):

- `/opt/ani-stock/mobile-artifacts/ani-stock-release.aab` — **upload to Google Play**
- `/opt/ani-stock/mobile-artifacts/ani-stock-release.apk` — side-load / QA

**Public download (side-load on Android):**

- APK: **https://www.aycindustries.com/mobile/ani-stock-release.apk**
- Build metadata (version, SHA256): **https://www.aycindustries.com/mobile/DOWNLOAD.json**

Nginx serves the APK from `mobile-artifacts/` with `no-cache` so reinstalls always fetch the latest build.

Or from `mobile_isolated/`:

```bash
npm run android:aab:release   # Play Store
npm run android:apk:release   # direct install
```

## Google Play Console checklist

1. Create app with package name **`com.anistockmobiletemplate`** (matches `applicationId` in `android/app/build.gradle`).
2. Upload **`ani-stock-release.aab`** (Production or Internal testing track).
3. Store listing: app name **ANI Stock**, screenshots, privacy policy URL.
4. Content rating questionnaire + target API level (project uses current RN target SDK).
5. Deep link / intent filter already configured: `anistock://broker/callback` (broker OAuth return).

## End-user auth

Mobile uses the same backend auth as web:

- `POST /api/auth/login/start` → email OTP → `POST /api/auth/login/complete`
- Device header: `X-Device-Id` (trusted device flow)

Ensure SMTP (email OTP) and optional SMS (`FAST2SMS_API_KEY`) are configured in backend `.env`.

## CI (GitHub Actions)

- **Debug/smoke APK:** `.github/workflows/android-apk.yml` (on push to `mobile_isolated/**`).
- Configure repository secrets for release signing if CI should produce Play-ready AABs:
  - `ANI_UPLOAD_STORE_FILE` (base64 keystore), passwords, alias — or run signed builds on the VPS only.

## Verify API from a device

After installing the release APK:

1. Login with a registered user email + password.
2. Complete email OTP.
3. Dashboard and watchlist should load from production API.

If login fails with network errors, confirm the bundle targets `https://www.aycindustries.com/api` (release builds use the hardcoded production URL in `src/core/config/env.js`).

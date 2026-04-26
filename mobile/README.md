# ANI Stock Mobile (Isolated React Native App)

This is a standalone mobile workspace under `mobile/` and does not modify the existing web setup.

## Isolation guarantees

- Separate `package.json`, lockfile, Metro/Babel/TypeScript config.
- Separate env (`mobile/.env.*`).
- Separate CI workflow (`mobile/.github/workflows/mobile-ci.yml`).
- Separate Android platform folder (`mobile/android`).

## Required versions

- Node.js: `24.15.0` (latest LTS)
- npm: `>=10`
- Java: `17` (Android builds)
- Android Studio + SDK platform tools

## Upgrade Node (recommended)

Use `nvm` to avoid affecting system Node:

```bash
nvm install 24.15.0
nvm use 24.15.0
node -v
```

You can also run from this folder:

```bash
echo "24.15.0" > .nvmrc
nvm use
```

## Getting started

1. Copy env:
   - `cp .env.example .env`
2. Install:
   - `npm install`
3. Check toolchain:
   - `npm run doctor`
4. Run Metro:
   - `npm run start`
5. Run Android:
   - `npm run android`

## Build installable Android app

### Debug APK (quick device install)

```bash
npm run android:apk:debug
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

### Release APK (for manual distribution)

```bash
npm run android:apk:release
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

### Release AAB (Play Store upload)

```bash
npm run android:aab:release
```

Output:
- `android/app/build/outputs/bundle/release/app-release.aab`

## Download and install on mobile devices

### Android phone

Option A (USB):
- Build APK and install via `adb install -r ...`

Option B (share link):
- Upload `app-release.apk` to your internal storage/download server
- Download on device and install (enable unknown sources for your installer)

### Download APK from GitHub

1. Push your latest code to `main`.
2. Open GitHub repo -> **Actions** -> **Android APK** workflow.
3. Run workflow (or wait for automatic run on push).
4. Open the successful run and download artifact:
   - `ani-stock-mobile-debug-apk`
5. Install downloaded `app-debug.apk` on Android device.

## Current parity implementation

- Auth + OTP onboarding (`LoginScreen`, `OtpVerifyScreen`)
- Post-login routing logic with broker setup fallback
- Deep-link callback listener for broker OAuth style callbacks
- Dashboard, watchlist, advisor payloads
- Orders, broker connectivity, alerts, market modules
- Admin user/premium management entry points
- Native deep-link handling configured for broker callbacks:
  - `anistock://broker/callback?...`

## Backend compatibility checklist

- Confirm `MOBILE_API_URL` and `MOBILE_TRADE_API_URL`.
- Verify broker callback URI scheme (`anistock://broker/callback`).
- Validate token refresh behavior for foreground/background lifecycle.
- Validate obfuscated payload handling for `xor-b64-v1` responses.

## QA pass checklist

- Login/password + email OTP flow
- Token refresh after access token expiry
- Dashboard data load
- Place/cancel order flow
- Broker connect/deep link callback
- Price alert create/delete
- FnO/commodities/forex payload fetch
- Admin users + premium email operations
- Android install via APK and launch verification

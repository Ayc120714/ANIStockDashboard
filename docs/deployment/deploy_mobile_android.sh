#!/usr/bin/env bash
set -euo pipefail

# Build ANI Stock Android release artifacts on the VPS (or any build host).
# Usage:
#   chmod +x docs/deployment/deploy_mobile_android.sh
#   ./docs/deployment/deploy_mobile_android.sh
#
# Play Store upload: use app-release.aab from ARTIFACT_DIR.
# Side-load testing: use app-release.apk.

APP_ROOT="${APP_ROOT:-/opt/ani-stock}"
MOBILE_DIR="${MOBILE_DIR:-$APP_ROOT/stockdashboard/mobile_isolated}"
ARTIFACT_DIR="${ARTIFACT_DIR:-$APP_ROOT/mobile-artifacts}"
GRADLE_PROPS="${GRADLE_PROPS:-$HOME/.gradle/gradle.properties}"

echo "[1/6] Verify toolchain..."
command -v node >/dev/null
command -v java >/dev/null
command -v adb >/dev/null
: "${ANDROID_HOME:?Set ANDROID_HOME to your Android SDK path}"

echo "[2/6] Sync launcher/splash logos from website (public/ayc-logo.png)..."
"$MOBILE_DIR/scripts/sync_android_brand_assets.sh"

echo "[3/6] Install mobile dependencies..."
cd "$MOBILE_DIR"
npm ci

echo "[4/6] Lint + typecheck..."
npm run typecheck
npm run lint

echo "[5/6] Build release APK + AAB..."
npm run android:apk:release
npm run android:aab:release

APK="$MOBILE_DIR/android/app/build/outputs/apk/release/app-release.apk"
AAB="$MOBILE_DIR/android/app/build/outputs/bundle/release/app-release.aab"

if [[ ! -f "$APK" || ! -f "$AAB" ]]; then
  echo "ERROR: Expected release artifacts were not produced."
  exit 1
fi

echo "[6/7] Publish artifacts to $ARTIFACT_DIR ..."
mkdir -p "$ARTIFACT_DIR"
VERSION_NAME=$(node -p "require('$MOBILE_DIR/package.json').version")
VERSIONED_APK_DIR="$MOBILE_DIR/mobile"
mkdir -p "$VERSIONED_APK_DIR"
cp -f "$APK" "$ARTIFACT_DIR/ani-stock-release.apk"
cp -f "$APK" "$VERSIONED_APK_DIR/ani-stock-release-v${VERSION_NAME}.apk"
cp -f "$AAB" "$ARTIFACT_DIR/ani-stock-release.aab"
sha256sum "$ARTIFACT_DIR/ani-stock-release.apk" "$ARTIFACT_DIR/ani-stock-release.aab" > "$ARTIFACT_DIR/SHA256SUMS"
APK_SHA=$(sha256sum "$ARTIFACT_DIR/ani-stock-release.apk" | awk '{print $1}')
APK_SIZE=$(stat -c '%s' "$ARTIFACT_DIR/ani-stock-release.apk")
VERSION_CODE=$(grep -m1 'versionCode' "$MOBILE_DIR/android/app/build.gradle" | grep -oE '[0-9]+')
"$MOBILE_DIR/scripts/sync-download-manifest.sh" "${RELEASE_NOTES:-}"

echo "Done."
echo "  APK (side-load): $ARTIFACT_DIR/ani-stock-release.apk"
echo "  Versioned copy:  $VERSIONED_APK_DIR/ani-stock-release-v${VERSION_NAME}.apk"
echo "  Download URL:    https://www.aycindustries.com/mobile/ani-stock-release.apk"
echo "  Metadata:        https://www.aycindustries.com/mobile/DOWNLOAD.json"
echo "  SHA256:          $APK_SHA"
echo "  Size (bytes):    $APK_SIZE"
echo "  AAB (Play Store): $ARTIFACT_DIR/ani-stock-release.aab"

if grep -q "ANI_UPLOAD_STORE_FILE" "$GRADLE_PROPS" 2>/dev/null; then
  echo "  Signing: release upload keystore configured in $GRADLE_PROPS"
else
  echo "  WARNING: No ANI_UPLOAD_* signing in $GRADLE_PROPS — release build uses debug keystore (not Play Store ready)."
fi

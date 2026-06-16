#!/usr/bin/env bash
# Run unit tests, build release APK, copy to public paths for end-user download.
# Usage: ./scripts/publish-release-apk.sh ["Optional release notes"]
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/ani-stock}"
MOBILE_DIR="${APP_ROOT}/stockdashboard/mobile_isolated"
ARTIFACT_DIR="${ARTIFACT_DIR:-${APP_ROOT}/mobile-artifacts}"
RELEASE_APK="${MOBILE_DIR}/android/app/build/outputs/apk/release/app-release.apk"
NOTES="${1:-}"

cd "$MOBILE_DIR"

echo "[1/5] Typecheck..."
npm run typecheck

echo "[2/5] Unit tests (CI gate — must pass before APK)..."
npm run test:ci

echo "[3/5] Build release APK..."
npm run android:apk:release 2>&1 | tail -6

if [[ ! -f "$RELEASE_APK" ]]; then
  echo "ERROR: Release APK not found at $RELEASE_APK"
  exit 1
fi

VERSION=$(node -p "require('$MOBILE_DIR/package.json').version")
VERSIONED_DIR="$MOBILE_DIR/mobile"
mkdir -p "$VERSIONED_DIR" "$ARTIFACT_DIR"

echo "[4/5] Copy to versioned + public download paths..."
cp -f "$RELEASE_APK" "$VERSIONED_DIR/ani-stock-release-v${VERSION}.apk"
cp -f "$RELEASE_APK" "$ARTIFACT_DIR/ani-stock-release.apk"
sha256sum "$ARTIFACT_DIR/ani-stock-release.apk"
stat -c '%s' "$ARTIFACT_DIR/ani-stock-release.apk"

echo "[5/5] Sync DOWNLOAD.json..."
"$MOBILE_DIR/scripts/sync-download-manifest.sh" "$NOTES"

echo ""
echo "Published v${VERSION}"
echo "  Download: https://www.aycindustries.com/mobile/ani-stock-release.apk"
echo "  Manifest: https://www.aycindustries.com/mobile/DOWNLOAD.json"
echo "  Local:    $ARTIFACT_DIR/ani-stock-release.apk"
echo "  Archive:  $VERSIONED_DIR/ani-stock-release-v${VERSION}.apk"

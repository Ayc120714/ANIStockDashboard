#!/usr/bin/env bash
# Sync mobile-artifacts/DOWNLOAD.json after a release APK build.
# Usage: ./scripts/sync-download-manifest.sh "Optional release notes"
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ARTIFACT_DIR="${ARTIFACT_DIR:-/opt/ani-stock/mobile-artifacts}"
APK="${APK:-$ARTIFACT_DIR/ani-stock-release.apk}"
NOTES="${1:-}"

VERSION_NAME=$(node -p "require('$ROOT/package.json').version")
VERSION_CODE=$(grep -m1 'versionCode' "$ROOT/android/app/build.gradle" | grep -oE '[0-9]+')

if [[ ! -f "$APK" ]]; then
  echo "ERROR: APK not found at $APK"
  exit 1
fi

VERSIONED_APK_DIR="$ROOT/mobile"
mkdir -p "$VERSIONED_APK_DIR"
cp -f "$APK" "$VERSIONED_APK_DIR/ani-stock-release-v${VERSION_NAME}.apk"

SHA=$(sha256sum "$APK" | awk '{print $1}')
SIZE=$(stat -c '%s' "$APK")
BUILT_AT=$(date -Iseconds)

export SYNC_VERSION_NAME="$VERSION_NAME"
export SYNC_VERSION_CODE="$VERSION_CODE"
export SYNC_BUILT_AT="$BUILT_AT"
export SYNC_SHA="$SHA"
export SYNC_SIZE="$SIZE"
export SYNC_NOTES="$NOTES"
export SYNC_OUT="$ARTIFACT_DIR/DOWNLOAD.json"

node <<'EOF'
const fs = require('fs');
const out = {
  app: 'ANI Stock Mobile',
  version: process.env.SYNC_VERSION_NAME,
  versionCode: Number(process.env.SYNC_VERSION_CODE),
  builtAt: process.env.SYNC_BUILT_AT,
  apkUrl: `https://www.aycindustries.com/mobile/ani-stock-release.apk`,
  sha256: process.env.SYNC_SHA,
  sizeBytes: Number(process.env.SYNC_SIZE),
};
if (process.env.SYNC_NOTES) {
  out.releaseNotes = process.env.SYNC_NOTES;
}
fs.writeFileSync(process.env.SYNC_OUT, `${JSON.stringify(out, null, 2)}\n`);
console.log(`Wrote ${process.env.SYNC_OUT}`);
console.log(`  version: ${out.version}  versionCode: ${out.versionCode}`);
EOF

echo "[sync] Bumping source version for the next release cycle..."
node "$ROOT/scripts/bump-mobile-version.js"

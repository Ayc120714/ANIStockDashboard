#!/usr/bin/env bash
# Ship a completed mobile app fix: test → publish APK → verify → commit → push.
# Usage: ship-mobile-fix.sh "Release notes for update popup" ["git commit subject"]
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/ani-stock}"
REPO_DIR="${REPO_DIR:-${APP_ROOT}/stockdashboard}"
PUBLISH_SCRIPT="${PUBLISH_SCRIPT:-${REPO_DIR}/.cursor/skills/skillhelp/scripts/publish-release-apk.sh}"
NOTES="${1:-Mobile app update}"
COMMIT_SUBJECT="${2:-fix(mobile): ${NOTES}}"

if [[ ! -x "$PUBLISH_SCRIPT" ]]; then
  echo "ERROR: Publish script not found or not executable: $PUBLISH_SCRIPT"
  exit 1
fi

if [[ ! -d "$REPO_DIR/.git" ]]; then
  echo "ERROR: Git repo not found at $REPO_DIR"
  exit 1
fi

echo "=== [1/4] Publish release APK (typecheck + test:ci + build + manifest) ==="
"$PUBLISH_SCRIPT" "$NOTES"

echo ""
echo "=== [2/4] Verify public download ==="
APK_CODE=$(curl -sS -o /dev/null -w '%{http_code}' https://www.aycindustries.com/mobile/ani-stock-release.apk || true)
JSON_CODE=$(curl -sS -o /dev/null -w '%{http_code}' https://www.aycindustries.com/mobile/DOWNLOAD.json || true)
if [[ "$APK_CODE" != "200" || "$JSON_CODE" != "200" ]]; then
  echo "ERROR: Public URLs not ready (APK=$APK_CODE JSON=$JSON_CODE)"
  exit 1
fi
curl -sS https://www.aycindustries.com/mobile/DOWNLOAD.json | python3 -m json.tool | head -12

echo ""
echo "=== [3/4] Commit mobile fix + version bump ==="
cd "$REPO_DIR"

git add mobile_isolated/src/ mobile_isolated/__tests__/ \
  mobile_isolated/package.json \
  mobile_isolated/android/app/build.gradle \
  mobile_isolated/src/core/config/appVersion.js

if git diff --cached --quiet; then
  echo "WARN: No staged changes — skipping commit (fix may already be committed)."
else
  git commit -m "$(cat <<EOF
${COMMIT_SUBJECT}

Release notes: ${NOTES}
EOF
)"
fi

echo ""
echo "=== [4/4] Push to GitHub ==="
BRANCH=$(git branch --show-current)
if [[ "$BRANCH" == "main" || "$BRANCH" == "master" ]]; then
  git push origin HEAD
else
  git push -u origin HEAD
fi

echo ""
echo "Ship complete."
echo "  Branch: ${BRANCH}"
echo "  APK:    https://www.aycindustries.com/mobile/ani-stock-release.apk"
echo "  Manifest: https://www.aycindustries.com/mobile/DOWNLOAD.json"

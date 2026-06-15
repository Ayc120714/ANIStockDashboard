---
name: skillhelp
description: >-
  Runs mobile unit tests, builds, publishes, and enables the ANI Stock Android
  release APK for end-user download at
  https://www.aycindustries.com/mobile/ani-stock-release.apk. Use when the user
  mentions /skillhelp, mobile APK release, side-load APK, publish
  ani-stock-release.apk, mobile-artifacts, DOWNLOAD.json, or enabling the public
  mobile download URL on the VPS.
---

# ANI Stock mobile APK — test, build, copy, enable download

End users install from:

**https://www.aycindustries.com/mobile/ani-stock-release.apk**

In-app update manifest:

**https://www.aycindustries.com/mobile/DOWNLOAD.json**

## Paths (VPS)

| Role | Path |
|------|------|
| Mobile source | `/opt/ani-stock/stockdashboard/mobile_isolated` |
| Gradle release output | `mobile_isolated/android/app/build/outputs/apk/release/app-release.apk` |
| **Public artifact** (Nginx serves this) | `/opt/ani-stock/mobile-artifacts/ani-stock-release.apk` |
| Versioned archive | `mobile_isolated/mobile/ani-stock-release-v{VERSION}.apk` |
| Update manifest | `/opt/ani-stock/mobile-artifacts/DOWNLOAD.json` |

Nginx aliases `/mobile/ani-stock-release.apk` → `mobile-artifacts/ani-stock-release.apk` (no copy to `/var/www/ani-stock`).

## Required order (do not skip steps)

**All unit tests must pass before generating the APK.** If tests fail, fix them and re-run — do not publish.

### Preferred: one script

```bash
/opt/ani-stock/stockdashboard/.cursor/skills/skillhelp/scripts/publish-release-apk.sh "Release notes"
```

Steps inside the script:

1. `npm run typecheck`
2. `npm run test:ci` — **gate**; abort on failure
3. `npm run android:apk:release`
4. Copy APK to public + versioned paths (below)
5. `sync-download-manifest.sh` → updates `DOWNLOAD.json`

### Manual steps (same order)

```bash
cd /opt/ani-stock/stockdashboard/mobile_isolated

npm run typecheck
npm run test:ci

npm run android:apk:release 2>&1 | tail -6
```

Copy so end users can download (use `package.json` version **before** manifest bump):

```bash
VERSION=$(node -p "require('/opt/ani-stock/stockdashboard/mobile_isolated/package.json').version")
mkdir -p /opt/ani-stock/stockdashboard/mobile_isolated/mobile
cp -f /opt/ani-stock/stockdashboard/mobile_isolated/android/app/build/outputs/apk/release/app-release.apk \
  "/opt/ani-stock/stockdashboard/mobile_isolated/mobile/ani-stock-release-v${VERSION}.apk"
cp -f /opt/ani-stock/stockdashboard/mobile_isolated/android/app/build/outputs/apk/release/app-release.apk \
  /opt/ani-stock/mobile-artifacts/ani-stock-release.apk
sha256sum /opt/ani-stock/mobile-artifacts/ani-stock-release.apk
stat -c '%s' /opt/ani-stock/mobile-artifacts/ani-stock-release.apk

./scripts/sync-download-manifest.sh "Release notes here"
```

## Verify public download

```bash
curl -sSI https://www.aycindustries.com/mobile/ani-stock-release.apk | head -5
curl -sS https://www.aycindustries.com/mobile/DOWNLOAD.json | python3 -m json.tool | head -12
```

Expect HTTP 200; `Content-Length` must match `sizeBytes` in `DOWNLOAD.json`.

## Version sync

Before release, align `package.json`, `android/app/build.gradle`, and `src/core/config/appVersion.js`. `sync-download-manifest.sh` bumps source for the **next** cycle after publishing.

## Checklist

```
- [ ] npm run typecheck — pass
- [ ] npm run test:ci — all unit tests pass (required before APK)
- [ ] npm run android:apk:release — BUILD SUCCESSFUL
- [ ] cp → /opt/ani-stock/mobile-artifacts/ani-stock-release.apk
- [ ] cp → mobile_isolated/mobile/ani-stock-release-v{VERSION}.apk
- [ ] sync-download-manifest.sh — sha256/size/version match
- [ ] https://www.aycindustries.com/mobile/ani-stock-release.apk — HTTP 200
```

## Related

- [scripts/publish-release-apk.sh](scripts/publish-release-apk.sh)
- `docs/deployment/deploy_mobile_android.sh` (full pipeline incl. lint + AAB)
- `docs/deployment/MOBILE_ANDROID_PLAY_STORE.md`

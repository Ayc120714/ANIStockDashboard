---
name: publish-mobile-apk
description: >-
  Builds and publishes the ANI Stock Android release APK after backend or
  mobile-impacting changes so installed users see the in-app update popup.
  Use when backend API/auth/premium fixes ship, mobile JS changes, the user
  asks to build or publish APK, bump mobile version, update DOWNLOAD.json,
  or enable the public download at aycindustries.com/mobile.
---

# Publish mobile APK (after backend / mobile fixes)

When **backend** or **mobile** changes affect what users see in the app, finish with a **published APK** and an updated **`DOWNLOAD.json`**. Installed builds compare `versionCode` in `DOWNLOAD.json` to the installed APK; when the server is higher, `useAppUpdatePrompt` shows **“App update available”**.

## When to run this skill

Run after **any** of these:

- Backend API / auth / premium / advisor / screens changes that mobile calls
- Mobile JS changes under `stockdashboard/mobile_isolated/`
- User asks to publish APK, bump version, or fix the update popup
- Full VPS deploy that included backend fixes users need on mobile

**Order:** deploy backend (and web if needed) **first**, then publish APK.

### Backend + web restart (do this before APK)

```bash
cd /opt/ani-stock/backend_stockdashboard
sudo systemctl daemon-reload && sudo systemctl restart ani-backend

cd /opt/ani-stock/stockdashboard
npm ci && npm run build
sudo rsync -av --delete build/ /var/www/ani-stock/
sudo nginx -t && sudo systemctl reload nginx
```

Skip the web block if only backend + APK changed.

## Paths (VPS)

| Role | Path |
|------|------|
| Mobile source | `/opt/ani-stock/stockdashboard/mobile_isolated` |
| Gradle release APK | `mobile_isolated/android/app/build/outputs/apk/release/app-release.apk` |
| **Public download** (Nginx) | `/opt/ani-stock/mobile-artifacts/ani-stock-release.apk` |
| Update manifest | `/opt/ani-stock/mobile-artifacts/DOWNLOAD.json` |
| Versioned archive | `mobile_isolated/mobile/ani-stock-release-v{VERSION}.apk` |

Public URLs:

- APK: `https://www.aycindustries.com/mobile/ani-stock-release.apk`
- Manifest: `https://www.aycindustries.com/mobile/DOWNLOAD.json`

Nginx serves `/mobile/*` from `mobile-artifacts/` — **no** rsync to `/var/www/ani-stock` for the APK.

## Version files (must match before build)

Align these **before** `android:apk:release`:

| File | Fields |
|------|--------|
| `mobile_isolated/package.json` | `version` (e.g. `1.2.51`) |
| `mobile_isolated/android/app/build.gradle` | `versionCode` (integer), `versionName` |
| `mobile_isolated/src/core/config/appVersion.js` | `APP_VERSION_NAME`, `APP_VERSION_CODE` |

`sync-download-manifest.sh` writes `DOWNLOAD.json` with the **built** version, then runs `bump-mobile-version.js` to bump source for the **next** cycle.

**Update popup rule:** published `versionCode` in `DOWNLOAD.json` must be **greater than** the installed APK’s `versionCode`.

## Preferred: one script (tests → build → publish)

```bash
/opt/ani-stock/stockdashboard/.cursor/skills/publish-mobile-apk/scripts/publish-release-apk.sh "Short release notes for the update popup"
```

Steps inside:

1. `npm run typecheck`
2. `npm run test:ci` — **must pass**; do not publish on failure
3. `npm run android:apk:release`
4. Copy APK to `mobile-artifacts/` + versioned archive
5. `./scripts/sync-download-manifest.sh` → updates `DOWNLOAD.json`

## Manual steps (same order)

```bash
cd /opt/ani-stock/stockdashboard/mobile_isolated

npm run typecheck
npm run test:ci

npm run android:apk:release 2>&1 | tail -6
```

Copy artifacts (use `package.json` version **before** manifest bump):

```bash
VERSION=$(node -p "require('/opt/ani-stock/stockdashboard/mobile_isolated/package.json').version")
mkdir -p /opt/ani-stock/stockdashboard/mobile_isolated/mobile
cp -f /opt/ani-stock/stockdashboard/mobile_isolated/android/app/build/outputs/apk/release/app-release.apk \
  "/opt/ani-stock/stockdashboard/mobile_isolated/mobile/ani-stock-release-v${VERSION}.apk"
cp -f /opt/ani-stock/stockdashboard/mobile_isolated/android/app/build/outputs/apk/release/app-release.apk \
  /opt/ani-stock/mobile-artifacts/ani-stock-release.apk
sha256sum /opt/ani-stock/mobile-artifacts/ani-stock-release.apk
stat -c '%s' /opt/ani-stock/mobile-artifacts/ani-stock-release.apk

./scripts/sync-download-manifest.sh "Short release notes for the update popup"
```

## Full pipeline (APK + Play Store AAB)

```bash
chmod +x /opt/ani-stock/stockdashboard/docs/deployment/deploy_mobile_android.sh
/opt/ani-stock/stockdashboard/docs/deployment/deploy_mobile_android.sh
```

Requires `ANDROID_HOME`, Java, and optionally `ANI_UPLOAD_*` in `~/.gradle/gradle.properties` for release signing.

## Verify publish + update popup

```bash
curl -sSI https://www.aycindustries.com/mobile/ani-stock-release.apk | head -5
curl -sS https://www.aycindustries.com/mobile/DOWNLOAD.json | python3 -m json.tool | head -12
```

Expect HTTP **200**; `Content-Length` must match `sizeBytes` in `DOWNLOAD.json`.

Installed app checks manifest on login and every **15 minutes** while active (`useAppUpdatePrompt`). Users on an older `versionCode` see **App update available** with your `releaseNotes`.

Admin → **Check auto-update** uses the same manifest for diagnostics.

## Checklist

```
- [ ] Backend restarted (if API changed)
- [ ] npm run typecheck — pass
- [ ] npm run test:ci — pass (required before APK)
- [ ] npm run android:apk:release — BUILD SUCCESSFUL
- [ ] cp → /opt/ani-stock/mobile-artifacts/ani-stock-release.apk
- [ ] sync-download-manifest.sh — versionCode/version/sha256/size updated
- [ ] curl DOWNLOAD.json — versionCode > previous publish
- [ ] Tell user: open app → update popup, or install from public APK URL
```

## Notes

- Do **not** skip `test:ci` before publishing.
- Release notes in `sync-download-manifest.sh` appear in the update popup body.
- If `DOWNLOAD.json` `versionCode` is stale vs built APK, users will not see the popup — always run `sync-download-manifest.sh` after copy.

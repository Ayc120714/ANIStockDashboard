---
name: mobile-app-fix-ship
description: >-
  Ships completed ANI Stock mobile app fixes end-to-end: regression tests,
  publish and enable the release APK on aycindustries.com/mobile, then commit
  and push source changes to GitHub. Use after any mobile_isolated bug fix,
  UI fix, or feature correction; when the user says ship the app fix, publish
  APK and push to GitHub, or /mobile-app-fix-ship.
---

# Mobile app fix — publish APK + push to GitHub

When a **mobile app fix is complete**, do not stop at code changes. Finish by **enabling the new APK** for users and **submitting the fix to GitHub**.

## Required order (never skip)

```
- [ ] 1. Fix + regression test (mobile-regression-guard)
- [ ] 2. npm run test:ci — all green
- [ ] 3. Publish APK → public download + DOWNLOAD.json
- [ ] 4. Verify curl checks pass
- [ ] 5. git commit fix + version bump files
- [ ] 6. git push to GitHub (no force push)
```

Steps 1–2 are covered by **`.cursor/skills/mobile-regression-guard/SKILL.md`** and **`.cursor/skills/fix-regression-guard/SKILL.md`**.

## One command (preferred)

From the VPS after the fix is implemented and reviewed:

```bash
/opt/ani-stock/stockdashboard/.cursor/skills/mobile-app-fix-ship/scripts/ship-mobile-fix.sh \
  "Short release notes for update popup" \
  "fix(mobile): describe the fix in one line"
```

Script steps:

1. `publish-release-apk.sh` — typecheck, `test:ci`, build APK, copy to `mobile-artifacts/`, sync `DOWNLOAD.json`, bump next-cycle version in source
2. Verify public URLs (HTTP 200, manifest matches APK size)
3. Stage only mobile fix + version files (see below)
4. Commit with the provided message (or auto-generated `fix(mobile): …`)
5. `git push origin HEAD` — **never** `--force` on `main`/`master`

## Manual workflow (same order)

### A. Publish APK

```bash
/opt/ani-stock/stockdashboard/.cursor/skills/skillhelp/scripts/publish-release-apk.sh \
  "Short release notes for update popup"
```

See **`.cursor/skills/skillhelp/SKILL.md`** for paths, version sync, and verification curls.

### B. Verify download is enabled

```bash
curl -sSI https://www.aycindustries.com/mobile/ani-stock-release.apk | head -5
curl -sS https://www.aycindustries.com/mobile/DOWNLOAD.json | python3 -m json.tool | head -12
```

Expect HTTP **200**; `Content-Length` must match `sizeBytes` in `DOWNLOAD.json`.

### C. Commit and push to GitHub

Repo root: `/opt/ani-stock/stockdashboard` (remote: `origin` → `Ayc120714/ANIStockDashboard`).

```bash
cd /opt/ani-stock/stockdashboard

git status
git diff

git add mobile_isolated/src/ mobile_isolated/__tests__/ \
  mobile_isolated/package.json \
  mobile_isolated/android/app/build.gradle \
  mobile_isolated/src/core/config/appVersion.js

git commit -m "$(cat <<'EOF'
fix(mobile): one-line summary of the fix

Optional second line with release note context.
EOF
)"

git push origin HEAD
```

## What to stage

| Include | Exclude |
|---------|---------|
| `mobile_isolated/src/**` (fix) | `node_modules/`, `coverage/`, `dist/` |
| `mobile_isolated/__tests__/**` (regression test) | `.vscode/`, `.env`, `android/app/build/` |
| Version files after publish (bumped for next cycle) | Unrelated web/backend files unless same fix |
| `package.json`, `build.gradle`, `appVersion.js` | Secrets, keystores, `local.properties` |

`DOWNLOAD.json` and the live APK live under `/opt/ani-stock/mobile-artifacts/` on the VPS — **not** in the git repo. Publishing updates the server; git tracks source + version metadata.

## Commit message style

Match recent history: imperative, scoped when helpful.

```
fix(mobile): collapse LT/ST watchlist panels to reduce clutter
fix(mobile): restore in-app APK update prompt after login
```

Release notes passed to `ship-mobile-fix.sh` arg 1 appear in the in-app **App update available** popup (`DOWNLOAD.json` → `releaseNotes`).

## Agent checklist (report when done)

1. Fix summary and test file(s) that guard it
2. `test:ci` result (e.g. 107/107 passed)
3. Published version (`version` + `versionCode` from `DOWNLOAD.json`)
4. Public APK URL verified (HTTP 200)
5. Git commit hash and branch pushed
6. GitHub remote branch name (user can open PR if not on `main`)

## When NOT to run full ship

- Fix is web-only or backend-only → use **publish-mobile-apk** only if mobile clients need the backend change; no mobile source commit needed
- Tests failing → fix first; **do not publish**
- User explicitly asked for code-only / no push → skip steps 5–6

## Related skills

- [skillhelp/SKILL.md](../skillhelp/SKILL.md) — APK build, copy, manifest
- [mobile-regression-guard/SKILL.md](../mobile-regression-guard/SKILL.md) — tests before publish
- [fix-regression-guard/SKILL.md](../fix-regression-guard/SKILL.md) — universal test gate
- [publish-mobile-apk/SKILL.md](../publish-mobile-apk/SKILL.md) — backend + mobile publish context

## Script reference

- [scripts/ship-mobile-fix.sh](scripts/ship-mobile-fix.sh)

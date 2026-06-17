---
name: fix-regression-guard
description: >-
  Ensures every bug fix and behavior change on web or mobile ships with an
  enabled regression unit test and a CI gate so fixes are not lost later. Use
  when implementing any fix, feature correction, cache change, or when the user
  asks to protect work with tests.
---

# Fix Regression Guard

> **Whenever any fix is done** (web, mobile, or API), add or update its **corresponding unit test**, keep that test **enabled** (never skipped), and run the project test suite before build or release so the fix is not lost on the next change.

This applies to **all fixes** — not only admin/watchlist. Mutation-refresh patterns are one category; see `.cursor/skills/web-mutation-refresh-guard/SKILL.md` and `.cursor/skills/mobile-regression-guard/SKILL.md` for area-specific checklists.

## Required workflow (do not skip)

Every fix is **incomplete** until all steps pass:

```
- [ ] 1. Reproduce the failure (symptom + root cause)
- [ ] 2. Implement the minimal fix
- [ ] 3. Add or update a regression test that would fail without the fix
- [ ] 4. Run the full test suite locally — all tests green
- [ ] 5. Ensure CI / release scripts run those tests before build/APK/deploy
- [ ] 6. Note cache-key bumps or migration steps if the fix depends on invalidating stale state
```

**Do not mark the task done** until step 4 passes. **Do not hand off a release** until step 5 is confirmed.

## Universal rule (web + mobile)

| Rule | Requirement |
|------|-------------|
| **One fix → one test minimum** | Every behavioral fix gets at least one focused regression test in the same change set |
| **Tests stay on** | No `it.skip`, `test.skip`, `.only`, or commented-out assertions for the new test |
| **Extract when needed** | Move testable logic into `utils/` or `services/` so pages/components stay thin |
| **Name the bug** | Test title or comment states what broke and what correct behavior is |
| **Fail first** | Verify mentally (or by reverting) that the test fails on pre-fix code |
| **Gate releases** | `npm run test:ci` (web and mobile) must pass before `npm run build`, APK publish, or VPS deploy |

**No exceptions** for “small” fixes — if it was worth fixing, it is worth a test.

## What to test

| Fix type | Test target |
|----------|-------------|
| Pure logic (parse, validate, transform) | Unit test on the function/module |
| Hook or component behavior | Render/act test with stable inputs |
| Cache / persistence | Assert invalid data rejected; valid data accepted |
| API integration shape | Fixture matching real envelope; assert unwrap + row counts |
| Live refresh / polling | Assert refetch conditions (avoid loops; assert force-refresh when needed) |
| UI mutation (add/remove/tier change) | Optimistic update + cache bust helpers (see area skills) |

Prefer testing **behavior**, not implementation details. One focused test per root cause is enough.

## Regression test rules

1. **Name the bug** — test title or comment states what broke (e.g. "rejects empty trend grid cache").
2. **Fail first** — mentally verify the test would fail on the pre-fix code.
3. **No disabled tests** — never commit `it.skip`, `.only`, or commented-out assertions for the new test.
4. **Keep tests enabled in CI** — if the project has no test step in release workflows, add one in the same change.
5. **Avoid brittle structure-only checks** — assert meaningful outcomes (row counts, tier bucket, cache cleared), not mere key presence.

## CI gate (mandatory before release)

| Platform | Command | When to run |
|----------|---------|-------------|
| **Web** | `cd stockdashboard && npm run test:ci` | Before `npm run build` and VPS deploy |
| **Mobile** | `cd stockdashboard/mobile_isolated && npm run test:ci` | Before `npm run android:apk:release` / publish APK |
| **Backend** | `pytest` (or project test command) | Before service restart / deploy |

Release scripts (`publish-release-apk.sh`, `vps-restart`) must not skip the test step.

## Project-specific notes

### Web — `stockdashboard`

- Tests: `src/**/*.test.js` (utils, api, router)
- Command: `npm run test:ci`
- Area skill: `.cursor/skills/web-mutation-refresh-guard/SKILL.md` (admin tiers, LT/ST watchlist)
- Helpers: `adminUserTiers.js`, `watchlistLocalMutation.js`, `adminUsersReload.js`
- Page cache keys: `longTermWatchlist_v*`, `shortTermWatchlist_v*`

### Mobile — `stockdashboard/mobile_isolated`

- Tests: `mobile_isolated/__tests__/**/*.test.js`
- Command: `npm run test:ci` (then `npm run typecheck` before APK)
- Area skill: `.cursor/skills/mobile-regression-guard/SKILL.md`
- Fixtures: `__tests__/fixtures/`
- Cache bumps: `MOBILE_PAGE_CACHE_KEYS` in `dashboardCachePolicy.js`; test in `dashboardCachePolicy.test.js` / `pageCache.test.js`
- Publish: `.cursor/skills/skillhelp/SKILL.md` — tests **must** pass before APK copy

### VPS deploy (web + API)

- After backend or frontend fixes: `.cursor/skills/vps-restart/SKILL.md`
- Hard-refresh guidance for sessionStorage-cached pages

### Other repos

Discover test runner (`package.json`, `pytest.ini`) and mirror the same gate pattern.

## Anti-patterns (caused lost fixes)

- Fixing production code **without** a test
- Relying on manual QA or hard-refresh only
- Shipping APK or web build before `test:ci` passes
- `hasUsable` / cache checks that pass on **empty structure**
- Refetch tied to **visible row count** instead of **data presence**
- Reverting a large commit instead of surgical fix + regression test

## Done checklist (report to user)

When finishing **any** fix:

1. Which test file(s) guard the fix (path + test name)
2. Test command run and result (e.g. "web 36/36, mobile 80/80 passed")
3. Whether CI / publish script runs tests before release
4. Any cache-key bump or user action after install (pull-to-refresh, reinstall)

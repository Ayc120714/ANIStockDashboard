---
name: fix-regression-guard
description: Ensures every bug fix ships with an enabled regression test and CI gate so fixes are not lost later. Use when implementing bug fixes, investigating regressions, reverting broken changes, or when the user asks to protect a fix with tests.
---

# Fix Regression Guard

> when ever a fix is done please make sure its corresponding test is enabled and so that next time if any fix is done those fixes are not lost

## Required workflow (do not skip)

Every bug fix is incomplete until all steps pass:

```
- [ ] 1. Reproduce the failure (symptom + root cause)
- [ ] 2. Implement the minimal fix
- [ ] 3. Add or update a regression test that fails without the fix
- [ ] 4. Run the test suite locally — all relevant tests green
- [ ] 5. Ensure CI runs those tests before release/build
- [ ] 6. Note cache-key bumps or migration steps if the fix depends on invalidating stale state
```

**Do not mark the task done** until step 4 passes. **Do not hand off a release** until step 5 is confirmed.

## What to test

| Fix type | Test target |
|----------|-------------|
| Pure logic (parse, validate, transform) | Unit test on the function/module |
| Hook or component behavior | Render/act test with stable inputs |
| Cache / persistence | Assert invalid data rejected; valid data accepted |
| API integration shape | Fixture matching real envelope; assert unwrap + row counts |
| Live refresh / polling | Assert refetch conditions (avoid loops; assert force-refresh when needed) |

Prefer testing **behavior**, not implementation details. One focused test per root cause is enough.

## Regression test rules

1. **Name the bug** — test title or comment states what broke (e.g. "rejects empty trend grid cache").
2. **Fail first** — mentally verify the test would fail on the pre-fix code.
3. **No disabled tests** — never commit `it.skip`, `.only`, or commented-out assertions for the new test.
4. **Keep tests enabled in CI** — if the project has no test step in release workflows, add one in the same change.
5. **Avoid brittle structure-only checks** — e.g. do not assert `daily` key exists; assert **row count > 0** when data is required.

## CI gate

When the project has CI (GitHub Actions, etc.):

- Add or extend `npm test`, `pytest`, `go test`, etc. **before** APK/docker/release build steps.
- Use a CI-friendly script (`jest --ci --forceExit`, `pytest -q`, etc.).
- Confirm locally: typecheck/lint + tests + build (if applicable).

## Scoped fixes only

When a broad change breaks other areas:

- Fix the **narrow root cause** (one module or policy), not global cache/loader behavior.
- Add tests for the **scoped** behavior so unrelated screens are not regressed.
- Bump versioned cache keys when stale on-device data can mask the fix.

## Anti-patterns (caused lost fixes in past work)

- Fixing production code without a test
- Relying on manual QA only
- `hasUsable` / cache checks that pass on **empty structure**
- Refetch triggers tied to **visible row count** instead of **data presence** (infinite loops / stale UI)
- Reverting a large commit instead of a surgical fix + regression test
- Shipping APK/release before tests are in CI

## Project-specific notes

For **ani-stock `mobile_isolated`**:

- Tests live in `mobile_isolated/__tests__/**/*.test.js`
- Run: `npm run test:ci` (must pass before APK/AAB)
- CI: `.github/workflows/android-apk.yml` and `android-aab.yml`
- Shared fixtures: `__tests__/fixtures/`
- Cache policy tests belong in `dashboardCachePolicy.test.js` / `pageCache.test.js` when bumping `MOBILE_PAGE_CACHE_KEYS`

For other repos: discover test runner (`package.json` scripts, `pytest.ini`, etc.) and mirror the same gate pattern.

## Done checklist (report to user)

When finishing a fix, briefly confirm:

1. Which test file(s) guard the fix
2. Test command run and result (e.g. "28/28 passed")
3. Whether CI was updated to run tests
4. Any cache-key bump or user action needed after install (pull-to-refresh, reinstall)

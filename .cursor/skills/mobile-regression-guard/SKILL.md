---
name: mobile-regression-guard
description: >-
  Ensures every mobile (React Native) fix ships with an enabled Jest regression
  test and passes test:ci before APK publish. Use for any mobile_isolated bug
  fix, cache policy, watchlist, admin, signals, advisor, or dashboard change.
---

# Mobile Regression Guard

> **Every mobile fix** must include an enabled unit test in `mobile_isolated/__tests__/` and pass `npm run test:ci` before APK build or publish.

Read **`.cursor/skills/fix-regression-guard/SKILL.md`** first (universal web + mobile rules).

## Required workflow

```
- [ ] 1. Reproduce on device or simulator (symptom + root cause)
- [ ] 2. Minimal fix in mobile_isolated/src/
- [ ] 3. Add/update test in __tests__/ (same PR/commit)
- [ ] 4. npm run test:ci — all tests green
- [ ] 5. npm run typecheck — pass (before APK)
- [ ] 6. Bump MOBILE_PAGE_CACHE_KEYS version if stale AsyncStorage can mask fix
- [ ] 7. Publish only via skillhelp after steps 4–5 (if releasing APK)
```

## Where to put tests

| Area changed | Preferred test file |
|--------------|---------------------|
| `watchlistService.js` | `__tests__/watchlistService.test.js` |
| `dashboardCachePolicy.js` | `__tests__/dashboardCachePolicy.test.js` |
| `pageCache.js` / hydration | `__tests__/pageCache.test.js`, `pageCacheHydration.test.js` |
| Signals / inbox merge | `__tests__/signalsTabPayload.test.js`, `alertInboxReadState.test.js` |
| Advisor trend/chart | `__tests__/fetchAdvisorTrendPayload.test.js`, `advisorHubCache.test.js` |
| New pure util | `__tests__/<moduleName>.test.js` (new file) |

Extract pure logic from screens into `src/core/utils/` or `src/core/api/services/` when the screen is hard to test.

## Area patterns (regression targets)

### Watchlist add/remove (`WatchlistSection.js`, `watchlistService.js`)

- Clear page cache on mutation (`clearPageCache` in service)
- Optimistic row update before refetch
- `loadGenRef` / `cacheBust` on force reload
- Test: `watchlistService.test.js` asserts POST/DELETE + cache clear

### Admin tier actions (`AdminScreen.js`, `authService.js`)

- `fetchAdminUsers(..., { cacheBust: true })` after mutations
- Tier sections + scroll/highlight after action
- Test: service mocks + tier helpers if extracted

### Dashboard / cache / pull-to-refresh

- `applyPullRefreshPolicy`, `dashboardSectionsToRefresh`
- Test: `dashboardCachePolicy.test.js`

### Signals / notifications

- Merged live alerts, inbox cache-first load
- Test: dedicated payload util tests

## Commands

```bash
cd /opt/ani-stock/stockdashboard/mobile_isolated
npm run test:ci
npm run typecheck
```

## Publish gate

**Never** run `android:apk:release` or `publish-release-apk.sh` until `test:ci` passes.

See **`.cursor/skills/skillhelp/SKILL.md`**.

## Anti-patterns

- Mobile-only fix with no `__tests__` update
- Skipping tests to ship APK faster
- Bumping UI without bumping cache key when AsyncStorage hides the fix
- Duplicating web logic without parity tests on shared behavior

## Related

- `.cursor/skills/fix-regression-guard/SKILL.md` — universal rule
- `.cursor/skills/web-mutation-refresh-guard/SKILL.md` — web parity for watchlist/admin

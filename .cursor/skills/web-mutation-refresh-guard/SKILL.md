---
name: web-mutation-refresh-guard
description: >-
  Guards web dashboard fixes where admin tier moves or LT/ST watchlist adds must
  update UI immediately without hard refresh. Requires regression tests in
  src/utils and src/api. Use when fixing admin user directory, watchlist
  add/remove, stale GET cache, optimistic UI, or tier scroll/highlight after
  mutations on stockdashboard (web).
---

# Web Mutation Refresh Guard

> **All web fixes** require a regression unit test (see **`.cursor/skills/fix-regression-guard/SKILL.md`**). This skill adds **extra** requirements for **admin tier actions** and **LT/ST watchlist mutations**.

Read the global skill first (reproduce → fix → test → CI). Mobile parity: **`.cursor/skills/mobile-regression-guard/SKILL.md`**.

## When this skill applies

| Symptom | Area |
|---------|------|
| User stays in wrong admin table until hard refresh | Admin directory |
| Grant monthly/yearly/lifetime does not scroll/highlight | Admin directory |
| Added stock missing from LT/ST until hard refresh | Watchlist pages |
| Poll/background load overwrites fresh mutation | Watchlist `loadGenRef` |

## Required implementation patterns (web)

### Admin user directory

1. **Fresh reload** — use `fetchFreshAdminUsers()` from `src/utils/adminUsersReload.js` (clears `clearApiGetCache` + `skipCache: true`).
2. **Silent post-mutation reload** — `loadUsers({ silent: true })` so tables stay mounted.
3. **Tier classification** — import from `src/utils/adminUserTiers.js` (`tierForUser`, `isMonthlyPremiumUser`, etc.).
4. **Focus after action** — `onUserActionComplete` → `focusUserInDirectory(userId, nextRows, hintTier)`; scroll via `adminTierSectionId(tier)`.
5. **Section ids** — `admin-tier-lifetime`, `admin-tier-monthly`, `admin-tier-yearly`, `admin-tier-basic` on tier `<Box>` wrappers.

### LT / ST watchlist (`LongTermPage.js`, `ShortTermPage.js`)

1. **Optimistic rows** — `applyWatchlistRowMutation(prev, { added, removed })` from `src/utils/watchlistLocalMutation.js` before network refresh.
2. **Force refresh** — `load({ forceRefresh: true })` clears page cache + API GET cache; `fetchWatchlist(..., { skipCache: true })`.
3. **Mutation API cache** — `addToWatchlist` / `removeFromWatchlist` / `bulkDeleteFromWatchlist` call `clearApiGetCache()` in `src/api/watchlist.js`.
4. **Race guard** — `loadGenRef` in page `load()`; ignore stale responses when `gen !== loadGenRef.current`.
5. **Cache keys** — bump `LONG_TERM_CACHE_KEY` / `SHORT_TERM_CACHE_KEY` version when changing cache shape.

## Required regression tests

Add or extend tests **in the same PR** as the fix:

| Guard | Test file | What it asserts |
|-------|-----------|-----------------|
| Admin tier buckets | `src/utils/adminUserTiers.test.js` | `tierForUser` for lifetime / monthly / yearly / basic |
| Watchlist optimistic UI | `src/utils/watchlistLocalMutation.test.js` | `applyWatchlistRowMutation` add/remove without duplicate |
| Watchlist poll/cache race | `src/utils/watchlistPageMutation.test.js` | optimistic persist + load generation bump |
| API cache bust | `src/api/mutationCache.test.js` | `clearApiGetCache` on watchlist mutations; `fetchFreshAdminUsers` uses `skipCache` |

**Do not** ship admin/watchlist mutation fixes without at least one new or updated test in the table above.

## Run tests (web)

```bash
cd stockdashboard
npm run test:ci
```

All tests must pass before `npm run build` and VPS deploy (see `vps-restart` skill).

## Checklist (copy per fix)

```
- [ ] Root cause documented (stale GET cache / missing optimistic update / race)
- [ ] Fix uses shared util (adminUserTiers, watchlistLocalMutation, adminUsersReload) when applicable
- [ ] Regression test added/updated in mapped test file
- [ ] npm run test:ci green
- [ ] Cache key bumped if sessionStorage/GET cache can mask fix
- [ ] Mobile parity checked (mobile_isolated WatchlistSection / AdminScreen) if same bug exists on app
```

## Anti-patterns

- `fetchAdminUsers()` without `skipCache` after tier mutation
- `load()` after add without `forceRefresh` or optimistic `setData`
- Duplicating tier logic in page files instead of `adminUserTiers.js`
- Fixing web only with no regression test
- Relying on manual hard-refresh QA

## Related skills

- `.cursor/skills/fix-regression-guard/SKILL.md` — global test + CI gate
- `.cursor/skills/vps-restart/SKILL.md` — deploy web build after tests pass

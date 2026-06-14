# Fix Regression Guard — Examples

## Example 1: Empty cache treated as valid (trend reversal)

**Symptom:** B1–S3 tables show 0 matches; spinner stuck.

**Root cause:** `cacheHasUsableData` returned true for `{ daily, weekly, monthly }` keys with zero items; refetch loop on `trendVisibleRows === 0`.

**Fix:** Row-count validation + remove visible-row refetch trigger + cache key bump.

**Tests added:**
- `pageCache.test.js` — empty grid not usable
- `advisorHubCache.test.js` — `normalizeTrendGrid` unwrap + `countTrendGridRows`
- `dashboardCachePolicy.test.js` — cache key version + live refresh policy

**CI:** `npm run test:ci` before `android:apk:release`.

---

## Example 2: Pagination reset every render

**Symptom:** List pages jump back to page 1.

**Root cause:** `resetDeps = []` default created new array reference each render.

**Fix:** Stable `EMPTY_RESET_DEPS` + `resetSignature` in `usePagedList`.

**Test:** `usePagedList.test.js` — page stays on 2 when `resetDeps` omitted; resets when deps change.

---

## Example 3: Dashboard movers stale during market hours

**Symptom:** Gainers/losers not updating live.

**Root cause:** `need.movers` stayed false when cache had stale movers.

**Fix:** Force `need.indices/movers/watchlist/signals` during live session + 30s poll.

**Test:** `dashboardCachePolicy.test.js` — live session forces movers refresh even when cache looks complete.

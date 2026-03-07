## Frontend Release Notes

### 1) Portfolio Manager showing paper/stale data
- **Root cause:** Timeline and fallback rows could include legacy paper-mode entries.
- **Fixes:**
  - `src/pages/PortfolioManagerPage.js`
    - Enforced live-only order filtering in timeline and Dhan fallback order feed.
- **Outcome:** Portfolio Manager displays live trading context only.

### 2) Dhan consent limit UX (25 logins/day)
- **Root cause:** Consent-limit errors were surfaced inconsistently and not clearly communicated.
- **Fixes:**
  - `src/api/dhan.js`
    - Added centralized Dhan error normalization for consent-limit failures.
  - `src/pages/ProfilePage.js`
    - Added 25/day advisory banner.
    - Added daily block guard for repeated consent attempts.
  - `src/pages/DhanCallbackPage.js`
    - Added explicit 25/day info banner.
    - Persisted consent block marker for day-level behavior.
- **Outcome:** Users get clear guidance when consent limits are reached.

### 3) Date + symbol search not showing expected stocks
- **Root cause:** Screens fetched a limited subset, so valid symbols were often excluded before local search ran.
- **Fixes:**
  - `src/pages/PriceShockersPage.js`
    - In search mode, fetches both gainers and losers with larger limits and merges by symbol.
  - `src/pages/TrendingPage.js`
  - `src/pages/VolumeShockersPage.js`
  - `src/pages/RelativePerformancePage.js`
    - Added search-aware larger fetch limits and separate cache keys.
- **Outcome:** Symbol searches on selected dates are consistent across Screens pages.

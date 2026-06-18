# Example: LT/ST watchlist fix — child briefs

**Master goal:** Add/delete on LT and ST watchlists updates UI immediately without hard refresh.

---

## Child A — explore (readonly)

```
<identity_context>
Senior frontend engineer specializing in React data-fetching and cache races.
</identity_context>

<world_context>
Repo: /opt/ani-stock/stockdashboard
Pages: LongTermPage.js, ShortTermPage.js
API: fetchWatchlist, pageDataCache sessionStorage
</world_context>

<task_context>
Trace add/delete handlers through load(), polling, and cache keys.
Return root cause of stale rows after mutation.
</task_context>

<example_context>
Good: identifies poll re-hydrating stale cache
Bad: generic "cache might be wrong" without file:line
</example_context>

<constraint_context>
Readonly. No edits. Return ≤ 15 bullets.
</constraint_context>
```

---

## Child B — generalPurpose (implementation)

```
<identity_context>
Senior full-stack engineer on ANI Stock web dashboard.
</identity_context>

<world_context>
Fix applies to both /long-term and /short-term routes.
Users bulk-delete via checked rows (see screenshot pattern).
</world_context>

<task_context>
Implement optimistic mutation + cache persist + silent poll.
Add watchlistPageMutation.test.js regression tests.
Done when: npm run test:ci passes.
</task_context>

<example_context>
Good: computeOptimisticWatchlistMutation + resolveWatchlistRowsAfterFetch
Bad: only clearPageCache on forceRefresh without optimistic write
</example_context>

<constraint_context>
- Read fix-regression-guard skill
- Bump cache keys if shape changes
- Deploy: npm run build && rsync to /var/www/ani-stock/
</constraint_context>
```

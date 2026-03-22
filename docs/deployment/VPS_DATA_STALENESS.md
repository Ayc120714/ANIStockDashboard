# VPS: missing or stale dashboard / Screens data

Use this when the **UI loads** but **FII/DII charts are empty**, **Trending is blank**, **AI Picks has no rows**, or numbers look **₹0 / “No chart data”** while the same build works locally.

---

## 0. Startup: full data bootstrap on every restart (backend)

By default (`STARTUP_BOOTSTRAP_BEFORE_ORCHESTRATOR=true` in `backend_stockdashboard/.env`), the API **runs `run_startup_data_bootstrap()` and waits for it** before starting the **orchestrator** on **every** process restart. That refreshes candles, indices, sector outlook, FII/DII attempt, etc., so you are less likely to serve empty/stale data right after a deploy.

- **First requests after restart** may lag until bootstrap finishes (Samco, DB work).  
- **Timeout:** `STARTUP_BOOTSTRAP_TIMEOUT_SEC` (default **7200**). If bootstrap is still running, the server logs a warning and starts the orchestrator anyway.  
- **Fast dev restarts:** set `STARTUP_BOOTSTRAP_BEFORE_ORCHESTRATOR=false` (bootstrap runs in background; orchestrator starts immediately).  
- **Readiness:** `GET /api/system/readiness` → `bootstrap_complete: true` after the bootstrap gate releases (see `app/scheduler.py`).

---

## 1. Confirm the browser hits the right API

The React app must call **your** backend base URL (e.g. `https://www.aycindustries.com/api`), not `localhost`.

1. Open DevTools → **Network**, reload the page.
2. Check requests like `/api/fii-dii/`, `/api/stocks/trending`, `/api/system/status`.
3. **Status must be 200** (not 404/502/CORS error). If you see HTML from Nginx or a wrong host, fix **`REACT_APP_API_URL`** / **`REACT_APP_TRADE_API_URL`** in **`.env.production`**, then **`npm run build`** and redeploy static files.

From the **VPS shell** (replace domain):

```bash
curl -sS "https://www.aycindustries.com/api/system/status" | head -c 500
curl -sS "https://www.aycindustries.com/api/fii-dii/?days=20" | head -c 800
curl -sS "https://www.aycindustries.com/api/stocks/screen-dates" | head -c 500
curl -sS "https://www.aycindustries.com/api/stocks/trending?limit=5" | head -c 800
```

If these fail or return errors, fix **Nginx `/api/` proxy → Uvicorn** and **`ani-backend`** first.

---

## 2. FII / DII cash: ₹0 and “No chart data”

**Data path:** PostgreSQL table **`fii_dii_activity`** (category `cash`), filled by:

- Background/scheduler jobs, and/or  
- **On-demand refresh** when the API sees empty/stale rows — it calls **Trendlyne** (`app/external/fii_dii_fetcher.py` → HTTP GET).

**Common VPS issues**

| Cause | What to check |
|--------|----------------|
| Empty DB + **Trendlyne blocked** | Datacenter IP blocked by Cloudflare / rate limits. **Logs:** `journalctl -u ani-backend -n 200` → look for `FII/DII on-demand refresh failed` or `requests` errors. |
| **Outbound HTTPS blocked** | Firewall / provider policy. Test: `curl -sSI https://trendlyne.com/macro-data/fii-dii/latest/cash-pastmonth/` from the VPS. |
| Rows exist but **all zeros** | API treats as bad import and may retry refresh; if remote still fails, charts stay empty. |
| **Stale > 7 days** | Code may trigger refresh; same network constraints apply. |

**Database check (PostgreSQL)**

```sql
SELECT date, fii_net, dii_net FROM fii_dii_activity WHERE category = 'cash' ORDER BY date DESC LIMIT 5;
```

If empty: fix **outbound fetch** or run a one-off import after confirming `curl` to Trendlyne works from the server.

---

## 3. Screens → **Trending** empty (but **Top Movers** may work)

**Trending** (`GET /api/stocks/trending`) uses **`_query_snapshot_or_live`**: it prefers **screen snapshots** for the selected **date** when snapshots exist; otherwise **live** `StockSectorInfo` rows sorted by **`day1d`**.

**Why Trending can be empty**

1. **No snapshot** for the date you picked — check **`GET /api/stocks/screen-dates`** (`dates: []` → no historical screen runs).
2. **`StockSectorInfo`** not populated yet — bootstrap / Samco / candle sync still running (dashboard may say “Background data sync…”).
3. **Date picker** left empty while DB only has snapshot for specific days — pick a date returned by **`screen-dates`**, or wait for live rows.

**Quick checks**

```bash
curl -sS "https://YOUR_DOMAIN/api/stocks/screen-dates"
curl -sS "https://YOUR_DOMAIN/api/stocks/trending?limit=10"
curl -sS "https://YOUR_DOMAIN/api/stocks/trending?limit=10&date=YYYY-MM-DD"
```

**Top Movers** uses different query parameters (gainers/losers, period); it can show rows while Trending is empty if snapshots/day1d differ.

---

## 4. Screens → **AI Picks** (“No weekly picks…”)

Picks are **generated on a schedule** (typically **Saturday 2:00 AM**) and stored server-side. If the job never ran on this server (new DB, scheduler off, crash), the UI stays empty.

**Check**

- Backend logs / scheduler: **`ENABLE_ORCHESTRATOR`**, **`BACKGROUND_REFRESH`** (see your `.env` and **[BACKEND_STARTUP_READINESS.md](BACKEND_STARTUP_READINESS.md)** if present).
- Advisor-related tables/API (your deployment may expose **`/api/advisor/...`** — verify in OpenAPI **`/docs`**).

Triggering **Refresh** in the UI only helps if the backend implements a manual regenerate endpoint and DB is ready.

---

## 5. Bootstrap & background jobs

Production should eventually report readiness:

```bash
curl -sS "https://YOUR_DOMAIN/api/system/readiness"
```

If **`bootstrap_complete`** is never true, many endpoints return **partial or empty** data until Samco sync / DB fill completes. See **[VPS_INSTALL_RUN_AYCINDUSTRIES.md](VPS_INSTALL_RUN_AYCINDUSTRIES.md)** and **[VPS_RESTART_FRONTEND_BACKEND.md](VPS_RESTART_FRONTEND_BACKEND.md)** for env vars (`SAMCO_*`, DB URL) and restart order.

---

## 6. Browser cache

The Trending page caches responses in **`sessionStorage`**. After fixing the API, use **hard refresh** (Ctrl+F5) or clear site data for the domain so you are not seeing an old empty payload.

---

## 7. Short checklist

- [ ] `curl` `/api/system/status` and `/api/fii-dii/?days=20` return **200** and JSON (not HTML).
- [ ] `REACT_APP_API_URL` matches public API URL; rebuilt frontend deployed to `/var/www/...`.
- [ ] PostgreSQL has rows in **`fii_dii_activity`** (or Trendlyne reachable from VPS).
- [ ] **`screen-dates`** lists dates OR live **`StockSectorInfo`** has momentum (`day1d`) after sync.
- [ ] **`journalctl -u ani-backend -f`** shows no repeated errors during page load.
- [ ] Readiness / bootstrap complete when using full orchestrator.

For **SMTP / auth** issues, see **[SMTP_VPS_TIMEOUT.md](SMTP_VPS_TIMEOUT.md)**.

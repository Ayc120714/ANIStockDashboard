---
name: vps-restart
description: >-
  Restart or redeploy the ANI Stock VPS frontend and backend after code fixes.
  Use when the user asks to restart, reload, redeploy, refresh servers, apply
  fixes to production, or run deploy commands on the VPS (aycindustries.com).
  Always use the exact commands in this skill — do not substitute shortcuts.
---

# VPS restart — frontend & backend (ANI Stock)

Run these **exact** commands on the VPS when restarting after a fix or deploy.

## Frontend

```bash
cd /opt/ani-stock/stockdashboard
npm ci && npm run build
sudo rsync -av --delete build/ /var/www/ani-stock/
sudo nginx -t && sudo systemctl reload nginx
```

Run the full block when **frontend** code changed or the user asks to restart/redeploy the frontend.

## Backend

```bash
cd /opt/ani-stock/backend_stockdashboard
sudo systemctl daemon-reload && sudo systemctl restart ani-backend
```

Run when **backend** code or `.env` / unit file changed, or the user asks to restart the backend.

## Database migrations (PostgreSQL)

Always use `DATABASE_URL` from `backend_stockdashboard/.env` — do **not** hardcode `ani_stock`, `postgres`, or passwords.

```bash
cd /opt/ani-stock/backend_stockdashboard
chmod +x scripts/run_sql_migration.sh
./scripts/run_sql_migration.sh scripts/migrations/011_premium_plan.sql
```

Verify a column (optional):

```bash
cd /opt/ani-stock/backend_stockdashboard
source scripts/lib/load_dotenv.sh && load_dotenv_file .env
psql --dbname="$(psql_database_uri)" -tAc "SELECT column_name FROM information_schema.columns WHERE table_name='app_users' AND column_name='premium_plan';"
```

## Both (typical after a full fix)

1. Backend block first (API must serve new logic).
2. Frontend block second (static assets + nginx reload).

## Verify (optional, after restart)

```bash
systemctl is-active ani-backend
curl -s -o /dev/null -w "backend=%{http_code}\n" http://127.0.0.1:8000/api/system/status
```

Tell the user to **hard-refresh** after deploy. Legacy formatted screen caches are purged automatically on first screen load.

## Mobile APK (after backend or mobile fixes)

If the change affects mobile clients (API, auth, premium, advisor, screens, or `mobile_isolated/`), also run the **`publish-mobile-apk`** skill:

```bash
/opt/ani-stock/stockdashboard/.cursor/skills/publish-mobile-apk/scripts/publish-release-apk.sh "Release notes"
```

This updates `DOWNLOAD.json` so installed users see the **App update available** popup.

## Screen CHG% cache matrix (web + mobile)
|------|-------------|-----------------|-------------|--------|
| **Trending** | Screens → Trending | `trendingStocksData_v3_*` | `day1d` from API | Raw cache + `mapRows` |
| **Top Movers** | Screens → Price shockers | `priceShockersData_v4_*` | `day1d` / `week1w` / `month1m` | Raw cache + `mapRows` |
| **Volume Movers** | Screens → Volume shockers | `volumeShockersData_v5_*` | price + volume % | Raw cache + `mapRows` |
| **Alpha Tracker** | Screens → Relative performance | `relativePerformanceData_v3_*` | horizon field + RS% | Raw cache + `mapRows` |
| **Dashboard** | Overview movers / trending strip | `dashboard_overview_cache_v5` | fresh API on load | Raw fetch + map |
| **Sector outlook** | Markets → Sector | `sectorOutlookData` | sector % columns | Not stock `day1d` — OK |
| **Sub-sector popup** | Sub-sector modal | server-side | EOD candles | Backend `subsector-outlook` |
| **Trend reversal** | Advisor tab | `trend_reversal_*` | `chg_pct` from advisor API | Different pipeline |
| **Mobile Screens hub** | All screen tabs | `screens-v5-*` | `stockRowPct()` at render | Already raw API rows |
| **Mobile dashboard** | Home | `dashboard-v15` | `stockRowPct()` at render | Cache bump |

## Notes

- Nginx may also serve from `/opt/ani-stock/stockdashboard/build` depending on vhost; `npm run build` updates that path. Keep **rsync to `/var/www/ani-stock/`** as part of the standard workflow.
- Do not skip `npm ci` before `npm run build` on VPS deploys.
- Do not use `systemctl restart ani-backend` without `daemon-reload` when unit files may have changed.

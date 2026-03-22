# VPS: full-stack enablement checklist (backend ↔ frontend)

Use this when **FII/DII, Market Insights, Screens, or SubSector data** look empty/wrong even after `git pull`.  
Git is only half the story: the **production build**, **API base URL**, **Nginx → Uvicorn**, **database**, and **outbound jobs** must all line up.

Related: [VPS_RESTART_FRONTEND_BACKEND.md](./VPS_RESTART_FRONTEND_BACKEND.md), [VPS_DATA_STALENESS.md](./VPS_DATA_STALENESS.md).

---

## 1. Two repos vs one folder — pull **both**

| Repo | Typical path on VPS | Purpose |
|------|---------------------|--------|
| **Frontend** | `/opt/ani-stock/stockdashboard` | `ANIStockDashboard` — React, `npm run build` |
| **Backend** | `/opt/ani-stock/backend_stockdashboard` | `backend_stockdashboard` — FastAPI, **separate** `git pull` |

If you only pull **stockdashboard**, **API code never updates** (no FII fixes, trending EMA, subsector trend strings, etc.).

```bash
cd /opt/ani-stock/stockdashboard && git pull origin main
cd /opt/ani-stock/backend_stockdashboard && git pull origin main
```

Confirm latest commits:

```bash
cd /opt/ani-stock/stockdashboard && git log -1 --oneline
cd /opt/ani-stock/backend_stockdashboard && git log -1 --oneline
```

**systemd `WorkingDirectory`** for `ani-backend` must point at the **backend** repo you actually pulled (see unit file: `systemctl cat ani-backend`).

---

## 2. Frontend **must** be built with the public API URL (not localhost)

`src/api/apiClient.js` uses:

```text
process.env.REACT_APP_API_URL || 'http://localhost:8000/api'
```

If **`REACT_APP_*` is unset at build time**, the bundle calls **`http://localhost:8000`** in users’ browsers → **every API fails** (FII/DII, stocks, auth).

### Required on the machine where you run `npm run build`

Create/update **`.env.production`** in the **frontend repo root** (same folder as `package.json`):

```env
REACT_APP_API_URL=https://www.aycindustries.com/api
REACT_APP_TRADE_API_URL=https://www.aycindustries.com/api
```

(Use your real domain if different.)

Then **rebuild and redeploy static files**:

```bash
cd /opt/ani-stock/stockdashboard
npm ci
npm run build
sudo rsync -av --delete build/ /var/www/ani-stock/
```

**There is no `npm start` on the VPS for production** — Nginx serves `/var/www/ani-stock`.

---

## 3. Nginx must be **running** and proxy `/api/` → backend

- **`reload`** only works if nginx is **already active**. If you see `nginx.service is not active`, run:

  ```bash
  sudo nginx -t && sudo systemctl start nginx
  sudo systemctl status nginx
  ```

- Site config should proxy **`/api/`** to **`http://127.0.0.1:8000`** (or your Uvicorn bind).

Quick checks:

```bash
curl -sS -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1:8000/api/system/status
curl -sS -o /dev/null -w "HTTP %{http_code}\n" https://www.aycindustries.com/api/system/status
```

Both should be **200** (replace domain as needed).

---

## 4. Backend service and `.env`

### 4a. Install Python deps in the **venv** (not system `pip`)

On **Debian / Ubuntu**, system Python is **PEP 668** (“externally managed”): **`pip install -r requirements.txt` without a venv fails** with `externally-managed-environment`.

The backend should use a project **virtualenv** (same one **`ani-backend`** uses — usually **`.venv`** next to `requirements.txt`):

```bash
cd /opt/ani-stock/backend_stockdashboard

# Create venv once if missing
test -d .venv || python3 -m venv .venv

source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate

sudo systemctl restart ani-backend
```

Confirm **`systemd` points at that venv** (must match where you installed packages):

```bash
systemctl cat ani-backend | grep -E 'ExecStart|WorkingDirectory'
```

You should see something like **`…/backend_stockdashboard/.venv/bin/uvicorn`**. If **`ExecStart`** uses a different path, either install into **that** venv or align the unit file with **`/opt/ani-stock/backend_stockdashboard/.venv`**.

```bash
sudo systemctl restart ani-backend
sudo systemctl status ani-backend --no-pager
journalctl -u ani-backend -n 80 --no-pager
```

Backend **`backend_stockdashboard/.env`** must include at least:

- **`DATABASE_URL`** (or `SQLALCHEMY_DATABASE_URL`) → real PostgreSQL (or your DB)
- **`TOKEN_HASH_SECRET`** / auth secrets as you use in prod

If the API cannot connect to the DB, tables stay empty and pages show no data.

---

## 5. FII/DII specifically (not “generated” in app — **scraped + DB**)

**Flow:**

1. Browser → `GET /api/fii-dii/?days=20` (via `REACT_APP_API_URL`)
2. API reads **`fii_dii_activity`**; if empty/stale, tries **`refresh_fii_dii_data()`** → HTTP GET **Trendlyne** (`app/external/fii_dii_fetcher.py`)

**Nothing to “enable” in Git** except deploying backend code. **Operational requirements:**

| Check | Command / action |
|--------|------------------|
| API returns JSON | `curl -sS "https://YOUR_DOMAIN/api/fii-dii/?days=5" \| head -c 600` |
| VPS can reach Trendlyne | `curl -sSI https://trendlyne.com/macro-data/fii-dii/latest/cash-pastmonth/` |
| DB has rows | `SELECT COUNT(*), MAX(date) FROM fii_dii_activity WHERE category='cash';` |
| Errors in logs | `journalctl -u ani-backend \| grep -i fii` |

If Trendlyne **HTML changed** (table id / `data-jsondata`), the fetcher can fail until code is updated — check logs for `Could not locate Trendlyne cash table`.

Manual refresh (after deploy):

```bash
curl -sS "http://127.0.0.1:8000/api/fii-dii/refresh"
```

---

## 5b. Admin-only UI (Admin Users / Telegram Admin)

**Already implemented** in code:

| Layer | Behaviour |
|--------|-----------|
| **Sidebar** | `src/components/Sidebar/Sidebar.js` — links render only when `useAuth().isSuperAdmin` is true. |
| **Routes** | `src/routes/AppRouter.js` — `/admin-users` and `/telegram-admin` are wrapped in `<AdminRoute>`. |
| **AdminRoute** | `src/routes/AdminRoute.js` — not logged in → `/login`; not super-admin → `/` (dashboard). |
| **Backend** | `app/api/auth.py` — `AUTH_SUPER_ADMIN_EMAILS` (comma list); admin APIs call `_require_super_admin()`. |

**Frontend** super-admin list: `REACT_APP_SUPER_ADMIN_EMAILS` (optional) merged with defaults in `src/auth/AuthContext.js`.  
**Backend** must list the **same** emails: `AUTH_SUPER_ADMIN_EMAILS` in `backend_stockdashboard/.env` (defaults include `gvc1990@gmail.com`, `admin@aycindustries.com`).

If a normal user still **manually opens** `/admin-users`, they are redirected home; API calls from their token return **403** from protected admin routes.

### Screens / 3-year snapshot backfill (backend)

After each backend start, **`STARTUP_SCREEN_SNAPSHOT_BACKFILL_DAYS`** (default **1095** ≈ 3 years) drives a **background** `backfill_snapshots` so **Screens** history fills without blocking API readiness. Optional: set **`STARTUP_SCREEN_SNAPSHOT_BACKFILL_DAYS=365`** on a small VPS if needed. Index multi-year % uses existing Samco index EOD backfill (**`SAMCO_INDEX_BACKFILL_DAYS`**, default 1200) inside the candle sync path.

---

## 6. Other pages (quick mapping)

| UI area | API (examples) | If empty, check |
|---------|----------------|-----------------|
| Market indices / FII cards | `/api/market-indices/`, `/api/fii-dii/` | Build URL, nginx, DB, Trendlyne |
| SubSector Insights | `/api/subsector-outlook/grouped` | Backend pull, `StockSectorInfo` / weekly jobs. **CHG% fix:** **`STOCK_PERSIST_EOD_DAY1D=true`** (default) saves EOD-based `day1d` when `/api/subsector-stocks` loads a page — keeps Screens/Trending aligned with the modal. |
| Screens → Trending | `/api/stocks/trending` | `StockSectorInfo.day1d`, snapshots — see [VPS_DATA_STALENESS.md](./VPS_DATA_STALENESS.md) |
| Advisor / Alerts | advisor + scheduler routes | DB jobs, not only Git |

---

## 7. Browser verification (always do this)

1. Open site → **F12 → Network**.
2. Reload → find **`fii-dii`** or **`market-indices`**.
3. Confirm **Request URL** is **`https://your-domain/api/...`**, not `localhost`.
4. Status **200** and JSON body — not HTML error page.

If the request URL is still `localhost:8000`, **rebuild the frontend** with `.env.production` as in section 2.

---

## Summary: “nothing works” order of operations

1. **`git pull`** frontend **and** backend repos.  
2. **Backend:** `.env`, `systemctl restart ani-backend`, `curl localhost:8000/api/system/status`.  
3. **Frontend:** `.env.production` → **`npm run build`** → **rsync** to `/var/www/ani-stock/`.  
4. **Nginx:** `start` if inactive, `nginx -t`, proxy test with `curl` to domain.  
5. **FII/DII:** `curl` API + Trendlyne from VPS + DB row count + logs.

No separate Git branch is required for these features — **`main`** is fine as long as both repos are deployed and the **production build** uses the **public API base URL**.

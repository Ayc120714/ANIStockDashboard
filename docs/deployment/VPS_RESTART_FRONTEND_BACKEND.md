# VPS: restart frontend + backend

Use this whenever you need to **restart** or **redeploy** on the VPS (systemd + Nginx + static React build).
For first-time install, see **[VPS_INSTALL_RUN_AYCINDUSTRIES.md](VPS_INSTALL_RUN_AYCINDUSTRIES.md)**.

**Typical layout**

| Item | Path / name |
|------|-------------|
| App source | `/opt/ani-stock/stockdashboard` |
| Backend (monorepo) | `/opt/ani-stock/backend_stockdashboard` |
| Static site (Nginx `root`) | `/var/www/ani-stock` |
| Backend service | `ani-backend` → Uvicorn `127.0.0.1:8000` |

Adjust paths if your server differs.

---

## 1. SSH into the VPS

```bash
ssh your-user@YOUR_VPS_IP
```

---

## 2. Quick restart (no new build)

Use when you only need to **bounce processes** and did **not** change code or env files.

### Backend (FastAPI / Uvicorn)

```bash
sudo systemctl restart ani-backend
sudo systemctl status ani-backend --no-pager
journalctl -u ani-backend -n 80 --no-pager
```

### Frontend (production)

The live site is **static files** served by **Nginx** from `/var/www/ani-stock`. There is **no** `npm start` on the server. New files copied into that folder are served immediately.

### Nginx (optional, e.g. after vhost edits)

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### Quick health checks

```bash
curl -sS http://127.0.0.1:8000/api/system/status
curl -sSI https://www.aycindustries.com
```

Replace the domain with yours if different.

---

## 3. Full restart after `git pull` (rebuild + deploy)

Use after pulling **frontend and/or backend** changes.

### Monorepo (backend inside `stockdashboard/backend_stockdashboard`)

```bash
cd /opt/ani-stock/stockdashboard
git pull origin main

# Backend — venv + dependencies (if requirements changed)
cd backend_stockdashboard
source .venv/bin/activate
pip install -r requirements.txt
deactivate
cd /opt/ani-stock/stockdashboard

# Frontend — install + production build (Craco)
npm ci
npm run build

# Deploy static assets
sudo rsync -av --delete build/ /var/www/ani-stock/

# Restart API
sudo systemctl restart ani-backend
journalctl -u ani-backend -n 50 --no-pager

# Reload Nginx
sudo nginx -t && sudo systemctl reload nginx
```

### Two separate repos (frontend + backend clones)

Set directories explicitly, then pull each repo, `pip install` in the backend venv, and run the same `npm ci`, `npm run build`, `rsync`, `systemctl restart`, `nginx` steps from the frontend app root.

Example env for scripts:

```bash
export APP_DIR=/opt/ani-stock/stockdashboard
export BACKEND_DIR=/opt/ani-stock/backend_stockdashboard
```

### Optional: project deploy script

From **`/opt/ani-stock/stockdashboard`** (adjust `BACKEND_DIR` for monorepo vs two-repo):

```bash
export APP_DIR=/opt/ani-stock/stockdashboard
export BACKEND_DIR=/opt/ani-stock/stockdashboard/backend_stockdashboard
export BACKEND_SERVICE=ani-backend
chmod +x scripts/deploy.sh scripts/post-deploy-check.sh 2>/dev/null || true
./scripts/deploy.sh
```

---

## 4. Only backend `.env` changed

```bash
sudo systemctl restart ani-backend
journalctl -u ani-backend -n 50 --no-pager
```

No frontend rebuild unless you also changed `REACT_APP_*` / `.env.production`.

---

## 5. Only frontend env / `REACT_APP_*` changed

```bash
cd /opt/ani-stock/stockdashboard
# Edit .env.production (or your production env file) as needed
nano .env.production

npm ci && npm run build
sudo rsync -av --delete build/ /var/www/ani-stock/
sudo nginx -t && sudo systemctl reload nginx
```

Backend restart is only needed if API URLs or server-side behavior changed.

---

## Summary

| Piece | What to run on VPS |
|--------|---------------------|
| **Backend** | `sudo systemctl restart ani-backend` |
| **Frontend** | `npm run build` in the app repo, then `sudo rsync -av --delete build/ /var/www/ani-stock/` |
| **Nginx** | `sudo nginx -t && sudo systemctl reload nginx` |

---

## Troubleshooting: `ModuleNotFoundError: No module named 'httpx'`

`app/api/forex.py` uses **`httpx`**. After `git pull`, install deps into the **same venv** systemd uses, then restart:

```bash
cd /opt/ani-stock/backend_stockdashboard
# Monorepo: cd /opt/ani-stock/stockdashboard/backend_stockdashboard

source .venv/bin/activate
pip install -r requirements.txt
# Or one-off:  pip install "httpx>=0.27.0"
deactivate

sudo systemctl restart ani-backend
journalctl -u ani-backend -n 40 --no-pager
```

Ensure **`requirements.txt`** in the repo lists `httpx` so future deploys install it.

---

## Troubleshooting: `NameError: SystemAdminDep` on backend import

If **`journalctl -u ani-backend`** shows **`SystemAdminDep` is not defined** in **`app/api/system.py`**, the server copy is behind **`main`**. Pull and restart:

```bash
cd /opt/ani-stock/backend_stockdashboard
git pull origin main
sudo systemctl restart ani-backend
journalctl -u ani-backend -n 40 --no-pager
```

---

## Troubleshooting: systemd stop timeout / SIGKILL during bootstrap

With **`STARTUP_BOOTSTRAP_BEFORE_ORCHESTRATOR=true`**, startup can run a **long** full sync. If **`systemctl stop/restart ani-backend`** hits **`State 'stop-sigterm' timed out`** and **SIGKILL**, raise the unit’s stop timeout (e.g. **10 minutes**):

```bash
sudo systemctl edit ani-backend
```

In the override, add:

```ini
[Service]
TimeoutStopSec=600
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl restart ani-backend
```

**Note:** With **`uvicorn --workers 2`** (or more), each worker used to run startup bootstrap in parallel. The backend now uses a **file lock** (default **`/tmp/ani_backend_startup_bootstrap.lock`**, override with **`STARTUP_BOOTSTRAP_LOCK_PATH`**) so **only one worker** runs the blocking bootstrap; others wait and skip. Prefer **`workers=1`** if you want the simplest behavior.

---

## Troubleshooting: **502 Bad Gateway** on login / API calls

**Meaning:** Nginx received the request but **could not get a valid response from the FastAPI backend** (nothing listening on the upstream, process crashed, or still starting after restart).

**On the VPS, check:**

```bash
sudo systemctl status ani-backend --no-pager
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8000/api/system/status
journalctl -u ani-backend -n 80 --no-pager
```

- If **`ani-backend` is failed/inactive** or **`curl` is not 200**: fix the backend (see **`SystemAdminDep`** pull above, Python/venv errors, or wait if bootstrap is still running).
- Confirm Nginx **`proxy_pass`** points to the same host/port as Uvicorn (often **`http://127.0.0.1:8000`**).

After the backend is healthy, **`curl`** to **`127.0.0.1:8000`** should succeed and the site login should work.

---

**Docker:** If you use containers instead, see the sibling repo **`stockdashboard-docker/`** and **[deploy/README.md](../../deploy/README.md)**.

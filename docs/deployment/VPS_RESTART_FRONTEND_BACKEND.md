# VPS: restart frontend + backend

Use this whenever you need to **restart** or **redeploy** on the VPS (systemd + Nginx + static React build).
For first-time install, see **[VPS_INSTALL_RUN_AYCINDUSTRIES.md](VPS_INSTALL_RUN_AYCINDUSTRIES.md)**.

If the UI loads but **FII/DII, screens, or other API data is empty**, see **[VPS_ENABLEMENT_CHECKLIST.md](VPS_ENABLEMENT_CHECKLIST.md)** (two-repo deploy, `REACT_APP_API_URL`, Nginx, DB, Trendlyne).

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

## 2b. “Clean slate”: stop Nginx + backend, free port **8000**, start again

Use when **`curl http://127.0.0.1:8000/...` fails** with **connection refused** and you want to **tear down and bring everything back** in order.

**Order:** stop **Nginx** first (so nothing keeps hitting a dead upstream), then **ani-backend**, clear **stuck** listeners on **8000** if needed, then start **ani-backend**, verify **curl**, then start **Nginx**.

```bash
# 1) Stop edge + API
sudo systemctl stop nginx
sudo systemctl stop ani-backend

# 2) Confirm nothing listens on 8000 (optional)
sudo ss -tlnp | grep ':8000' || echo "port 8000 free"

# 3) If something STILL holds 8000 after stop (zombie / manual uvicorn), clear it (Linux)
#    Only run if ss shows a process on 8000:
# sudo fuser -k 8000/tcp

# 4) Clear failed state and start API
sudo systemctl reset-failed ani-backend 2>/dev/null || true
sudo systemctl start ani-backend

# 5) Wait for Uvicorn (long bootstrap can delay readiness — wait up to a few minutes)
sleep 5
sudo systemctl status ani-backend --no-pager -l

# 6) Local API check (expect HTTP 200 when healthy)
curl -sS -o /dev/null -w "HTTP %{http_code}\n" --max-time 60 http://127.0.0.1:8000/api/system/status

# 7) Bring Nginx back
sudo nginx -t && sudo systemctl start nginx
sudo systemctl status nginx --no-pager
```

**If step 6 is not 200** (or connection still refused):

```bash
journalctl -u ani-backend -n 120 --no-pager
```

Fix errors (venv, **`.env`**, **`git pull`**), or temporarily set **`STARTUP_BOOTSTRAP_BEFORE_ORCHESTRATOR=false`** in **`/opt/ani-stock/backend_stockdashboard/.env`** for a faster bind, then **`sudo systemctl restart ani-backend`** again.

**Enable on boot** (once):

```bash
sudo systemctl enable ani-backend nginx
```

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

In the override, add **only** this (do **not** paste a full copy of the whole service file here):

```ini
[Service]
TimeoutStopSec=600
```

**How overrides work:** The file **`/etc/systemd/system/ani-backend.service.d/override.conf`** is **merged** with the main unit **`/etc/systemd/system/ani-backend.service`**. Lines you **comment with `#`** in the override are simply ignored — they do **not** turn off **`ExecStart`** or **`WorkingDirectory`** from the main file. If you pasted a full service template and commented it all out, that’s only clutter; **`ExecStart`** still comes from the **main** unit. Keep the override minimal (e.g. only **`TimeoutStopSec`**) to avoid confusion.

Verify the **effective** config:

```bash
systemctl cat ani-backend
```

You should still see **`ExecStart=...uvicorn... --port 8000`** from the base unit plus **`TimeoutStopSec=600`** from the drop-in.

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl restart ani-backend
```

**Note (multi-worker + bootstrap):** With **`--workers 2`**, Uvicorn will not accept HTTP until **every** worker finishes the ASGI **startup** handler. The backend therefore runs full bootstrap on an **elected leader** in a **background thread** (non-blocking startup) and uses a **flock** on **`/tmp/ani_backend_startup_bootstrap.lock`** so only one process runs the sync. Follower workers skip bootstrap and start the orchestrator immediately. **`curl http://127.0.0.1:8000`** should work **seconds** after restart; data may still be catching up while bootstrap runs. Prefer **`workers=1`** if you want a single-process setup.

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

## Troubleshooting: `curl: (7) Failed to connect to 127.0.0.1 port 8000`

**Meaning:** Nothing is listening on **`127.0.0.1:8000`** — usually **`ani-backend` is not `active (running)`**, or systemd points at a **wrong path** (venv/app), or the process **crashes on import** before binding.

**Historical note (fixed in backend `main.py`):** Uvicorn will not accept TCP until **every** worker finishes ASGI startup. Blockers were: (1) long bootstrap / blocking **`flock`** — fixed with a **background** bootstrap thread + non-blocking election; (2) **`start_orchestrator()`** on the **follower** — `orchestrator.start()` runs heavy initial work and was blocking that worker’s startup — fixed by starting the orchestrator in a **background thread** on the follower (and when **`STARTUP_BOOTSTRAP_BEFORE_ORCHESTRATOR=false`**). **`git pull`** **`backend_stockdashboard`** if **`curl`** still refuses while **`systemctl` is `active (running)`**.

### A. Run these in order (copy/paste on the VPS)

```bash
# 1) Is the unit supposed to be running?
sudo systemctl is-active ani-backend
sudo systemctl status ani-backend --no-pager -l

# 2) Why did it stop? (last 150 lines)
sudo journalctl -u ani-backend -n 150 --no-pager

# 3) Does systemd point at paths that exist? (monorepo vs /opt/ani-stock/backend_stockdashboard)
systemctl show ani-backend -p FragmentPath -p WorkingDirectory -p ExecStart --no-pager
```

From **`ExecStart`**, confirm:

- The **`uvicorn`** binary exists, e.g.  
  `test -x /opt/ani-stock/backend_stockdashboard/.venv/bin/uvicorn && echo OK`
- **`WorkingDirectory`** (if set) is the folder that contains **`app/`** (same place you run `git pull`).

If the unit references **`/opt/ani-stock/stockdashboard/backend_stockdashboard`** but you only deploy to **`/opt/ani-stock/backend_stockdashboard`**, fix the unit (or add a symlink / align deploy path), then:

```bash
sudo systemctl daemon-reload
sudo systemctl reset-failed ani-backend   # if state is "failed"
sudo systemctl restart ani-backend
```

### B. Confirm nothing is bound to 8000

```bash
sudo ss -tlnp | grep 8000 || echo "nothing listening on 8000"
```

If this prints **nothing** while **`systemctl` says `running`**, check **`journalctl`** — the main process may be restarting in a loop.

### C. Test the app import manually (same venv as systemd)

```bash
cd /opt/ani-stock/backend_stockdashboard   # or your WorkingDirectory from step A
source .venv/bin/activate
python -c "import app.main; print('import OK')"
deactivate
```

If this **fails**, fix the Python error (missing package → **`pip install -r requirements.txt`**, bad code → **`git pull`**, etc.) before relying on systemd.

### D. Optional: run Uvicorn in the foreground (see errors immediately)

```bash
cd /opt/ani-stock/backend_stockdashboard
source .venv/bin/activate
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
# Ctrl+C when done; use systemd for production
```

### E. Match **`curl`** to the unit

```bash
systemctl cat ani-backend
```

Use the **same** **`--host`** and **`--port`** as **`ExecStart`** (e.g. if **`--port 8001`**, curl **`8001`**).

### F. If bootstrap blocks binding for too long

For faster **“API up”** after deploy, you can temporarily set in **`/opt/ani-stock/backend_stockdashboard/.env`**:

```env
STARTUP_BOOTSTRAP_BEFORE_ORCHESTRATOR=false
```

Then **`sudo systemctl restart ani-backend`** — startup is lighter (stale data possible until jobs run). Re-enable **`true`** when the server can afford a full sync.

---

**Docker:** If you use containers instead, see the sibling repo **`stockdashboard-docker/`** and **[deploy/README.md](../../deploy/README.md)**.

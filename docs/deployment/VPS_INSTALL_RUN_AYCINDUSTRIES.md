# Install & run on VPS — **aycindustries.com**

End state:

| Item | Value |
|------|--------|
| **Site** | https://www.aycindustries.com (apex redirects to www) |
| **API** | https://www.aycindustries.com/api/... |
| **Static files** | `/var/www/ani-stock` |
| **App source** | `/opt/ani-stock/stockdashboard` + `/opt/ani-stock/backend_stockdashboard` |
| **Backend process** | `systemd` unit `ani-backend` → Uvicorn `127.0.0.1:8000` |
| **Database** | PostgreSQL `stockdb` on localhost |

**DNS (Hostinger / registrar):**

- `A` **aycindustries.com** → your VPS public IPv4  
- `A` **www.aycindustries.com** → same IP  

**How to connect to the VPS (SSH vs Hostinger API):** see **[hostinger-api-and-vps-access.md](hostinger-api-and-vps-access.md)** — API is for automation; use **SSH** for shell access and Cursor.

**Email OTP:** create mailbox **`support@aycindustries.com`** in Hostinger and set backend **`SMTP_USER`**, **`SMTP_FROM_EMAIL`**, and **`SMTP_PASSWORD`** (see `backend_stockdashboard/.env.production.example`).

---

## Git clone on the VPS (get the code)

SSH into the server, then choose **one** layout.

### Monorepo (frontend + backend in one repo)

This project’s frontend repo includes **`backend_stockdashboard/`** under `stockdashboard`:

```bash
sudo mkdir -p /opt/ani-stock
sudo chown -R "$USER:$USER" /opt/ani-stock
cd /opt/ani-stock
git clone https://github.com/Ayc120714/ANIStockDashboard.git stockdashboard
```

Backend path on disk: **`/opt/ani-stock/stockdashboard/backend_stockdashboard`**.  
Adjust **`vps_bootstrap.sh`**, systemd `WorkingDirectory`, and **`scripts/deploy.sh`** env vars to that path (see **Option B** below).

### Two separate Git repositories

If backend is its own remote:

```bash
sudo mkdir -p /opt/ani-stock
sudo chown -R "$USER:$USER" /opt/ani-stock
cd /opt/ani-stock
git clone https://github.com/Ayc120714/ANIStockDashboard.git stockdashboard
git clone https://github.com/YOUR_ORG/backend_stockdashboard.git backend_stockdashboard
```

Replace `YOUR_ORG/backend_stockdashboard.git` with your real backend URL.  
Then use **Option A** bootstrap as-is (`FRONTEND_REPO` / `BACKEND_REPO`).

### SSH deploy key (optional)

If the repo is private:

```bash
ssh-keygen -t ed25519 -C "vps-deploy" -f ~/.ssh/id_ed25519_deploy -N ""
cat ~/.ssh/id_ed25519_deploy.pub
```

Add the public key as a **Deploy key** (read-only) or to your GitHub account, then clone with SSH:

```bash
git clone git@github.com:Ayc120714/ANIStockDashboard.git stockdashboard
```

### GitHub: `Password authentication is not supported` / `Invalid username or token`

**Important:** The password you use to log in at **github.com** in a browser is **not** accepted for `git clone` over HTTPS. That is expected. “Proper login” for Git on the server means **either** a **Personal Access Token (PAT)** **or** **SSH keys** — never your normal account password.

---

#### Path 1 — Recommended: **no second repo** (monorepo)

You already have **`/opt/ani-stock/stockdashboard`**. The **`ANIStockDashboard`** repo includes **`backend_stockdashboard/`** inside it.

```bash
cd /opt/ani-stock/stockdashboard
git pull origin main
ls -la backend_stockdashboard/requirements.txt
```

If that file exists, **stop** trying to clone `backend_stockdashboard` separately. Use this backend path everywhere:

**`/opt/ani-stock/stockdashboard/backend_stockdashboard`**

```bash
cd /opt/ani-stock
rm -rf backend_stockdashboard   # remove wrong/duplicate clone attempts
```

Then configure systemd `WorkingDirectory` + `EnvironmentFile` and `BACKEND_DIR` in `deploy.sh` to **`.../stockdashboard/backend_stockdashboard`** (see **Option B**).

---

#### Path 2 — You really need `Ayc120714/backend_stockdashboard` as its own clone

##### A) HTTPS + **Personal Access Token** (not your password)

1. Log in to GitHub in the browser (account that **owns** or can **read** that repo).
2. Open **[github.com/settings/tokens](https://github.com/settings/tokens)** → **Generate new token**.
3. Prefer **Generate new token (classic)** → enable scope **`repo`** (full control of private repositories).  
   - If you use **fine-grained** tokens instead: grant **Contents: Read-only** for repository **`backend_stockdashboard`**.
4. Copy the token once (starts with **`ghp_`** classic, or **`github_pat_`** fine-grained).

On the VPS:

```bash
cd /opt/ani-stock
rm -rf backend_stockdashboard
git clone https://github.com/Ayc120714/backend_stockdashboard.git backend_stockdashboard
```

When Git asks:

| Prompt | What to enter |
|--------|----------------|
| `Username` | **`Ayc120714`** (GitHub **username**, not email) |
| `Password` | Paste the **token only** — the whole `ghp_...` or `github_pat_...` string |

**Still “Invalid username or token”?** Check:

- You pasted the **token**, not your GitHub/email password.
- No **space** before/after the token when pasting.
- Token is **not expired** and wasn’t revoked.
- Repo **`Ayc120714/backend_stockdashboard`** exists and your user can see it in the browser (if it’s **private**, the token must have **`repo`** or fine-grained access to **that** repo).
- Organization repo: token may need **SSO Authorize** (GitHub → token settings → Configure SSO → Authorize).

**One-shot clone (token in URL — avoid if others can read your screen/history):**

```bash
git clone "https://Ayc120714:YOUR_TOKEN_HERE@github.com/Ayc120714/backend_stockdashboard.git" backend_stockdashboard
```

##### B) SSH (no PAT in prompts; good for servers)

```bash
ssh-keygen -t ed25519 -C "vps-ani-stock" -f ~/.ssh/id_ed25519_github -N ""
cat ~/.ssh/id_ed25519_github.pub
```

- **Repo deploy key:** GitHub → **`backend_stockdashboard`** → **Settings → Deploy keys → Add deploy key** → paste public key → allow read access.  
  **or**
- **Account key:** **Settings → SSH and GPG keys → New SSH key** → paste public key.

Then:

```bash
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519_github
ssh -o StrictHostKeyChecking=accept-new -T git@github.com
# Expect: "Hi Ayc120714! You've successfully authenticated..."
git clone git@github.com:Ayc120714/backend_stockdashboard.git backend_stockdashboard
```

Optional **`~/.ssh/config`**:

```ssh-config
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_github
```

---

## Option A — Automated bootstrap (two separate Git repos)

On the VPS (Ubuntu 22.04/24.04), as a user with `sudo`:

```bash
cd /tmp   # or clone one repo first to get the script
# If you already have stockdashboard cloned:
cd /opt/ani-stock/stockdashboard  # adjust path

export FRONTEND_REPO="https://github.com/Ayc120714/ANIStockDashboard.git"
export BACKEND_REPO="https://github.com/Ayc120714/backend_stockdashboard.git"
chmod +x docs/deployment/vps_bootstrap.sh
bash docs/deployment/vps_bootstrap.sh
```

The script installs packages, clones under **`/opt/ani-stock`**, creates DB user **`stockapp`** (password placeholder), builds the frontend to **`/var/www/ani-stock`**, installs **`ani-backend`**, and enables Nginx with the **HTTP-only** site so `nginx -t` works **before** SSL exists.

### After bootstrap — required edits

1. **PostgreSQL password** (if you did not change the bootstrap default):

```bash
sudo -u postgres psql -c "ALTER USER stockapp WITH PASSWORD 'YOUR_STRONG_PASSWORD';"
```

2. **Backend** — `/opt/ani-stock/backend_stockdashboard/.env`

```env
DATABASE_URL=postgresql+psycopg2://stockapp:YOUR_STRONG_PASSWORD@127.0.0.1:5432/stockdb
```

Copy and edit the template:

```bash
cp /opt/ani-stock/backend_stockdashboard/.env.production.example /opt/ani-stock/backend_stockdashboard/.env
nano /opt/ani-stock/backend_stockdashboard/.env
```

Set **`SMTP_USER`**, **`SMTP_FROM_EMAIL`** = `support@aycindustries.com`, **`SMTP_PASSWORD`** = Hostinger mailbox password, plus Samco/Dhan/JWT secrets.

3. **Frontend build env** — `/opt/ani-stock/stockdashboard/.env.production`  
   (Should already match site; confirm:)

```env
REACT_APP_API_URL=https://www.aycindustries.com/api
REACT_APP_TRADE_API_URL=https://www.aycindustries.com/api
REACT_APP_ADMIN_EMAILS=support@aycindustries.com
```

Rebuild if you changed it:

```bash
cd /opt/ani-stock/stockdashboard
npm ci && npm run build
sudo rsync -av --delete build/ /var/www/ani-stock/
```

4. **Restart backend**

```bash
sudo systemctl restart ani-backend
journalctl -u ani-backend -n 50 --no-pager
```

5. **SSL (Let’s Encrypt)**

```bash
sudo certbot --nginx -d aycindustries.com -d www.aycindustries.com
sudo certbot renew --dry-run
```

Certbot updates the Nginx vhost. Optionally merge hardening from **`nginx-aycindustries.com.conf`** if you want the same headers as the template.

6. **Reload Nginx**

```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## Option B — Monorepo (backend inside `stockdashboard/`)

If the backend lives at **`/opt/ani-stock/stockdashboard/backend_stockdashboard`** (recommended — avoids a second GitHub clone):

1. **One clone only:**

```bash
cd /opt/ani-stock
rm -rf backend_stockdashboard
git clone https://github.com/Ayc120714/ANIStockDashboard.git stockdashboard
```

(If `stockdashboard` already exists: `cd stockdashboard && git pull`.)

2. **systemd** — set paths to the **nested** backend (edit user if not `root`):

```ini
WorkingDirectory=/opt/ani-stock/stockdashboard/backend_stockdashboard
EnvironmentFile=/opt/ani-stock/stockdashboard/backend_stockdashboard/.env
ExecStart=/opt/ani-stock/stockdashboard/backend_stockdashboard/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2
```

Then: `sudo systemctl daemon-reload && sudo systemctl restart ani-backend`

3. **Deploy script** env when updating:

```bash
export APP_DIR=/opt/ani-stock/stockdashboard
export BACKEND_DIR=/opt/ani-stock/stockdashboard/backend_stockdashboard
```

More detail: **[vps-linux-fullstack-setup.md](vps-linux-fullstack-setup.md)**.

---

## Verify

```bash
curl -sS http://127.0.0.1:8000/
curl -sS http://127.0.0.1:8000/api/system/status
curl -sSI https://www.aycindustries.com
curl -sS https://www.aycindustries.com/api/system/status
```

In a browser:

- https://www.aycindustries.com  
- Login / OTP if enabled  
- Routes like **`/callback`** and **`/dhan-callback`** (SPA fallback)

---

## Updates after code changes

From **`/opt/ani-stock/stockdashboard`** (adjust `BACKEND_DIR` if monorepo):

```bash
export APP_DIR=/opt/ani-stock/stockdashboard
export BACKEND_DIR=/opt/ani-stock/backend_stockdashboard
export BACKEND_SERVICE=ani-backend
chmod +x scripts/deploy.sh scripts/post-deploy-check.sh
./scripts/deploy.sh
```

Or manually: `git pull`, backend `pip install`, `npm ci && npm run build`, `rsync` to `/var/www/ani-stock`, `systemctl restart ani-backend`, `reload nginx`.

---

## Rollback

```bash
cd /opt/ani-stock/stockdashboard
chmod +x docs/deployment/rollback_vps.sh
./docs/deployment/rollback_vps.sh <backend_git_commit_sha>
```

Requires a previous frontend backup at **`/var/www/ani-stock-prev`** (create before risky deploys: `sudo cp -a /var/www/ani-stock /var/www/ani-stock-prev`).

---

## Reference files in this repo

| File | Purpose |
|------|--------|
| [VPS_RESTART_FRONTEND_BACKEND.md](VPS_RESTART_FRONTEND_BACKEND.md) | Restart / redeploy backend + static frontend anytime |
| [VPS_DATA_STALENESS.md](VPS_DATA_STALENESS.md) | Empty FII/DII, Trending, AI Picks — API & DB checks on VPS |
| [hostinger-vps-architecture.md](hostinger-vps-architecture.md) | Topology + DNS |
| [vps_bootstrap.sh](vps_bootstrap.sh) | First-time install |
| [nginx-aycindustries.com.http-bootstrap.conf](nginx-aycindustries.com.http-bootstrap.conf) | Nginx before SSL |
| [nginx-aycindustries.com.conf](nginx-aycindustries.com.conf) | Full HTTPS template (after certs) |
| [rollback_vps.sh](rollback_vps.sh) | Backend commit + static rollback |
| [.env.production.example](../../.env.production.example) | Frontend production URLs |

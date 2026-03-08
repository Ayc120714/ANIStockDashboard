# VPS Runbook (Hostinger) - ANI Stock App

This runbook assumes:

- Ubuntu 22.04/24.04 VPS
- Domain: `aycindustries.com`
- App root: `/opt/ani-stock`
- Backend listens on `127.0.0.1:8000`
- Nginx handles HTTPS and reverse proxy

## 1) Initial server prep

```bash
sudo apt update && sudo apt -y upgrade
sudo timedatectl set-timezone Asia/Kolkata
sudo adduser deploy
sudo usermod -aG sudo deploy
```

Copy your SSH key to the new user, then reconnect as `deploy`.

## 2) Install system dependencies

```bash
sudo apt install -y git curl nginx postgresql postgresql-contrib python3 python3-venv python3-pip ufw certbot python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
python3 --version
psql --version
```

## 3) Firewall baseline

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
sudo ufw status
```

## 4) Clone project(s)

```bash
sudo mkdir -p /opt/ani-stock
sudo chown -R deploy:deploy /opt/ani-stock
cd /opt/ani-stock
git clone <FRONTEND_REPO_URL> stockdashboard
git clone <BACKEND_REPO_URL> backend_stockdashboard
```

If both folders are in one monorepo, clone once and keep current structure.

## 5) PostgreSQL setup

```bash
sudo -u postgres psql
```

Run inside `psql`:

```sql
CREATE DATABASE stockdb;
CREATE USER stockapp WITH ENCRYPTED PASSWORD 'CHANGE_ME_STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE stockdb TO stockapp;
\q
```

## 6) Backend setup

```bash
cd /opt/ani-stock/backend_stockdashboard
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
cp .env.production.example .env
```

Edit `.env` and set all required secrets and provider credentials.

Minimum production values:

- `DATABASE_URL=postgresql+psycopg2://stockapp:<password>@127.0.0.1:5432/stockdb`
- auth/token secrets
- Dhan and Samco credentials
- SMTP (if OTP via email is enabled)

Quick API check:

```bash
source /opt/ani-stock/backend_stockdashboard/.venv/bin/activate
cd /opt/ani-stock/backend_stockdashboard
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Stop after confirming startup logs.

## 7) Backend as a systemd service

Create service file:

```bash
sudo tee /etc/systemd/system/ani-backend.service > /dev/null <<'EOF'
[Unit]
Description=ANI Stock FastAPI backend
After=network.target postgresql.service

[Service]
User=deploy
Group=deploy
WorkingDirectory=/opt/ani-stock/backend_stockdashboard
EnvironmentFile=/opt/ani-stock/backend_stockdashboard/.env
ExecStart=/opt/ani-stock/backend_stockdashboard/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always
RestartSec=5
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
EOF
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable ani-backend
sudo systemctl start ani-backend
sudo systemctl status ani-backend --no-pager
journalctl -u ani-backend -n 100 --no-pager
```

## 8) Frontend build/deploy

```bash
cd /opt/ani-stock/stockdashboard
cp .env.production.example .env.production
```

Update `.env.production`:

- `REACT_APP_API_URL=https://aycindustries.com/api`
- `REACT_APP_TRADE_API_URL=https://aycindustries.com/api`

Build:

```bash
npm ci
npm run build
```

Publish build to web root:

```bash
sudo mkdir -p /var/www/ani-stock
sudo rsync -av --delete /opt/ani-stock/stockdashboard/build/ /var/www/ani-stock/
```

## 9) Nginx site setup

Copy deployment config from `docs/deployment/nginx-aycindustries.com.conf` to VPS:

```bash
sudo cp /opt/ani-stock/stockdashboard/docs/deployment/nginx-aycindustries.com.conf /etc/nginx/sites-available/aycindustries.com
sudo ln -s /etc/nginx/sites-available/aycindustries.com /etc/nginx/sites-enabled/aycindustries.com
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

## 10) SSL certificate

```bash
sudo certbot --nginx -d aycindustries.com -d www.aycindustries.com
sudo certbot renew --dry-run
```

## 11) Post-deploy verification

```bash
curl -I https://aycindustries.com
curl -sS https://aycindustries.com/api/health || true
curl -sS https://aycindustries.com/api/dhan/health || true
```

Then validate in browser:

- Login + OTP flow
- `/callback` and `/dhan-callback`
- Dashboard/Market/Sector pages

## 12) Update deploy procedure (repeatable)

```bash
cd /opt/ani-stock/stockdashboard && git pull && npm ci && npm run build && sudo rsync -av --delete build/ /var/www/ani-stock/
cd /opt/ani-stock/backend_stockdashboard && git pull && source .venv/bin/activate && pip install -r requirements.txt
sudo systemctl restart ani-backend
sudo systemctl reload nginx
```


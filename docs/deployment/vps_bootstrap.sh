#!/usr/bin/env bash
set -euo pipefail

# One-time VPS bootstrap for ANI Stock app.
# Run on a fresh Ubuntu VPS as a sudo-enabled user.

APP_ROOT="${APP_ROOT:-/opt/ani-stock}"
FRONTEND_REPO="${FRONTEND_REPO:-}"
BACKEND_REPO="${BACKEND_REPO:-}"

if [[ -z "$FRONTEND_REPO" || -z "$BACKEND_REPO" ]]; then
  echo "Set FRONTEND_REPO and BACKEND_REPO before running."
  echo "Example:"
  echo "  FRONTEND_REPO=https://github.com/org/stockdashboard.git \\"
  echo "  BACKEND_REPO=https://github.com/org/backend_stockdashboard.git \\"
  echo "  bash docs/deployment/vps_bootstrap.sh"
  exit 1
fi

echo "[1/9] Installing system packages..."
sudo apt update && sudo apt -y upgrade
sudo apt install -y git curl nginx postgresql postgresql-contrib python3 python3-venv python3-pip ufw certbot python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

echo "[2/9] Configuring firewall..."
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

echo "[3/9] Cloning repositories..."
sudo mkdir -p "$APP_ROOT"
sudo chown -R "$USER:$USER" "$APP_ROOT"
cd "$APP_ROOT"
[[ -d stockdashboard ]] || git clone "$FRONTEND_REPO" stockdashboard
[[ -d backend_stockdashboard ]] || git clone "$BACKEND_REPO" backend_stockdashboard

echo "[4/9] Preparing PostgreSQL..."
sudo -u postgres createdb stockdb || true
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='stockapp'" | grep -q 1 || sudo -u postgres psql -c "CREATE USER stockapp WITH ENCRYPTED PASSWORD 'CHANGE_ME_STRONG_PASSWORD';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE stockdb TO stockapp;"

echo "[5/9] Setting up backend virtualenv and dependencies..."
cd "$APP_ROOT/backend_stockdashboard"
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
if [[ ! -f requirements.txt ]]; then
  echo "ERROR: requirements.txt missing in backend_stockdashboard"
  exit 1
fi
pip install -r requirements.txt
[[ -f .env ]] || cp .env.production.example .env || true

echo "[6/9] Setting up frontend and build..."
cd "$APP_ROOT/stockdashboard"
[[ -f .env.production ]] || cp .env.production.example .env.production
npm ci
npm run build
sudo mkdir -p /var/www/ani-stock
sudo rsync -av --delete build/ /var/www/ani-stock/

echo "[7/9] Installing backend systemd service..."
sudo tee /etc/systemd/system/ani-backend.service > /dev/null <<EOF
[Unit]
Description=ANI Stock FastAPI backend
After=network.target postgresql.service

[Service]
User=$USER
Group=$USER
WorkingDirectory=$APP_ROOT/backend_stockdashboard
EnvironmentFile=$APP_ROOT/backend_stockdashboard/.env
ExecStart=$APP_ROOT/backend_stockdashboard/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable ani-backend
sudo systemctl restart ani-backend

echo "[8/9] Configuring Nginx (HTTP first — SSL after certbot)..."
sudo cp "$APP_ROOT/stockdashboard/docs/deployment/nginx-aycindustries.com.http-bootstrap.conf" /etc/nginx/sites-available/aycindustries.com
sudo ln -sf /etc/nginx/sites-available/aycindustries.com /etc/nginx/sites-enabled/aycindustries.com
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

echo "[9/9] Bootstrap done."
echo "Next: edit env files, restart backend, then SSL:"
echo "  nano $APP_ROOT/backend_stockdashboard/.env"
echo "  nano $APP_ROOT/stockdashboard/.env.production"
echo "  sudo systemctl restart ani-backend"
echo "  sudo certbot --nginx -d aycindustries.com -d www.aycindustries.com"
echo "Optional: compare with nginx-aycindustries.com.conf for extra TLS hardening."

# Go-Live, Monitoring, Backup, and Rollback Checklist

## A) Pre-launch validation (must pass)

- [ ] DNS `A` records for `aycindustries.com` and `www` point to VPS IP.
- [ ] SSL valid (`https://www.aycindustries.com` opens without warnings; apex redirects to www).
- [ ] Frontend build deployed to `/var/www/ani-stock`.
- [ ] Backend service is healthy: `systemctl status ani-backend`.
- [ ] Critical APIs respond from public domain (`/api/auth/*`, `/api/dhan/*`, `/api/watchlist/*`).
- [ ] Login flow verified: email -> OTP -> dashboard.
- [ ] Dhan callback verified: `/callback` and `/dhan-callback`.
- [ ] Dashboard data pages show real non-empty values (dashboard/market/sector).
- [ ] CORS/token behavior works from production domain only.
- [ ] `.env` files contain production secrets and are not committed.

## B) Security and stability baseline

- [ ] UFW enabled with only `22`, `80`, `443`.
- [ ] PostgreSQL bound to localhost only (no public DB access).
- [ ] Strong secrets set for auth/token/env.
- [ ] `AUTH_DEBUG_OTP=false` in production.
- [ ] Nginx config test passed (`nginx -t`) before reload.
- [ ] Automatic restart enabled for backend (`systemd`).

## C) Monitoring and logs

- [ ] Enable and inspect logs:
  - `journalctl -u ani-backend -f`
  - `sudo tail -f /var/log/nginx/access.log /var/log/nginx/error.log`
- [ ] Add simple uptime checks (external monitor) for:
  - `https://www.aycindustries.com`
  - `https://www.aycindustries.com/api/health` (or equivalent ping endpoint)
- [ ] Set alerts for high CPU, RAM, disk, and repeated backend restarts.

## D) Backups

### 1. DB backup script

Create `/opt/ani-stock/scripts/backup_db.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/opt/ani-stock/backups"
TS="$(date +%F_%H-%M-%S)"
mkdir -p "$BACKUP_DIR"

export PGPASSWORD="CHANGE_ME_DB_PASSWORD"
pg_dump -h 127.0.0.1 -U stockapp -d stockdb -Fc > "$BACKUP_DIR/stockdb_${TS}.dump"

# Keep 14 days
find "$BACKUP_DIR" -type f -name "stockdb_*.dump" -mtime +14 -delete
```

```bash
chmod +x /opt/ani-stock/scripts/backup_db.sh
```

### 2. Nightly backup cron

```bash
crontab -e
```

Add:

```cron
15 2 * * * /opt/ani-stock/scripts/backup_db.sh >> /opt/ani-stock/backups/backup.log 2>&1
```

### 3. Restore drill (weekly)

```bash
export PGPASSWORD="CHANGE_ME_DB_PASSWORD"
createdb -h 127.0.0.1 -U stockapp stockdb_restore_test
pg_restore -h 127.0.0.1 -U stockapp -d stockdb_restore_test /opt/ani-stock/backups/<latest>.dump
dropdb -h 127.0.0.1 -U stockapp stockdb_restore_test
```

## E) Rollback plan (deployment day)

### Frontend rollback

- Keep previous build snapshot before deploy:

```bash
sudo rsync -av /var/www/ani-stock/ /var/www/ani-stock-prev/
```

- If issue occurs:

```bash
sudo rsync -av --delete /var/www/ani-stock-prev/ /var/www/ani-stock/
sudo systemctl reload nginx
```

### Backend rollback

- Tag release before deploy:

```bash
cd /opt/ani-stock/backend_stockdashboard
git tag pre-release-$(date +%F-%H%M)
```

- Roll back to previous known commit:

```bash
cd /opt/ani-stock/backend_stockdashboard
git log --oneline -n 10
git checkout <last-known-good-commit>
source .venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart ani-backend
```

### DB rollback (only if required)

```bash
export PGPASSWORD="CHANGE_ME_DB_PASSWORD"
dropdb -h 127.0.0.1 -U stockapp stockdb
createdb -h 127.0.0.1 -U stockapp stockdb
pg_restore -h 127.0.0.1 -U stockapp -d stockdb /opt/ani-stock/backups/<selected>.dump
```

Use DB rollback only when data-level issues cannot be fixed forward.


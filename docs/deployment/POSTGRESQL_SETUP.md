# PostgreSQL setup for Stock Dashboard (backend)

The API uses SQLAlchemy with a **PostgreSQL** connection string by default (see `backend_stockdashboard/app/db/database.py`).

## 1. Connection string

Set on the VPS (systemd unit, `.env` next to the app, or export before `uvicorn`):

```bash
DATABASE_URL=postgresql+psycopg2://USER:PASSWORD@127.0.0.1:5432/DATABASE_NAME
```

- Replace `USER`, `PASSWORD`, `DATABASE_NAME`.
- The backend also accepts `SQLALCHEMY_DATABASE_URL` as an alias.

**Common mistake:** pointing `DATABASE_URL` at SQLite or leaving it unset while expecting `app_users` on Postgres. If the API starts but **Admin Users** stays empty, check:

1. The process actually loads the same `.env` you edited (`/opt/ani-stock/backend/.env` or wherever the service runs).
2. `echo $DATABASE_URL` inside the same user/systemd unit as the API.
3. Tables exist: `python -c "from app.db.database import engine; print(engine.url)"` on the server.

## 2. Install PostgreSQL (Ubuntu)

```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql
```

## 3. Create role and database

```bash
sudo -u postgres psql <<'SQL'
CREATE USER stockapp WITH PASSWORD 'choose_a_strong_password';
CREATE DATABASE stockdb OWNER stockapp;
GRANT ALL PRIVILEGES ON DATABASE stockdb TO stockapp;
SQL
```

For UUID or extensions you rarely need here; default `stockdb` is enough.

## 4. Network access

- **Production:** keep Postgres on `127.0.0.1` only; the API connects locally.
- Open **no** public port 5432 unless you use a VPN/firewall allowlist.

`postgresql.conf` / `pg_hba.conf`: ensure local socket or `127.0.0.1/32` auth for `stockapp`.

## 5. Python driver

The URL scheme `postgresql+psycopg2` requires **`psycopg2-binary`** (or `psycopg2`) in `requirements.txt`. Reinstall venv after changing DB stack:

```bash
cd /opt/ani-stock/backend   # adjust path
source .venv/bin/activate
pip install -r requirements.txt
```

## 6. Create tables / migrations

The app calls `Base.metadata.create_all(bind=engine)` on import. First successful connection to the correct URL creates core tables (`app_users`, `auth_sessions`, etc.).

If you previously ran against **SQLite** (`stockdashboard_trading.db`), that file is a **different** database — users there will not appear in Postgres until you migrate or recreate accounts.

## 7. Verify from the server

```bash
sudo -u postgres psql -d stockdb -c "\dt app_users"
curl -sS -H "Authorization: Bearer YOUR_ACCESS_TOKEN" https://www.aycindustries.com/api/auth/me
curl -sS -H "Authorization: Bearer YOUR_ACCESS_TOKEN" "https://www.aycindustries.com/api/auth/admin/users?include_inactive=true"
```

Super-admin list/create/delete APIs require the logged-in user’s email to match `AUTH_SUPER_ADMIN_EMAILS` (defaults: `gvc1990@gmail.com`, `admin@aycindustries.com`).

## 8. Env template (backend `.env`)

```env
DATABASE_URL=postgresql+psycopg2://stockapp:choose_a_strong_password@127.0.0.1:5432/stockdb
AUTH_SUPER_ADMIN_EMAILS=gvc1990@gmail.com,admin@aycindustries.com
```

Restart the API after any change:

```bash
sudo systemctl restart ani-stock-api   # or your unit name
```

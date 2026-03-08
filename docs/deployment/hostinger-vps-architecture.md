# Hostinger Deployment Architecture (ANI Stock App)

## Final Topology (Recommended)

- **Hosting provider:** Hostinger VPS (not Shared hPanel for backend runtime)
- **Primary domain:** `aycindustries.com`
- **Frontend (React static build):** served by Nginx at `https://aycindustries.com`
- **Backend API (FastAPI/Uvicorn):** served behind Nginx at `https://aycindustries.com/api/*`
- **Database:** PostgreSQL on the same VPS (or managed DB, optional later)
- **Process supervision:** `systemd` (backend), `cron` (backups), Nginx for web serving/reverse proxy

## Why Shared hPanel Alone Is Not Enough

This app needs long-running backend services and scheduler behavior that shared hosting does not reliably support:

- FastAPI app server process
- Background scheduler/orchestrator
- Broker callback and API integrations
- PostgreSQL runtime and backups

## DNS / Domain Mapping

- `A` record: `aycindustries.com` -> `<VPS_PUBLIC_IP>`
- `A` record: `www.aycindustries.com` -> `<VPS_PUBLIC_IP>`
- Optional API subdomain (if split later): `api.aycindustries.com` -> `<VPS_PUBLIC_IP>`

## Runtime Ports

- Public:
  - `80` (HTTP, redirect to HTTPS)
  - `443` (HTTPS)
- Private/internal:
  - `127.0.0.1:8000` FastAPI/Uvicorn
  - `5432` PostgreSQL (localhost only)

## Deployment Flow

1. Build React frontend (`npm run build`).
2. Nginx serves `build/` assets.
3. Nginx proxies `/api/*` to local backend (`127.0.0.1:8000`).
4. SSL termination at Nginx with Let's Encrypt.

## Callback Compatibility

Because frontend routes include `/callback` and `/dhan-callback`, Nginx SPA fallback must always route unknown non-API paths to `index.html`.


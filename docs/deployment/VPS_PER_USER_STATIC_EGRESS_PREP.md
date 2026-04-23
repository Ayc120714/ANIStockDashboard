# VPS preparation: per-user static egress (Setup 1)

This document lists what to **provision**, **install**, and **configure** on your VPS (and related infrastructure) so the platform can eventually route **each user’s broker API traffic** through a **distinct static public IPv4**, while the main app (Nginx + FastAPI + PostgreSQL) stays on the primary server.

**Code status:** Order placement today enforces a **single** outbound IP (`BROKER_REQUIRED_OUTBOUND_IP` in [`backend_stockdashboard/app/api/orders.py`](../../../backend_stockdashboard/app/api/orders.py)). Per-user proxy/egress fields and HTTP client changes are **not** implemented yet; use this guide for **ops readiness** and capacity planning.

---

## 1. What you must have before “one static IP per user” works

| Requirement | Why |
|-------------|-----|
| **One routable public IPv4 per concurrent user** (or per seat in your pool) | Brokers see the TCP source address of the HTTPS connection. A single VPS with **one** primary IPv4 can only present **one** stable egress unless you add more addresses or use external egress. |
| **Broker-side whitelist** | e.g. Dhan `setIP` / Samco IP registration — each **customer broker account** must list the IP(s) that will call the API for that account. |
| **Mapping user → egress endpoint** | Later: DB field(s) such as `egress_proxy_url` or `assigned_static_ip` + routing id; ops process to assign/revoke when users register or churn. |

**Important:** On typical Hostinger-style VPS plans you get **one** included public IPv4. True per-user static IPs usually means **extra paid IPs** from the provider, **separate small VMs** each with its own EIP, or a **commercial static proxy** product (pool of egress URLs). The main VPS can still host the API; egress nodes can be elsewhere.

---

## 2. Packages to install on the **main** VPS (Ubuntu/Debian)

These are in addition to what you already run per [VPS_ENABLEMENT_CHECKLIST.md](./VPS_ENABLEMENT_CHECKLIST.md) (Nginx, PostgreSQL, Python venv, `ani-backend`).

### 2a. Core networking and diagnostics (recommended)

```bash
sudo apt-get update
sudo apt-get install -y \
  curl \
  ca-certificates \
  dnsutils \
  iproute2 \
  iptables \
  nftables \
  net-tools \
  tcpdump
```

- **`iproute2`** — policy routing / multiple default routes if you attach **multiple public IPs** to this host.
- **`iptables` / `nftables`** — SNAT/mark routing if you split egress by source IP or cgroup (advanced).

### 2b. If egress is **HTTP CONNECT proxies** on this same host

Pick **one** family (do not stack duplicates without reason):

| Option | Typical use | Install |
|--------|-------------|---------|
| **3proxy** | Small, multiple listeners, per-listener auth → different upstream/bind | `sudo apt-get install -y 3proxy` (or build from upstream if not in your release) |
| **Squid** | Mature HTTP proxy, ACLs, multiple `tcp_outgoing_address` with ACLs | `sudo apt-get install -y squid` |
| **HAProxy** | If you terminate CONNECT and forward to fixed upstreams | `sudo apt-get install -y haproxy` |

You will run **one listener (or upstream chain) per static egress identity**, each configured so outbound TLS to `api.dhan.co` (and other broker hosts) uses the correct source IP or upstream proxy.

### 2c. If egress is **Docker sidecars** on this host

```bash
sudo apt-get install -y docker.io docker-compose-plugin
sudo systemctl enable --now docker
```

Useful when each container has a dedicated network namespace and you attach **different host routes** or **macvlan/ipvlan** to give distinct egress (requires extra addressing from your provider).

### 2d. If egress is **remote small VMs** (one static IP each) tunneling to the main VPS

On the **main** VPS (client side of tunnel):

```bash
sudo apt-get install -y wireguard-tools
```

On each **egress VM** (server side / exit node):

- Same: `wireguard-tools`, plus `iptables` for NAT if the tunnel only carries private traffic and the VM’s public IP is the broker-visible address.

---

## 3. What stays as today (no extra install for egress itself)

| Component | Role |
|-----------|------|
| **Nginx** | TLS for `www…`, reverse proxy `/api/` → Uvicorn |
| **PostgreSQL** | App data |
| **Python 3 + venv** | FastAPI (`ani-backend`) |
| **Uvicorn** (via systemd) | ASGI server |

Broker HTTPS from the backend currently uses the **host default route** unless you add proxies/routing as above.

---

## 4. Environment variables (current + future alignment)

Already relevant on the backend `.env` (see also [`backend.env.production.example`](./backend.env.production.example)):

| Variable | Purpose |
|----------|---------|
| `BROKER_REQUIRE_OUTBOUND_IP` | Set to `false` only temporarily while debugging; normally `true` for production safety. |
| `BROKER_REQUIRED_OUTBOUND_IP` | Expected **main** server public IPv4 when all orders share one egress (today’s model). |
| `DHAN_PRIMARY_IP` / `HOSTINGER_PUBLIC_IP` | Used for Dhan `setIP` alignment with whitelisted IP. |
| `DHAN_VERIFY_IP_BEFORE_ORDER` | Enforce IP check before placing orders. |

**Future** (when per-user egress is implemented): per-user `HTTPS_PROXY` or equivalent stored in DB, and per-request verification that traffic for user *U* left via *U*’s assigned path—not necessarily new VPS packages, but **new** systemd is rarely needed unless you run separate worker processes per pool.

---

## 5. Firewall and security checklist

- Allow **inbound** only what you need: `22` (SSH, ideally key-only + fail2ban), `80`/`443` (Nginx).
- **Proxy listeners** (if on this VPS): bind to `127.0.0.1` only so only local `ani-backend` can use them; use strong auth on each port if you must expose elsewhere (avoid public open proxies).
- **Outbound**: ensure broker API endpoints are reachable from each egress path (test with `curl --interface` or `curl -x` through each proxy).

---

## 6. Minimal “get ready” command block (main VPS)

```bash
sudo apt-get update
sudo apt-get install -y curl ca-certificates dnsutils iproute2 iptables nftables net-tools tcpdump wireguard-tools
# Optional: pick ONE proxy approach if proxies run on this host
# sudo apt-get install -y squid
# OR
# sudo apt-get install -y docker.io docker-compose-plugin && sudo systemctl enable --now docker
```

Then: **order additional public IPs** or **provision egress nodes / proxy SKUs**, document each seat’s IP in broker dashboards, and plan DB + app changes separately.

---

## 7. Related docs

- [VPS_ENABLEMENT_CHECKLIST.md](./VPS_ENABLEMENT_CHECKLIST.md) — baseline full stack.
- [hostinger-vps-architecture.md](./hostinger-vps-architecture.md) — topology overview.

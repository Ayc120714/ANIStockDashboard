# SMTP timeout / “Connection unexpectedly closed” on VPS

If Python/`smtplib` fails with **`TimeoutError`**, **`SMTPServerDisconnected`**, or hangs on connect to `smtp.hostinger.com`, the TCP session never completes. That is **not** a wrong password yet — it is usually **network**.

## 1. Quick checks (run on the VPS)

```bash
# DNS
getent hosts smtp.hostinger.com

# Can we reach 587? (should say "succeeded" quickly)
timeout 10 bash -c 'echo | openssl s_client -connect smtp.hostinger.com:465 -quiet 2>/dev/null | head -1' || true
nc -vz -w 5 smtp.hostinger.com 587
nc -vz -w 5 smtp.hostinger.com 465
```

- If **both** 587 and 465 **time out** or **fail**: your **VPS provider may block outbound SMTP**. Open a ticket: ask to **allow outbound TCP to ports 465 and 587** (or use an HTTP API mail provider: SendGrid, SES, Mailgun — requires app changes).
- If **465 works** but **587 does not**, use **SSL** in backend `.env` (see below).

## 2. Backend `.env` (Hostinger)

In **`backend_stockdashboard/.env`**:

```env
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USE_SSL=true
SMTP_USER=support@yourdomain.com
SMTP_PASSWORD=your_mailbox_password
SMTP_FROM_EMAIL=support@yourdomain.com
SMTP_TIMEOUT=45
```

Then:

```bash
sudo systemctl restart ani-backend
```

**587 + STARTTLS** (default in code):

```env
SMTP_PORT=587
SMTP_USE_SSL=false
```

## 3. Firewall on the VPS

Outbound SMTP is usually allowed. If you locked down egress:

```bash
sudo ufw status verbose
```

Ensure outbound is not restricted in a way that blocks 465/587.

## 4. IPv6 issues (rare)

If `smtp.hostinger.com` resolves to IPv6 and your route is broken, try forcing IPv4 only by using Hostinger’s documented host or an A-record IP (only if they publish one — prefer fixing IPv6 routing).

## Reference

- Example variables: **`backend_stockdashboard/.env.production.example`**
- Code: **`app/services/otp_delivery.py`** (`SMTP_USE_SSL`, `SMTP_TIMEOUT`, port 465)

---
name: weekly-research-email
description: >-
  AYC Stock Sunday 4 PM IST weekly research email operator. Builds high-conviction
  stock snapshots (Positive/Negative/Neutral one-liners), market/sector outlook table
  images, and weekly narrative. Sends to all approved users every Sunday. Use when
  changing weekly email rollout or verifying Sunday cron.
---

You are the **Weekly Research Email** operator for AYC Stock (`/opt/ani-stock/backend_stockdashboard`).

## Purpose

Deliver the **Sunday 16:00 IST** email to all registered approved users:
- Greeting + opening market paragraph
- **Market Outlook** / **Sector Analysis** — embedded table PNGs (hosted HTTPS URLs)
- **Weekly Market Narrative** — prose bullets
- **High Conviction Stock Snapshot** — one line per stock: `SYMBOL — Positive|Negative|Neutral: reason`

Data sources:
- High conviction: `get_latest_signals()` → bullish/bearish rows with entry/SL/T1
- AI research: `StockAnalysis` with `analysis_type="weekly_research"` (Saturday Freedom Research)
- Outlook tables: `app/services/outlook_table_snapshot.py` (Playwright PNG + public URL)

Implementation: `app/services/weekly_research_email.py`  
Scheduler: `weekly_research_email_sunday` — Sun 16:00 IST in `app/scheduler.py`

## Production env (all users)

```env
ENABLE_WEEKLY_RESEARCH_EMAIL=true
# Do NOT set WEEKLY_RESEARCH_EMAIL_TEST in production (limits send to one inbox)
WEEKLY_RESEARCH_INCLUDE_OUTLOOK_TABLES=true
WEEKLY_RESEARCH_PUBLIC_BASE=https://www.aycindustries.com
```

Recipients: all `AppUser` with `is_active`, `email_verified`, `approved_at` set, `registration_rejected=false`.

## Owner test only (optional)

```env
WEEKLY_RESEARCH_EMAIL_TEST=owner@example.com
```

When set, Sunday cron sends **only** to that address.

## On invoke

1. Run tests: `cd backend_stockdashboard && .venv/bin/pytest tests/test_weekly_research_email.py tests/test_weekly_outlook_embed.py tests/test_outlook_table_snapshot.py -q`
2. Preview: `GET /api/system/weekly-research-email/preview?use_llm=false`
3. Manual send (admin): `POST /api/system/weekly-research-email/send` with `{"use_llm": false}`
4. Restart after env changes: `systemctl restart ani-backend.service`

## Sunday cron

Automatic via `send_weekly_research_email_job()`. Manual:

```bash
cd /opt/ani-stock/backend_stockdashboard && set -a && source .env && set +a && \
  .venv/bin/python3 -c "from app.services.weekly_research_email import send_weekly_research_email_broadcast; print(send_weekly_research_email_broadcast())"
```

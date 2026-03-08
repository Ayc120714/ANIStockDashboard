# Environment Matrix (Production)

## Frontend (`stockdashboard/.env.production`)

| Variable | Required | Example | Purpose |
|---|---|---|---|
| `REACT_APP_API_URL` | Yes | `https://aycindustries.com/api` | Primary API base for app calls |
| `REACT_APP_TRADE_API_URL` | Yes | `https://aycindustries.com/api` | Trade API base (can be same as primary API) |
| `REACT_APP_ADMIN_EMAILS` | Optional | `admin@aycindustries.com` | Comma-separated admin emails for UI role checks |

## Backend (`backend_stockdashboard/.env`)

### Core runtime

| Variable | Required | Example | Purpose |
|---|---|---|---|
| `DATABASE_URL` | Yes | `postgresql+psycopg2://stockapp:<password>@127.0.0.1:5432/stockdb` | Main SQLAlchemy DB connection |
| `SQLALCHEMY_DATABASE_URL` | Optional | same as above | Alternate DB key for compatibility |
| `ENABLE_ORCHESTRATOR` | Recommended | `true` | Enable orchestration services |
| `BACKGROUND_REFRESH` | Optional | `false` | Enable extra background refresh |
| `DB_POOL_SIZE` | Optional | `20` | SQLAlchemy pool size |
| `DB_MAX_OVERFLOW` | Optional | `30` | SQLAlchemy overflow pool |
| `DB_POOL_RECYCLE` | Optional | `3600` | DB connection recycle seconds |

### Auth and session security

| Variable | Required | Example | Purpose |
|---|---|---|---|
| `TOKEN_HASH_SECRET` | Yes | `<long-random-secret>` | Token hashing/signing support |
| `AUTH_SESSION_SECRET` | Yes | `<long-random-secret>` | Session secret fallback |
| `API_OBFUSCATION_SECRET` | Yes | `<long-random-secret>` | Secondary security secret |
| `DHAN_TOKEN_SECRET` | Recommended | `<long-random-secret>` | Dhan auth token integrity |
| `AUTH_DEBUG_OTP` | No (prod=false) | `false` | OTP debug mode |
| `AUTH_PASSWORDLESS_ADMIN_ENABLED` | Optional | `true` | Passwordless admin flow toggle |
| `AUTH_PASSWORDLESS_ADMIN_EMAILS` | Optional | `admin@aycindustries.com` | Allowed passwordless admin emails |
| `LOGIN_LOCK_MINUTES` | Optional | `15` | Login lockout duration |
| `MAX_FAILED_LOGINS` | Optional | `5` | Failed login threshold |
| `PASSWORD_HASH_ITERATIONS` | Optional | `240000` | Password hashing rounds |
| `OTP_TTL_SECONDS` | Optional | `300` | OTP expiry |
| `OTP_RESEND_COOLDOWN_SECONDS` | Optional | `60` | OTP resend cooldown |
| `ACCESS_TOKEN_TTL_SECONDS` | Optional | `1800` | Access token TTL |
| `REFRESH_TOKEN_TTL_SECONDS` | Optional | `604800` | Refresh token TTL |

### Dhan integration

| Variable | Required | Example | Purpose |
|---|---|---|---|
| `DHAN_CLIENT_ID` | Yes | `<client-id>` | Dhan app client id |
| `DHAN_API_KEY` | Yes | `<api-key>` | Dhan API key |
| `DHAN_API_SECRET` | Yes | `<api-secret>` | Dhan API secret |
| `DHAN_ADMIN_CLIENT_ID` | Optional | `<admin-client-id>` | Admin-side client id override |
| `DHAN_LOGIN_BASE_URL` | Optional | `https://auth.dhan.co` | Dhan login host |

### Samco and market feeds

| Variable | Required (if Samco enabled) | Example | Purpose |
|---|---|---|---|
| `SAMCO_USER_ID` | Conditional | `<samco-user>` | Samco login |
| `SAMCO_PASSWORD` | Conditional | `<samco-password>` | Samco login password |
| `SAMCO_YOB` | Conditional | `1990` | Samco login YOB |
| `STRICT_SAMCO_FNO` | Optional | `true` | Strict F&O behavior |
| `SAMCO_WORKERS` | Optional | `6` | Worker count for fetches |
| `SAMCO_PARALLEL_WORKERS` | Optional | `5` | Parallel workers cap |
| `SAMCO_MIN_DELAY_SEC` | Optional | `0.3` | Global request delay |
| `SAMCO_GLOBAL_RPS` | Optional | `10` | Global API token bucket rate |
| `SIGNAL_SCAN_ENABLED` | Optional | `true` | Live signal scanner toggle |
| `SIGNAL_SCAN_INTERVAL` | Optional | `10` | Scan interval in minutes |
| `CANDLE_FULL_LOOKBACK_DAYS` | Optional | `1200` | Full history lookback |
| `CANDLE_INCR_LOOKBACK_DAYS` | Optional | `12` | Incremental lookback |
| `CANDLE_STOCK_DELAY` | Optional | `0.8` | Stock call pacing |
| `CANDLE_STOCK_DELAY_SECONDARY` | Optional | `0.15` | Secondary stock pacing |
| `CANDLE_INDEX_DELAY` | Optional | `0.5` | Index call pacing |
| `ALWAYS_FETCH` | Optional | `false` | Force fetch behavior |
| `DEBUG_LOGGING` | Optional | `false` | Verbose logs |
| `WS_WARMUP_CHECK_SEC` | Optional | `20` | WS warmup wait |
| `WS_NO_TICK_FAILOVER_SEC` | Optional | `120` | WS failover threshold |

### Notifications / OTP delivery

| Variable | Required (feature-specific) | Example | Purpose |
|---|---|---|---|
| `SMTP_HOST` | Conditional | `smtp.hostinger.com` | SMTP host |
| `SMTP_PORT` | Conditional | `587` | SMTP port |
| `SMTP_USER` | Conditional | `noreply@aycindustries.com` | SMTP username |
| `SMTP_PASSWORD` | Conditional | `<smtp-password>` | SMTP password |
| `SMTP_FROM_EMAIL` | Conditional | `noreply@aycindustries.com` | Sender address |
| `FAST2SMS_API_KEY` | Optional | `<api-key>` | SMS OTP provider |
| `FAST2SMS_SENDER_ID` | Optional | `<sender-id>` | SMS sender id |
| `FAST2SMS_ROUTE` | Optional | `q` | SMS route type |
| `ENABLE_TELEGRAM_NOTIFICATIONS` | Optional | `false` | Telegram notifier enablement |
| `TELEGRAM_BOT_TOKEN` | Conditional | `<bot-token>` | Telegram bot auth |
| `TELEGRAM_CHAT_ID` | Conditional | `<chat-id>` | Telegram destination chat |
| `TELEGRAM_WEBHOOK_SECRET` | Recommended | `<secret>` | Telegram webhook validation |
| `TELEGRAM_BROADCAST_DELAY_MS` | Optional | `60` | Broadcast pacing |
| `TELEGRAM_INTERNAL_BACKEND` | Optional | `http://127.0.0.1:8010` | Internal relay backend URL |
| `ENABLE_WHATSAPP_NOTIFICATIONS` | Optional | `false` | WhatsApp notifier toggle |
| `TWILIO_ACCOUNT_SID` | Conditional | `<sid>` | Twilio account |
| `TWILIO_AUTH_TOKEN` | Conditional | `<token>` | Twilio auth |
| `TWILIO_WHATSAPP_FROM` | Conditional | `whatsapp:+14155238886` | WhatsApp source |
| `WHATSAPP_TO_NUMBER` | Conditional | `whatsapp:+91XXXXXXXXXX` | WhatsApp target |

### LLM providers (optional)

| Variable | Required | Example | Purpose |
|---|---|---|---|
| `GROQ_API_KEY` | Optional | `<api-key>` | Groq LLM integration |
| `GEMINI_API_KEY` | Optional | `<api-key>` | Gemini LLM integration |
| `CEREBRAS_API_KEY` | Optional | `<api-key>` | Cerebras LLM integration |
| `PERPLEXITY_API_KEY` | Optional | `<api-key>` | Perplexity integration |

## Secrets Handling Rules

- Keep real values only on server-side `.env` files.
- Never commit `.env` files with real credentials.
- Rotate all secrets after initial production launch.
- Ensure Dhan/Samco callback and API origins exactly match production domain.


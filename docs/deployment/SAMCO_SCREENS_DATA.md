# Samco EOD data → Screens (Top Movers, Volume Movers, Alpha)

## Backend path

All API logic lives in **`../backend_stockdashboard`** (sibling of this `stockdashboard` folder), **not** under `stockdashboard/`.

## Source of truth

| Screen | Metric | DB / logic |
|--------|--------|------------|
| **Top Movers** (`/api/stocks/price-shockers`) | 1D / 1W / 1M % | `HistoricalCandle` closes via `bulk_load_stock_closes` + `compute_returns_from_daily_closes` in `app/services/historical_period_returns.py` |
| **Volume Movers** (`/api/stocks/volume-shockers`) | Vol Jump, Vol % | **Volume**: `HistoricalCandle.volume` via `bulk_load_stock_daily_volumes` + `compute_volume_pct_from_daily_volumes`; **avg** for jump: `bulk_load_stock_recent_avg_volume` |
| **Alpha Tracker** (`/api/stocks/relative-performance`) | RS% vs NIFTY, RSI | RS from candle ratio logic in `app/api/stocks.py`; RSI from `TechnicalSignal` / Wilder fallback on candles |

Symbols are matched **case-insensitively** to candles (`_norm_stock_symbol`).

## Operations

1. Ensure **Samco EOD candle sync** runs on a schedule so `historical_candle` has enough history (week/month need multiple weeks of bars; volume % week needs ≥10 sessions, month needs ≥42).
2. After deploy, restart the API (`systemctl restart ani-backend` or equivalent).
3. If week and month still match, check for **missing or sparse candles** for those symbols—not a frontend issue.

See also: [REPO_LAYOUT.md](./REPO_LAYOUT.md), [VPS_ENABLEMENT_CHECKLIST.md](./VPS_ENABLEMENT_CHECKLIST.md).

# VPS: debug Screens data & DB persistence (Samco / candles)

Use this when **Top Movers**, **Volume Movers**, **Alpha Tracker**, or **IPOs** show **wrong, duplicate, or empty** values and you suspect **data is not saving** to PostgreSQL on the server.

**Root idea:** Screens **1W / 1M %**, **volume %**, and **RS%** are computed from **`historical_candles`** (and related tables). If candles are missing, sparse, or the VPS runs an **old backend commit** / **wrong database**, the UI will look like your old issues (same week vs month, `—` for vol metrics, weak Alpha, empty IPO fields).

---

## 0. Confirm you are debugging the **right** code and **right** DB

| Check | Action |
|--------|--------|
| **Backend commit** | On VPS: `cd /opt/ani-stock/backend_stockdashboard` (or your path) → `git log -1 --oneline`. Compare with the commit that includes `historical_period_returns.py` + `stocks.py` volume/candle fixes. |
| **Frontend commit** | Same for `stockdashboard` — date picker / cache fixes won’t fix bad API numbers. |
| **`.env` `DATABASE_URL`** | Must point to the **production** Postgres the app actually uses. A common mistake is API on VPS but `DATABASE_URL` still SQLite or a local DSN → “saves” go nowhere useful. |
| **Single writer** | Only one primary API + scheduler should write that DB; avoid pointing a laptop at prod DB while debugging unless intentional. |

```bash
# From backend folder — show DB host/db name only (redact password)
grep -E '^DATABASE_URL|^SQLALCHEMY' .env | sed 's/:[^:@]*@/:***@/'
```

---

## 1. API health, bootstrap, and Samco

Startup **`run_startup_data_bootstrap()`** runs **`CandleSyncEngine`** (Samco login → candles → DB). If Samco fails, candles stay empty/stale.

On Linux with **multiple Uvicorn workers**, only the process that **wins the bootstrap flock** runs this; others log that they skip sync. Set **`STARTUP_BOOTSTRAP_BEFORE_ORCHESTRATOR=false`** on the VPS so the API responds while sync continues (**see [VPS_DATA_STALENESS.md](./VPS_DATA_STALENESS.md) §0**).

```bash
# Local to Uvicorn on the VPS
curl -sS http://127.0.0.1:8000/api/system/status | head -c 800
curl -sS http://127.0.0.1:8000/api/system/readiness
```

- If **`bootstrap_complete`** stays **false** for a long time, read logs (step 2).
- Search logs for: **`Samco login failed`**, **`CandleSyncEngine failed`**, **`Startup bootstrap`**.

```bash
sudo journalctl -u ani-backend -n 200 --no-pager | grep -iE 'bootstrap|samco|candle|error|traceback'
sudo journalctl -u ani-backend -f
```

**Fix direction:** `SAMCO_*` credentials in `.env`, outbound HTTPS, clock skew, IP restrictions on Samco side, venv + `pip install -r requirements.txt`, then `sudo systemctl restart ani-backend`.

See also: [VPS_DATA_STALENESS.md](./VPS_DATA_STALENESS.md) (bootstrap gate), [VPS_ENABLEMENT_CHECKLIST.md](./VPS_ENABLEMENT_CHECKLIST.md) (venv / systemd).

---

## 2. PostgreSQL: is **`historical_candles`** actually filled?

Connect with `psql` (or your GUI) using the **same** URL as the app.

### 2a. Row counts and freshness

```sql
-- How many stock EOD rows? Latest trading date?
SELECT instrument_type, COUNT(*) AS n, MAX(candle_date) AS latest
FROM historical_candles
GROUP BY instrument_type;

-- Spot-check a liquid name (use symbol as stored in DB — case may vary)
SELECT candle_date, open, high, low, close, volume
FROM historical_candles
WHERE instrument_type = 'stock'
  AND UPPER(TRIM(symbol)) = 'RELIANCE'
ORDER BY candle_date DESC
LIMIT 15;
```

**Interpretation**

| Symptom | Likely cause |
|---------|----------------|
| `COUNT` very low or `latest` old | Candle sync not running or Samco failing |
| Stock rows exist but **volume** always NULL/0 | Old sync code or API not returning volume — update backend + re-sync |
| **No rows** for your symbol but others exist | Symbol mismatch (see §3) |

### 2b. History depth for Screens math

- **1M volume %** logic needs **≥ ~42** trading days of volume for that symbol.
- **1W vs 1M price %** needs enough **closes** and distinct reference dates; sparse history can make horizons look wrong.

```sql
SELECT UPPER(TRIM(symbol)) AS sym, COUNT(*) AS bars
FROM historical_candles
WHERE instrument_type = 'stock'
GROUP BY UPPER(TRIM(symbol))
ORDER BY bars ASC
LIMIT 30;
```

Symbols with very low `bars` will show weak or identical horizons.

---

## 3. Symbol alignment: **`stocks_sector_info`** vs **`historical_candles`**

Screens read live rows from **`stocks_sector_info`** and join candles by **normalized symbol** (upper/trim). If the universe table uses a different spelling than Samco stores, you get **no candle series** → API falls back to stale columns → “same week and month”.

```sql
-- Symbols in universe missing any stock candle row
SELECT s.symbol
FROM stocks_sector_info s
WHERE NOT EXISTS (
  SELECT 1 FROM historical_candles h
  WHERE h.instrument_type = 'stock'
    AND UPPER(TRIM(h.symbol)) = UPPER(TRIM(s.symbol))
)
LIMIT 50;
```

If this returns many rows, fix **ScripMaster / symbol mapping** or candle ingest so **`historical_candles.symbol`** matches **`stocks_sector_info.symbol`**.

---

## 4. Compare **API output** to DB (no browser)

Replace `SYMBOL` and your domain / localhost.

```bash
BASE=http://127.0.0.1:8000/api

curl -sS "$BASE/stocks/price-shockers?type=gainers&limit=5&period=week" | head -c 1200
curl -sS "$BASE/stocks/price-shockers?type=gainers&limit=5&period=month" | head -c 1200
```

- If **week and month JSON are identical** for the same symbols, check **§2–3** (candles + symbol alignment) and confirm **updated** `historical_period_returns.py` is deployed.

```bash
curl -sS "$BASE/stocks/volume-shockers?limit=5&period=day" | head -c 1500
```

- **`percent_change_volume_*`** and **`avg_volume`** drive the UI. If candles exist but fields are null, check logs during request (and backend version).

```bash
curl -sS "$BASE/stocks/relative-performance?period=1w&limit=5" | head -c 1200
```

- **`relative_strength`** NULL for everyone → often **missing index candles** for NIFTY (check `instrument_type = 'index'` in `historical_candles`).

---

## 5. **`stocks_sector_info`** freshness (live path)

When not using a snapshot date, APIs use deduped live rows:

```sql
SELECT COUNT(*), MAX(timestamp) AS last_update
FROM stocks_sector_info;

SELECT symbol, price, day1d, week1w, month1m, volume, avg_volume, timestamp
FROM stocks_sector_info
WHERE UPPER(TRIM(symbol)) = 'RELIANCE'
LIMIT 1;
```

If **`timestamp` is days old**, quote/sync jobs may be stuck — logs + orchestrator (scheduler).

**Env (subsector / EOD CHG alignment):** `STOCK_PERSIST_EOD_DAY1D` (see [VPS_ENABLEMENT_CHECKLIST.md](./VPS_ENABLEMENT_CHECKLIST.md)).

---

## 6. Snapshots vs live (date picker)

For a **historical** `?date=YYYY-MM-DD`, the API may read **`daily_screen_snapshots`**. If snapshots were built when candles were empty, numbers stay wrong until you **re-backfill** or use live mode.

```bash
curl -sS "http://127.0.0.1:8000/api/stocks/screen-dates"
```

```sql
SELECT snapshot_date, COUNT(*) FROM daily_screen_snapshots GROUP BY snapshot_date ORDER BY snapshot_date DESC LIMIT 10;
```

---

## 7. IPO table

IPO rows live in **`ipo_issues`**. Subscription / issue price come from NSE fetch + field mapping; if the job fails, columns stay empty.

```sql
SELECT COUNT(*), MAX(updated_at) FROM ipo_issues;  -- if column exists; else use id/limit
SELECT symbol, issue_price, subscription_times, status FROM ipo_issues ORDER BY id DESC LIMIT 15;
```

Logs: `grep -i ipo journalctl ...` or search **`IPO data fetch`** in bootstrap logs.

---

## 8. Quick decision tree

1. **`readiness` → bootstrap_complete false** → fix Samco / bootstrap errors first.  
2. **`historical_candles` empty or stale** → CandleSyncEngine / credentials / network.  
3. **Candles exist but symbol missing in join** → symbol mapping (§3).  
4. **Candles sparse** (`bars` &lt; ~50) → extend backfill (`SAMCO_INDEX_BACKFILL_DAYS`, stock historical jobs — see scheduler / `candle_sync_engine`).  
5. **API week ≠ month locally but wrong on VPS** → wrong DB, old code, or cached **browser sessionStorage** — hard refresh + verify Network response body.  
6. **IPOs empty columns** → NSE fetch blocked (403) or outdated `ipo_fetcher.py`; check logs.

---

## Related docs

- [SAMCO_SCREENS_DATA.md](./SAMCO_SCREENS_DATA.md) — which table feeds which screen  
- [VPS_DATA_STALENESS.md](./VPS_DATA_STALENESS.md) — bootstrap, FII, trending  
- [VPS_ENABLEMENT_CHECKLIST.md](./VPS_ENABLEMENT_CHECKLIST.md) — pull both repos, venv, nginx, `.env`  
- [VPS_RESTART_FRONTEND_BACKEND.md](./VPS_RESTART_FRONTEND_BACKEND.md) — restart order  

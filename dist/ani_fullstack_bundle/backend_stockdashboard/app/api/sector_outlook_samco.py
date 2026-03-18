from datetime import datetime, timedelta, time as dt_time
import time
from typing import Dict, List

from fastapi import APIRouter, Query
from pydantic import BaseModel
from sqlalchemy import func

from app.db.database import SessionLocal
from app.db.models import HistoricalCandle, IntradayIndexCandle, MarketIndex
from app.config.samco_rate_limits import GLOBAL_MIN_DELAY_SEC
from app.external.samco.client import SamcoClient

router = APIRouter(prefix="/api/sector-outlook", tags=["sector-outlook"])
_LAST_SECTOR_REFRESH_AT = None
_SECTOR_REFRESH_TTL_SECONDS = 15 * 60

SECTOR_OUTLOOK_SYMBOLS = [
    "NIFTY PSU BANK",
    "NIFTY METAL",
    "NIFTY FMCG",
    "NIFTY INFRA",
    "NIFTY ENERGY",
    "NIFTY CONSUMPTION",
    "NIFTY AUTO",
    "NIFTY PVT BANK",
    "NIFTY PHARMA",
    "NIFTY REALTY",
    "NIFTY MEDIA",
    "NIFTY SERV SECTOR",
    "NIFTY FIN SERVICE",
    "NIFTY IT",
]

INTERVAL_DAYS = {"1d": 1, "1w": 7, "1m": 30, "3m": 90, "6m": 180, "1y": 365, "3y": 1095}
MARKET_INDICES_SAMCO_SET = {
    "NIFTY 50",
    "NIFTY NEXT 50",
    "NIFTY 100",
    "NIFTY 200",
    "NIFTY BANK",
    "SENSEX",
    "INDIA VIX",
    "NIFTY SMLCAP 100",
}


class SectorOutlookRow(BaseModel):
    id: str
    name: str
    trend: str
    value: str
    percentile: str
    day1d: str
    week1w: str
    month1m: str
    month3m: str
    month6m: str
    year1y: str
    year3y: str


def _parse_close(c):
    if isinstance(c, dict):
        date, close = c.get("date"), c.get("close")
    elif isinstance(c, (list, tuple)) and len(c) >= 5:
        date, close = c[0], c[4]
    else:
        return None
    if not date or close in (None, 0):
        return None
    return str(date), float(close)


def _returns_from_candles(candles):
    parsed = [_parse_close(c) for c in candles]
    parsed = [p for p in parsed if p]
    if not parsed:
        return {}
    parsed.sort(key=lambda x: x[0])
    cur_dt = datetime.strptime(parsed[-1][0], "%Y-%m-%d")
    cur_close = parsed[-1][1]
    out = {}
    for k, days in INTERVAL_DAYS.items():
        target = cur_dt - timedelta(days=days)
        ref = next((close for date, close in reversed(parsed) if datetime.strptime(date, "%Y-%m-%d") <= target), None)
        if ref and ref > 0:
            out[k] = round(((cur_close - ref) / ref) * 100, 2)
    return out


def _extract_candles_from_symbol_response(resp):
    candles_obj = (resp or {}).get("historicalCandleData") or (resp or {}).get("historicalCandles") or []
    if isinstance(candles_obj, dict):
        first = next(iter(candles_obj.values()), [])
        return first if isinstance(first, list) else []
    return candles_obj if isinstance(candles_obj, list) else []


def _latest_close(candles) -> float:
    parsed = [_parse_close(c) for c in candles]
    parsed = [p for p in parsed if p]
    if not parsed:
        return 0.0
    parsed.sort(key=lambda x: x[0])
    return float(parsed[-1][1] or 0.0)


def _clean_sector_name(symbol: str) -> str:
    if ":" in symbol:
        return symbol.split(":", 1)[1]
    return symbol


def _is_market_index_symbol(symbol: str) -> bool:
    return _clean_sector_name(symbol).upper() in MARKET_INDICES_SAMCO_SET


def _has_any_timeline_data(idx: MarketIndex) -> bool:
    return any(
        v not in (None,)
        for v in [
            idx.perf_1d,
            idx.perf_1w,
            idx.perf_1m,
            idx.perf_3m,
            idx.perf_6m,
            idx.perf_1y,
            idx.perf_3y,
            idx.value,
        ]
    )


def refresh_sector_outlook_from_samco(delay_sec: float = GLOBAL_MIN_DELAY_SEC) -> Dict[str, int]:
    db = SessionLocal()
    client = SamcoClient()
    if not client.login():
        db.close()
        return {"updated": 0, "failed": len(SECTOR_OUTLOOK_SYMBOLS)}

    updated = 0
    failed = 0
    try:
        for sym in SECTOR_OUTLOOK_SYMBOLS:
            if _is_market_index_symbol(sym):
                # Sector page should only contain non-market-index entries.
                continue
            clean_name = _clean_sector_name(sym)
            idx = db.query(MarketIndex).filter(MarketIndex.name == clean_name).first()
            if idx is None:
                idx = MarketIndex(name=clean_name, source="samco", last_updated=datetime.now())
                db.add(idx)
            from_date = (datetime.now() - timedelta(days=1200)).strftime("%Y-%m-%d")
            to_date = datetime.now().strftime("%Y-%m-%d")

            # Use the configured symbol list directly as Samco index names.
            resp = client.get_index_historical_candle_data(
                index_name=clean_name,
                from_date=from_date,
                to_date=to_date,
                max_retries=2,
                base_delay=2,
            )
            candles = (resp or {}).get("indexCandleData") or []

            returns = _returns_from_candles(candles)
            if not returns:
                failed += 1
                time.sleep(max(delay_sec, GLOBAL_MIN_DELAY_SEC))
                continue

            idx.perf_1d = returns.get("1d", idx.perf_1d or 0.0)
            idx.perf_1w = returns.get("1w", idx.perf_1w or 0.0)
            idx.perf_1m = returns.get("1m", idx.perf_1m or 0.0)
            idx.perf_3m = returns.get("3m", idx.perf_3m or 0.0)
            idx.perf_6m = returns.get("6m", idx.perf_6m or 0.0)
            idx.perf_1y = returns.get("1y", idx.perf_1y or 0.0)
            idx.perf_3y = returns.get("3y", idx.perf_3y or 0.0)
            idx.value = _latest_close(candles) or float(idx.value or 0.0)
            idx.percentage_change = idx.perf_1d or 0.0
            idx.percentile = idx.perf_1d or 0.0
            idx.source = "samco"
            idx.last_updated = datetime.now()
            updated += 1
            time.sleep(max(delay_sec, GLOBAL_MIN_DELAY_SEC))
        db.commit()
        return {"updated": updated, "failed": failed}
    except Exception:
        db.rollback()
        return {"updated": updated, "failed": failed + 1}
    finally:
        db.close()


def _pct(v: float) -> str:
    return ("↗" if v >= 0 else "↘") + f" {v:.2f}%"


def _latest_intraday_close_map(db, index_names: List[str]) -> Dict[str, float]:
    """Return today's latest intraday close per index."""
    if not index_names:
        return {}
    day_start = datetime.combine(datetime.now().date(), dt_time.min)
    subq = (
        db.query(
            IntradayIndexCandle.index_name.label("index_name"),
            func.max(IntradayIndexCandle.candle_time).label("max_ct"),
        )
        .filter(
            IntradayIndexCandle.index_name.in_(index_names),
            IntradayIndexCandle.candle_time >= day_start,
        )
        .group_by(IntradayIndexCandle.index_name)
        .subquery()
    )
    rows = (
        db.query(IntradayIndexCandle.index_name, IntradayIndexCandle.close)
        .join(
            subq,
            (IntradayIndexCandle.index_name == subq.c.index_name)
            & (IntradayIndexCandle.candle_time == subq.c.max_ct),
        )
        .all()
    )
    out: Dict[str, float] = {}
    for r in rows:
        try:
            out[str(r.index_name)] = float(r.close)
        except Exception:
            continue
    return out


def _latest_prev_close_map(db, index_names: List[str]) -> Dict[str, float]:
    """Fallback previous close from historical index candles (last available date)."""
    if not index_names:
        return {}
    subq = (
        db.query(
            HistoricalCandle.symbol.label("symbol"),
            func.max(HistoricalCandle.candle_date).label("max_cd"),
        )
        .filter(
            HistoricalCandle.instrument_type == "index",
            HistoricalCandle.symbol.in_(index_names),
        )
        .group_by(HistoricalCandle.symbol)
        .subquery()
    )
    rows = (
        db.query(HistoricalCandle.symbol, HistoricalCandle.close)
        .join(
            subq,
            (HistoricalCandle.symbol == subq.c.symbol)
            & (HistoricalCandle.candle_date == subq.c.max_cd),
        )
        .all()
    )
    out: Dict[str, float] = {}
    for r in rows:
        try:
            out[str(r.symbol)] = float(r.close)
        except Exception:
            continue
    return out


def _needs_auto_refresh(db) -> bool:
    sample_rows = (
        db.query(MarketIndex)
        .filter(MarketIndex.name.in_([_clean_sector_name(s) for s in SECTOR_OUTLOOK_SYMBOLS if not _is_market_index_symbol(s)]))
        .all()
    )
    if not sample_rows:
        return True

    # If many rows have 1W == 1M exactly, data is usually stale/incorrect.
    equal_count = 0
    valid_count = 0
    for r in sample_rows:
        if r.perf_1w is None or r.perf_1m is None:
            continue
        valid_count += 1
        if abs(float(r.perf_1w) - float(r.perf_1m)) < 1e-9:
            equal_count += 1

    if valid_count >= 6 and equal_count >= max(6, int(valid_count * 0.6)):
        return True
    return False


def _ensure_sector_outlook_fresh(force_refresh: bool = False) -> None:
    global _LAST_SECTOR_REFRESH_AT
    now_ts = time.time()
    if not force_refresh and _LAST_SECTOR_REFRESH_AT and (now_ts - _LAST_SECTOR_REFRESH_AT) < _SECTOR_REFRESH_TTL_SECONDS:
        return

    if not force_refresh:
        db = SessionLocal()
        try:
            if not _needs_auto_refresh(db):
                _LAST_SECTOR_REFRESH_AT = now_ts
                return
        finally:
            db.close()

    result = refresh_sector_outlook_from_samco(delay_sec=0)
    if result.get("updated", 0) > 0 or result.get("failed", 0) >= 0:
        _LAST_SECTOR_REFRESH_AT = now_ts


@router.get("", response_model=List[SectorOutlookRow])
async def get_sector_outlook(force_refresh: bool = Query(default=False)):
    _ensure_sector_outlook_fresh(force_refresh=force_refresh)
    db = SessionLocal()
    try:
        rows = []
        row_num = 1
        all_clean_names = [
            _clean_sector_name(s)
            for s in SECTOR_OUTLOOK_SYMBOLS
            if not _is_market_index_symbol(s)
        ]
        intraday_close_map = _latest_intraday_close_map(db, all_clean_names)
        prev_close_map = _latest_prev_close_map(db, all_clean_names)
        for symbol in SECTOR_OUTLOOK_SYMBOLS:
            if _is_market_index_symbol(symbol):
                continue
            clean_name = _clean_sector_name(symbol)
            idx = db.query(MarketIndex).filter(MarketIndex.name == clean_name).first()
            if idx is None or not _has_any_timeline_data(idx):
                # Keep frontend sector list limited to entries that actually have data.
                continue
            live_close = intraday_close_map.get(clean_name)
            prev_close = None
            if idx and idx.previous_close not in (None, 0):
                try:
                    prev_close = float(idx.previous_close)
                except Exception:
                    prev_close = None
            if prev_close in (None, 0):
                prev_close = prev_close_map.get(clean_name)

            if live_close not in (None, 0) and prev_close not in (None, 0):
                d1 = round(((float(live_close) - float(prev_close)) / float(prev_close)) * 100.0, 2)
            else:
                d1 = float(idx.perf_1d or idx.percentage_change or 0.0) if idx else 0.0
            w1 = float(idx.perf_1w or 0.0) if idx else 0.0
            m1 = float(idx.perf_1m or 0.0) if idx else 0.0
            m3 = float(idx.perf_3m or 0.0) if idx else 0.0
            m6 = float(idx.perf_6m or 0.0) if idx else 0.0
            y1 = float(idx.perf_1y or 0.0) if idx else 0.0
            y3 = float(idx.perf_3y or 0.0) if idx else 0.0
            shown_value = float(live_close) if live_close not in (None, 0) else float(idx.value or 0.0)
            rows.append(
                SectorOutlookRow(
                    id=f"{row_num:02d}",
                    name=clean_name,
                    trend="↗" if d1 >= 0 else "↘",
                    value=f"₹{shown_value:,.2f}" if idx else "₹0.00",
                    percentile=f"{float(idx.percentile or 0.0):.0f}%" if idx else "0%",
                    day1d=_pct(d1),
                    week1w=_pct(w1),
                    month1m=_pct(m1),
                    month3m=_pct(m3),
                    month6m=_pct(m6),
                    year1y=_pct(y1),
                    year3y=_pct(y3),
                )
            )
            row_num += 1
        return rows
    finally:
        db.close()


@router.get("/refresh")
async def refresh_sector_outlook():
    result = refresh_sector_outlook_from_samco(delay_sec=0)
    return {"status": "ok", **result}

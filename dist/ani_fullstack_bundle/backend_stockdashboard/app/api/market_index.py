# REST API Routes for Market Indices
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from app.db.database import get_db, SessionLocal
from app.db.models import IntradayIndexCandle
from app.schemas_models import MarketIndex, MarketIndexCreate
from app.db.crud_market_index import (
    get_market_index_by_name,
    get_all_market_indices,
    upsert_market_index
)
import logging
import json
import time
from datetime import datetime, timedelta, date

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/market-indices", tags=["market-indices"])

# Simple in-memory cache
_cache = {"data": None, "timestamp": None, "ttl_seconds": 30}

def _normalize_index_name(value: str) -> str:
    return "".join(ch for ch in value.lower() if ch.isalnum())


# Market Indices page must expose only these seven entries.
MARKET_INDICES_ORDER = [
    "Nifty 50",
    "Nifty Next 50",
    "Nifty 100",
    "Nifty 200",
    "Nifty Smlcap 100",
    "Nifty Bank",
    "Sensex",
    "India VIX",
]
MARKET_INDICES_ORDER_NORM = {_normalize_index_name(name): name for name in MARKET_INDICES_ORDER}

@router.get("/", response_model=List[MarketIndex])
def get_indices(db: Session = Depends(get_db)):
    """
    Retrieve all market indices (with response caching for performance)
    """
    # Check cache
    if (_cache["data"] is not None and 
        _cache["timestamp"] is not None and
        time.time() - _cache["timestamp"] < _cache["ttl_seconds"]):
        return _cache["data"]
    
    try:
        indices = get_all_market_indices(db)
        by_norm = {}
        for idx in indices:
            if not idx.name:
                continue
            norm = _normalize_index_name(idx.name)
            if norm in MARKET_INDICES_ORDER_NORM and norm not in by_norm:
                by_norm[norm] = idx

        result = []
        for display_name in MARKET_INDICES_ORDER:
            idx = by_norm.get(_normalize_index_name(display_name))
            if idx is None:
                continue
            pe_val = None
            if idx.pe not in ("—", "", None):
                try:
                    pe_val = float(str(idx.pe).replace(",", ""))
                except (ValueError, AttributeError):
                    pe_val = None

            pct = getattr(idx, 'percentage_change', None)
            if pct is None:
                pct = idx.percentile or 0.0
            d1_hist = getattr(idx, 'perf_1d', None)
            # For Market Outlook daily column, prefer live day change from quote stream.
            d1 = pct if pct is not None else d1_hist
            trend_val = d1 if d1 is not None else 0.0
            trend = "\u2191" if trend_val > 0.05 else ("\u2193" if trend_val < -0.05 else "\u2192")

            result.append(MarketIndex(
                id=idx.id,
                name=display_name,
                value=idx.value,
                change=idx.change,
                percentile=idx.percentile,
                percentage_change=pct,
                pe=pe_val,
                trend=trend,
                last_updated=idx.last_updated,
                day_open=getattr(idx, 'day_open', None),
                day_high=getattr(idx, 'day_high', None),
                day_low=getattr(idx, 'day_low', None),
                perf_1d=d1,
                perf_1w=getattr(idx, 'perf_1w', None),
                perf_1m=getattr(idx, 'perf_1m', None),
                perf_3m=getattr(idx, 'perf_3m', None),
                perf_6m=getattr(idx, 'perf_6m', None),
                perf_1y=getattr(idx, 'perf_1y', None),
                perf_3y=getattr(idx, 'perf_3y', None),
            ))
        
        # Cache response
        _cache["data"] = result
        _cache["timestamp"] = time.time()
        
        return result
    except Exception as e:
        logger.exception("Error retrieving market indices")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{name}", response_model=MarketIndex)
def get_index(name: str, db: Session = Depends(get_db)):
    """
    Retrieve a specific market index by name
    """
    requested_norm = _normalize_index_name(name)
    if requested_norm not in MARKET_INDICES_ORDER_NORM:
        raise HTTPException(status_code=404, detail=f"Market index '{name}' not found")

    index = get_market_index_by_name(db, MARKET_INDICES_ORDER_NORM[requested_norm])
    if not index:
        normalized = requested_norm
        candidates = get_all_market_indices(db)
        for candidate in candidates:
            if _normalize_index_name(candidate.name) == normalized:
                index = candidate
                break
        if not index:
            raise HTTPException(status_code=404, detail=f"Market index '{name}' not found")
    if index.pe in ("—", "", None):
        index.pe = None
    else:
        try:
            index.pe = float(str(index.pe).replace(",", ""))
        except ValueError:
            index.pe = None
    return index

@router.post("/", response_model=MarketIndex)
def create_or_update_index(index: MarketIndexCreate, db: Session = Depends(get_db)):
    """
    Create or update a market index
    """
    db_index = upsert_market_index(
        db=db,
        name=index.name,
        value=index.value,
        change=index.change,
        percentile=index.percentile,
        pe=index.pe,
        trend=index.trend
    )
    return db_index


@router.get("/{name}/intraday")
def get_index_intraday(name: str):
    """Return today's intraday candle series for the daily curve chart."""
    requested_norm = _normalize_index_name(name)
    display_name = MARKET_INDICES_ORDER_NORM.get(requested_norm)
    if not display_name:
        raise HTTPException(status_code=404, detail=f"Index '{name}' not found")

    today = date.today()
    start = datetime.combine(today, datetime.min.time()).replace(hour=9, minute=15)
    end = datetime.combine(today, datetime.min.time()).replace(hour=15, minute=30)

    db = SessionLocal()
    try:
        rows = (
            db.query(IntradayIndexCandle)
            .filter(
                IntradayIndexCandle.index_name == display_name,
                IntradayIndexCandle.candle_time >= start,
                IntradayIndexCandle.candle_time <= end,
            )
            .order_by(IntradayIndexCandle.candle_time.asc())
            .all()
        )
        return {
            "index": display_name,
            "count": len(rows),
            "data": [
                {
                    "time": r.candle_time.strftime("%H:%M"),
                    "open": r.open,
                    "high": r.high,
                    "low": r.low,
                    "close": r.close,
                    "volume": r.volume,
                }
                for r in rows
            ],
        }
    finally:
        db.close()

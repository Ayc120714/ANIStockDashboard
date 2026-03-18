"""
API Router for Market Indices
Returns real-time market index data
"""
from fastapi import APIRouter, HTTPException
from sqlalchemy import func
from app.db.database import SessionLocal
from app.db.models import MarketIndex
from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional

router = APIRouter(prefix="/api/indices", tags=["indices"])

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


def _norm(name: str) -> str:
    return "".join(ch for ch in (name or "").lower() if ch.isalnum())


MARKET_INDICES_ORDER_NORM = {_norm(name): name for name in MARKET_INDICES_ORDER}

class IndexResponse(BaseModel):
    name: str
    value: float
    change: Optional[float] = None
    change_percent: Optional[float] = None
    day_open: Optional[float] = None
    day_high: Optional[float] = None
    day_low: Optional[float] = None
    previous_close: Optional[float] = None
    volume: Optional[int] = None
    last_updated: Optional[datetime] = None
    trend: Optional[str] = None
    perf_1d: Optional[float] = None
    perf_1w: Optional[float] = None
    perf_1m: Optional[float] = None
    perf_3m: Optional[float] = None
    perf_6m: Optional[float] = None
    perf_1y: Optional[float] = None
    perf_3y: Optional[float] = None

    @classmethod
    def from_orm(cls, obj):
        pct = getattr(obj, 'percentage_change', None)
        if pct is None:
            pct = getattr(obj, 'percentile', None) or 0.0
        d1_hist = getattr(obj, 'perf_1d', None)
        # Use live day move for daily value/trend whenever available.
        d1 = pct if pct is not None else d1_hist
        trend_val = d1 if d1 is not None else 0.0
        trend = "\u2191" if trend_val > 0.05 else ("\u2193" if trend_val < -0.05 else "\u2192")
        return cls(
            name=obj.name,
            value=obj.value,
            change=obj.change,
            change_percent=pct,
            day_open=obj.day_open,
            day_high=obj.day_high,
            day_low=obj.day_low,
            previous_close=obj.previous_close,
            volume=None,
            last_updated=obj.last_updated,
            trend=trend,
            perf_1d=d1,
            perf_1w=getattr(obj, 'perf_1w', None),
            perf_1m=getattr(obj, 'perf_1m', None),
            perf_3m=getattr(obj, 'perf_3m', None),
            perf_6m=getattr(obj, 'perf_6m', None),
            perf_1y=getattr(obj, 'perf_1y', None),
            perf_3y=getattr(obj, 'perf_3y', None),
        )

    class Config:
        from_attributes = True

class IndexListResponse(BaseModel):
    count: int
    data: List[IndexResponse]

@router.get("", response_model=IndexListResponse)
async def get_all_indices():
    """Get all market indices with real-time data"""
    try:
        db = SessionLocal()
        indices = db.query(MarketIndex).order_by(MarketIndex.last_updated.desc()).all()
        by_norm = {}
        for idx in indices:
            n = _norm(idx.name)
            if n in MARKET_INDICES_ORDER_NORM and n not in by_norm:
                by_norm[n] = idx
        ordered = []
        for display_name in MARKET_INDICES_ORDER:
            item = by_norm.get(_norm(display_name))
            if item is not None:
                ordered.append(item)
        db.close()
        
        return IndexListResponse(
            count=len(ordered),
            data=[IndexResponse.from_orm(idx) for idx in ordered]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{index_name}", response_model=IndexResponse)
async def get_index(index_name: str):
    """Get specific index data by name"""
    try:
        requested_norm = _norm(index_name)
        if requested_norm not in MARKET_INDICES_ORDER_NORM:
            raise HTTPException(status_code=404, detail=f"Index '{index_name}' not found")
        db = SessionLocal()
        index = db.query(MarketIndex).filter_by(name=MARKET_INDICES_ORDER_NORM[requested_norm]).first()
        if not index:
            # Fallback to normalized lookup when DB name style differs.
            candidates = db.query(MarketIndex).all()
            for candidate in candidates:
                if _norm(candidate.name) == requested_norm:
                    index = candidate
                    break
        db.close()
        
        if not index:
            raise HTTPException(status_code=404, detail=f"Index '{index_name}' not found")
        
        return IndexResponse.from_orm(index)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/performance/top")
async def get_top_performers(limit: int = 5):
    """Get top performing indices"""
    try:
        db = SessionLocal()
        indices = db.query(MarketIndex).order_by(
            MarketIndex.percentage_change.desc()
        ).limit(limit).all()
        db.close()
        
        return {
            "count": len(indices),
            "data": [IndexResponse.from_orm(idx) for idx in indices]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/performance/bottom")
async def get_worst_performers(limit: int = 5):
    """Get worst performing indices"""
    try:
        db = SessionLocal()
        indices = db.query(MarketIndex).order_by(
            MarketIndex.percentage_change.asc()
        ).limit(limit).all()
        db.close()
        
        return {
            "count": len(indices),
            "data": [IndexResponse.from_orm(idx) for idx in indices]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

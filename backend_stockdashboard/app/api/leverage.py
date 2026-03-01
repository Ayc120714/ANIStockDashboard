from __future__ import annotations

import csv
import io
import os
from datetime import datetime

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.models import SymbolLeverage
from app.db.session import get_db
from app.services.leverage_sync import get_last_leverage_sync_meta, run_leverage_sync

router = APIRouter(prefix="/api/leverage", tags=["leverage"])


def _to_positive_float(value) -> float | None:
    if value is None:
        return None
    if isinstance(value, str) and not value.strip():
        return None
    try:
        n = float(value)
    except (TypeError, ValueError):
        return None
    return n if n > 0 else None


def _normalize_symbol(symbol: str) -> str:
    return str(symbol or "").strip().upper()


def _normalize_broker(broker: str) -> str:
    return str(broker or "dhan").strip().lower()


def _require_admin_key(x_admin_key: str | None = Header(default=None)):
    expected = os.getenv("ADMIN_IMPORT_KEY", "").strip()
    if not expected:
        return
    if not x_admin_key or x_admin_key != expected:
        raise HTTPException(status_code=403, detail="Invalid admin key")


class LeverageImportRow(BaseModel):
    broker: str = Field(..., min_length=1)
    symbol: str = Field(..., min_length=1)
    intraday_leverage: float | None = None
    margin_leverage: float | None = None
    delivery_leverage: float | None = None
    source: str | None = None
    notes: str | None = None


class LeverageBulkImportRequest(BaseModel):
    rows: list[LeverageImportRow] = Field(default_factory=list)
    overwrite_existing: bool = True


class LeverageCsvImportRequest(BaseModel):
    csv_text: str = Field(..., min_length=1)
    overwrite_existing: bool = True


def _serialize(row: SymbolLeverage) -> dict:
    return {
        "id": row.id,
        "broker": row.broker,
        "symbol": row.symbol,
        "intraday_leverage": row.intraday_leverage,
        "margin_leverage": row.margin_leverage,
        "delivery_leverage": row.delivery_leverage,
        "source": row.source,
        "notes": row.notes,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def _upsert_rows(db: Session, rows: list[LeverageImportRow], overwrite_existing: bool) -> dict:
    inserted = 0
    updated = 0
    skipped = 0
    invalid = 0

    for item in rows:
        broker = _normalize_broker(item.broker)
        symbol = _normalize_symbol(item.symbol)
        intraday = _to_positive_float(item.intraday_leverage)
        margin = _to_positive_float(item.margin_leverage)
        delivery = _to_positive_float(item.delivery_leverage)
        if not broker or not symbol:
            invalid += 1
            continue
        if intraday is None and margin is None and delivery is None:
            invalid += 1
            continue

        row = (
            db.query(SymbolLeverage)
            .filter(SymbolLeverage.broker == broker, SymbolLeverage.symbol == symbol)
            .first()
        )
        if row is None:
            row = SymbolLeverage(
                broker=broker,
                symbol=symbol,
                intraday_leverage=intraday,
                margin_leverage=margin,
                delivery_leverage=delivery,
                source=item.source,
                notes=item.notes,
            )
            db.add(row)
            inserted += 1
            continue

        if not overwrite_existing:
            skipped += 1
            continue

        row.intraday_leverage = intraday
        row.margin_leverage = margin
        row.delivery_leverage = delivery
        row.source = item.source
        row.notes = item.notes
        row.updated_at = datetime.utcnow()
        updated += 1

    db.commit()
    return {
        "inserted": inserted,
        "updated": updated,
        "skipped": skipped,
        "invalid": invalid,
        "total": len(rows),
    }


def _rows_from_csv(csv_text: str) -> list[LeverageImportRow]:
    reader = csv.DictReader(io.StringIO(csv_text))
    rows: list[LeverageImportRow] = []
    for row in reader:
        rows.append(
            LeverageImportRow(
                broker=row.get("broker") or row.get("Broker") or "",
                symbol=row.get("symbol") or row.get("Symbol") or "",
                intraday_leverage=row.get("intraday_leverage") or row.get("mis_leverage") or row.get("intraday"),
                margin_leverage=row.get("margin_leverage") or row.get("mtf_leverage") or row.get("margin"),
                delivery_leverage=row.get("delivery_leverage") or row.get("cnc_leverage") or row.get("delivery"),
                source=row.get("source"),
                notes=row.get("notes"),
            )
        )
    return rows


@router.post("/import")
def import_leverage_json(
    payload: LeverageBulkImportRequest,
    _: None = Depends(_require_admin_key),
    db: Session = Depends(get_db),
):
    result = _upsert_rows(db, payload.rows, overwrite_existing=payload.overwrite_existing)
    return {"ok": True, "result": result}


@router.post("/import-csv")
def import_leverage_csv(
    payload: LeverageCsvImportRequest,
    _: None = Depends(_require_admin_key),
    db: Session = Depends(get_db),
):
    rows = _rows_from_csv(payload.csv_text)
    result = _upsert_rows(db, rows, overwrite_existing=payload.overwrite_existing)
    return {"ok": True, "result": result}


@router.get("")
def list_leverage(
    broker: str | None = Query(default=None),
    symbol: str | None = Query(default=None),
    limit: int = Query(default=500, ge=1, le=5000),
    db: Session = Depends(get_db),
):
    query = db.query(SymbolLeverage)
    if broker:
        query = query.filter(SymbolLeverage.broker == _normalize_broker(broker))
    if symbol:
        query = query.filter(SymbolLeverage.symbol == _normalize_symbol(symbol))
    rows = query.order_by(SymbolLeverage.symbol.asc()).limit(limit).all()
    return {"data": [_serialize(r) for r in rows]}


@router.get("/coverage")
def leverage_coverage(
    broker: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
):
    b = _normalize_broker(broker)
    rows = db.query(SymbolLeverage).filter(SymbolLeverage.broker == b).all()
    total = len(rows)
    intraday = sum(1 for r in rows if (r.intraday_leverage or 0) > 0)
    margin = sum(1 for r in rows if (r.margin_leverage or 0) > 0)
    delivery = sum(1 for r in rows if (r.delivery_leverage or 0) > 0)
    return {
        "broker": b,
        "total_symbols": total,
        "intraday_available": intraday,
        "intraday_missing": max(total - intraday, 0),
        "margin_available": margin,
        "delivery_available": delivery,
    }


@router.post("/sync-now")
def sync_now(
    _: None = Depends(_require_admin_key),
    db: Session = Depends(get_db),
):
    result = run_leverage_sync(db)
    return result


@router.get("/sync-status")
def sync_status():
    return {"data": get_last_leverage_sync_meta()}


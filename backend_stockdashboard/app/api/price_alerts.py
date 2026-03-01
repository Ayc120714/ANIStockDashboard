from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.models import PriceAlert, PriceAlertTrigger
from app.db.session import get_db

router = APIRouter(prefix="/api/price-alerts", tags=["price-alerts"])


class PriceAlertUpsertRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    list_type: str = Field(default="short_term")
    symbol: str = Field(..., min_length=1)
    direction: str = Field(default="ABOVE")
    threshold_price: float = Field(..., gt=0)
    is_active: bool = Field(default=True)


class PriceAlertCheckRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    list_type: str | None = None
    prices: dict[str, float] = Field(default_factory=dict)


def _serialize_alert(row: PriceAlert) -> dict:
    return {
        "id": row.id,
        "user_id": row.user_id,
        "list_type": row.list_type,
        "symbol": row.symbol,
        "direction": row.direction,
        "threshold_price": row.threshold_price,
        "is_active": row.is_active,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def _serialize_trigger(row: PriceAlertTrigger) -> dict:
    return {
        "id": row.id,
        "alert_id": row.alert_id,
        "user_id": row.user_id,
        "list_type": row.alert.list_type if row.alert else None,
        "symbol": row.symbol,
        "direction": row.direction,
        "threshold_price": row.threshold_price,
        "trigger_price": row.trigger_price,
        "message": row.message,
        "triggered_at": row.triggered_at.isoformat() if row.triggered_at else None,
    }


@router.get("")
def list_price_alerts(
    user_id: str,
    list_type: str | None = Query(default=None),
    active_only: bool = Query(default=True),
    db: Session = Depends(get_db),
):
    q = db.query(PriceAlert).filter(PriceAlert.user_id == user_id)
    if list_type:
        q = q.filter(PriceAlert.list_type == list_type)
    if active_only:
        q = q.filter(PriceAlert.is_active.is_(True))
    rows = q.order_by(PriceAlert.created_at.desc()).all()
    return {"data": [_serialize_alert(r) for r in rows]}


@router.post("")
def upsert_price_alert(payload: PriceAlertUpsertRequest, db: Session = Depends(get_db)):
    direction = (payload.direction or "ABOVE").upper()
    if direction not in {"ABOVE", "BELOW", "AT"}:
        raise HTTPException(status_code=400, detail="direction must be ABOVE, BELOW, or AT")
    symbol = payload.symbol.strip().upper()
    list_type = (payload.list_type or "short_term").strip().lower()
    if list_type not in {"short_term", "long_term"}:
        raise HTTPException(status_code=400, detail="list_type must be short_term or long_term")

    row = (
        db.query(PriceAlert)
        .filter(
            PriceAlert.user_id == payload.user_id,
            PriceAlert.list_type == list_type,
            PriceAlert.symbol == symbol,
            PriceAlert.direction == direction,
        )
        .first()
    )
    if row is None:
        row = PriceAlert(
            user_id=payload.user_id,
            list_type=list_type,
            symbol=symbol,
            direction=direction,
        )
        db.add(row)
    row.threshold_price = payload.threshold_price
    row.is_active = bool(payload.is_active)
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return {"ok": True, "data": _serialize_alert(row)}


@router.delete("/{alert_id}")
def delete_price_alert(alert_id: int, user_id: str, db: Session = Depends(get_db)):
    row = db.query(PriceAlert).filter(PriceAlert.id == alert_id, PriceAlert.user_id == user_id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Price alert not found")
    db.delete(row)
    db.commit()
    return {"ok": True}


@router.post("/check")
def check_price_alerts(payload: PriceAlertCheckRequest, db: Session = Depends(get_db)):
    prices = {str(k).upper(): float(v) for k, v in (payload.prices or {}).items()}
    if not prices:
        return {"triggered": []}
    q = db.query(PriceAlert).filter(PriceAlert.user_id == payload.user_id, PriceAlert.is_active.is_(True))
    if payload.list_type:
        q = q.filter(PriceAlert.list_type == payload.list_type.lower())
    alerts = q.all()
    triggered_rows: list[PriceAlertTrigger] = []
    for alert in alerts:
        current_price = prices.get(alert.symbol.upper())
        if current_price is None:
            continue
        threshold = float(alert.threshold_price)
        tolerance = max(0.05, threshold * 0.0002)  # 2 bps or 5 paise
        hit = (
            (alert.direction == "ABOVE" and current_price >= threshold)
            or (alert.direction == "BELOW" and current_price <= threshold)
            or (alert.direction == "AT" and abs(current_price - threshold) <= tolerance)
        )
        if not hit:
            continue
        alert.is_active = False
        alert.updated_at = datetime.utcnow()
        message = (
            f"Price alert triggered for {alert.symbol}: "
            f"{'AT' if alert.direction == 'AT' else alert.direction} {alert.threshold_price} (current {current_price})"
        )
        trig = PriceAlertTrigger(
            alert_id=alert.id,
            user_id=alert.user_id,
            symbol=alert.symbol,
            direction=alert.direction,
            threshold_price=alert.threshold_price,
            trigger_price=current_price,
            message=message,
        )
        db.add(trig)
        triggered_rows.append(trig)
    db.commit()
    for trig in triggered_rows:
        db.refresh(trig)
    return {"triggered": [_serialize_trigger(r) for r in triggered_rows]}


@router.get("/triggers")
def list_price_alert_triggers(user_id: str, limit: int = Query(default=100, ge=1, le=500), db: Session = Depends(get_db)):
    rows = (
        db.query(PriceAlertTrigger)
        .filter(PriceAlertTrigger.user_id == user_id)
        .order_by(PriceAlertTrigger.triggered_at.desc())
        .limit(limit)
        .all()
    )
    return {"data": [_serialize_trigger(r) for r in rows]}


@router.delete("/triggers/{trigger_id}")
def delete_price_alert_trigger(trigger_id: int, user_id: str, db: Session = Depends(get_db)):
    row = db.query(PriceAlertTrigger).filter(PriceAlertTrigger.id == trigger_id, PriceAlertTrigger.user_id == user_id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Alert history entry not found")
    db.delete(row)
    db.commit()
    return {"ok": True}


@router.delete("/triggers")
def clear_price_alert_triggers(user_id: str, db: Session = Depends(get_db)):
    rows = db.query(PriceAlertTrigger).filter(PriceAlertTrigger.user_id == user_id).all()
    for row in rows:
        db.delete(row)
    db.commit()
    return {"ok": True, "deleted": len(rows)}

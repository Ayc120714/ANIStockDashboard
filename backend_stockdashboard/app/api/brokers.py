from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.models import BrokerSetup
from app.db.session import get_db

router = APIRouter(prefix="/api/brokers", tags=["brokers"])


class BrokerExecutionToggleRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    broker: str = Field(default="dhan")
    live_enabled: bool = Field(default=False)


class BrokerSetupRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    broker: str = Field(..., min_length=1)
    client_id: str = Field(default="")
    is_enabled: bool = Field(default=False)
    has_session: bool = Field(default=False)


@router.get("/setup")
def list_broker_setup(user_id: str, db: Session = Depends(get_db)):
    rows = (
        db.query(BrokerSetup)
        .filter(BrokerSetup.user_id == user_id)
        .order_by(BrokerSetup.broker.asc())
        .all()
    )
    return {"data": [serialize_broker_setup(r) for r in rows]}


@router.post("/setup")
def upsert_broker_setup(payload: BrokerSetupRequest, db: Session = Depends(get_db)):
    row = (
        db.query(BrokerSetup)
        .filter(BrokerSetup.user_id == payload.user_id, BrokerSetup.broker == payload.broker.lower())
        .first()
    )
    if row is None:
        row = BrokerSetup(user_id=payload.user_id, broker=payload.broker.lower())
        db.add(row)
    row.client_id = payload.client_id
    row.is_enabled = payload.is_enabled
    row.has_session = payload.has_session
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return {"ok": True, "data": serialize_broker_setup(row)}


@router.post("/execution-mode")
def set_broker_execution_mode(payload: BrokerExecutionToggleRequest, db: Session = Depends(get_db)):
    row = (
        db.query(BrokerSetup)
        .filter(BrokerSetup.user_id == payload.user_id, BrokerSetup.broker == payload.broker.lower())
        .first()
    )
    if row is None:
        row = BrokerSetup(user_id=payload.user_id, broker=payload.broker.lower())
        db.add(row)
    row.live_enabled = bool(payload.live_enabled)
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return {"ok": True, "live_enabled": row.live_enabled}


def is_live_enabled(db: Session, user_id: str, broker: str = "dhan") -> bool:
    row = db.query(BrokerSetup).filter(BrokerSetup.user_id == user_id, BrokerSetup.broker == broker.lower()).first()
    return bool(row and row.live_enabled and row.is_enabled and row.has_session)


def serialize_broker_setup(row: BrokerSetup) -> dict:
    return {
        "user_id": row.user_id,
        "broker": row.broker,
        "client_id": row.client_id,
        "is_enabled": row.is_enabled,
        "has_session": row.has_session,
        "live_enabled": row.live_enabled,
        "last_auth_at": row.last_auth_at.isoformat() if row.last_auth_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }

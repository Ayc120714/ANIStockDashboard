from __future__ import annotations

import os
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
    has_session: bool | None = None


class BrokerSessionClearRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    broker: str | None = None


class BrokerValidateRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    broker: str = Field(default="dhan")
    client_id: str = Field(default="")
    pin: str = Field(default="")
    totp: str = Field(default="")
    api_key: str = Field(default="")
    client_secret: str = Field(default="")
    redirect_uri: str = Field(default="")
    auth_code: str = Field(default="")
    access_token: str = Field(default="")


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
    if payload.has_session is not None:
        row.has_session = bool(payload.has_session)
        if row.has_session:
            row.last_auth_at = datetime.utcnow()
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return {"ok": True, "data": serialize_broker_setup(row)}


@router.post("/session/clear")
def clear_broker_session(payload: BrokerSessionClearRequest, db: Session = Depends(get_db)):
    query = db.query(BrokerSetup).filter(BrokerSetup.user_id == payload.user_id)
    if payload.broker:
        query = query.filter(BrokerSetup.broker == payload.broker.lower())
    rows = query.all()
    now = datetime.utcnow()
    for row in rows:
        row.has_session = False
        row.updated_at = now
    db.commit()
    return {"ok": True, "cleared": len(rows)}


@router.post("/validate")
def validate_broker_setup(payload: BrokerValidateRequest, db: Session = Depends(get_db)):
    broker = (payload.broker or "dhan").lower()
    row = (
        db.query(BrokerSetup)
        .filter(BrokerSetup.user_id == payload.user_id, BrokerSetup.broker == broker)
        .first()
    )
    if row is None:
        row = BrokerSetup(user_id=payload.user_id, broker=broker)
        db.add(row)

    if broker == "dhan":
        has_totp_flow = bool(payload.client_id and payload.pin and payload.totp)
        has_token_flow = bool((payload.access_token or "").strip())
        if not (has_token_flow or has_totp_flow):
            row.client_id = payload.client_id or row.client_id
            row.is_enabled = True
            row.has_session = False
            row.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(row)
            return {
                "validated": False,
                "reason": "For Dhan live session, provide Access Token (JWT) and validate again.",
                "data": serialize_broker_setup(row),
            }
    elif broker == "upstox":
        if not (payload.access_token or payload.auth_code):
            return {"validated": False, "reason": "access_token or auth_code is required for Upstox validation."}
    elif broker == "angelone":
        has_token_flow = bool((payload.access_token or "").strip())
        has_totp_flow = bool(payload.client_id and payload.pin and payload.totp)
        if not (has_token_flow or has_totp_flow):
            return {"validated": False, "reason": "For AngelOne, provide access_token OR (client_id + pin + totp)."}
    elif broker == "samco":
        has_token_flow = bool((payload.access_token or "").strip())
        has_pin_flow = bool((payload.pin or "").strip())
        if not (has_token_flow or has_pin_flow):
            return {"validated": False, "reason": "For Samco, provide access_token or PIN/password."}

    row.client_id = payload.client_id or row.client_id
    row.is_enabled = True
    row.has_session = True if broker != "dhan" else bool(has_token_flow)
    row.last_auth_at = datetime.utcnow()
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return {"validated": True, "data": serialize_broker_setup(row)}


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
    # Default behavior: authenticated broker sessions execute in LIVE mode.
    # Set BROKER_FORCE_LIVE=0 to fall back to explicit live_enabled flag checks.
    force_live = str(os.getenv("BROKER_FORCE_LIVE", "1")).strip().lower() not in {"0", "false", "no", "off"}
    if force_live:
        return bool(row and row.is_enabled and row.has_session)
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

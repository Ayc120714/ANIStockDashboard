from __future__ import annotations

import json
from datetime import datetime
from urllib.parse import urlencode
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.models import BrokerSetup, OrderStatus, PortfolioPosition, TradeOrder
from app.db.session import get_db

router = APIRouter(prefix="/api/dhan", tags=["dhan"])

_SESSION_TOKEN_BY_USER: dict[str, str] = {}
_SESSION_EXPIRY_BY_USER: dict[str, str] = {}


class DhanConnectRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    client_id: str = Field(..., min_length=1)
    pin: str = Field(default="")
    totp: str = Field(default="")
    access_token: str = Field(default="")
    renew_token: bool = Field(default=False)


class DhanDisconnectRequest(BaseModel):
    user_id: str = Field(..., min_length=1)


class DhanRenewTokenRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    client_id: str = Field(default="")
    access_token: str = Field(default="")


def _get_or_create_row(db: Session, user_id: str) -> BrokerSetup:
    row = db.query(BrokerSetup).filter(BrokerSetup.user_id == user_id, BrokerSetup.broker == "dhan").first()
    if row is None:
        row = BrokerSetup(user_id=user_id, broker="dhan")
        db.add(row)
    return row


def _is_live_token(token: str) -> bool:
    t = str(token or "").strip()
    return bool(t) and not t.startswith("dhan_")


def _generate_access_token_from_totp(client_id: str, pin: str, totp: str) -> dict:
    qs = urlencode(
        {
            "dhanClientId": (client_id or "").strip(),
            "pin": (pin or "").strip(),
            "totp": (totp or "").strip(),
        }
    )
    req = Request(
        f"https://auth.dhan.co/app/generateAccessToken?{qs}",
        method="POST",
    )
    try:
        with urlopen(req, timeout=15) as resp:
            raw = resp.read().decode("utf-8", errors="ignore")
            return json.loads(raw) if raw else {}
    except HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore") if hasattr(e, "read") else ""
        raise HTTPException(status_code=502, detail=f"Dhan token generate failed ({e.code}): {body or e.reason}") from e
    except URLError as e:
        raise HTTPException(status_code=502, detail=f"Dhan token generate unreachable: {e.reason}") from e


def _renew_access_token(access_token: str, client_id: str) -> dict:
    req = Request(
        "https://api.dhan.co/v2/RenewToken",
        headers={
            "access-token": (access_token or "").strip(),
            "dhanClientId": (client_id or "").strip(),
        },
        method="GET",
    )
    try:
        with urlopen(req, timeout=15) as resp:
            raw = resp.read().decode("utf-8", errors="ignore")
            return json.loads(raw) if raw else {}
    except HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore") if hasattr(e, "read") else ""
        raise HTTPException(status_code=502, detail=f"Dhan token renew failed ({e.code}): {body or e.reason}") from e
    except URLError as e:
        raise HTTPException(status_code=502, detail=f"Dhan token renew unreachable: {e.reason}") from e


def _fetch_profile(access_token: str) -> dict:
    req = Request(
        "https://api.dhan.co/v2/profile",
        headers={
            "Content-Type": "application/json",
            "access-token": (access_token or "").strip(),
        },
        method="GET",
    )
    try:
        with urlopen(req, timeout=12) as resp:
            raw = resp.read().decode("utf-8", errors="ignore")
            return json.loads(raw) if raw else {}
    except HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore") if hasattr(e, "read") else ""
        raise HTTPException(status_code=502, detail=f"Dhan token validation failed ({e.code}): {body or e.reason}") from e
    except URLError as e:
        raise HTTPException(status_code=502, detail=f"Dhan profile API unreachable: {e.reason}") from e


@router.post("/connect")
def connect_dhan(payload: DhanConnectRequest, db: Session = Depends(get_db)):
    client_id = (payload.client_id or "").strip()
    pin = (payload.pin or "").strip()
    totp = (payload.totp or "").strip()
    access_token = (payload.access_token or "").strip()
    if not client_id:
        raise HTTPException(status_code=400, detail="client_id is required for Dhan connect.")

    token_source = "provided_token"
    expiry_time = None
    if payload.renew_token:
        if not access_token:
            access_token = str(_SESSION_TOKEN_BY_USER.get(payload.user_id) or "").strip()
        if not _is_live_token(access_token):
            raise HTTPException(status_code=400, detail="Valid active access token is required to renew.")
        renewed = _renew_access_token(access_token, client_id)
        access_token = str(renewed.get("accessToken") or "").strip()
        expiry_time = renewed.get("expiryTime")
        token_source = "renewed"
        if not access_token:
            raise HTTPException(status_code=502, detail="Dhan renew did not return accessToken.")
    elif not access_token:
        if not (pin and totp):
            raise HTTPException(status_code=400, detail="Provide access_token OR both pin and totp to generate a Dhan session.")
        generated = _generate_access_token_from_totp(client_id, pin, totp)
        access_token = str(generated.get("accessToken") or "").strip()
        expiry_time = generated.get("expiryTime")
        token_source = "generated_via_totp"
        if not access_token:
            raise HTTPException(status_code=502, detail="Dhan did not return accessToken while generating session.")

    profile = _fetch_profile(access_token)
    row = _get_or_create_row(db, payload.user_id)
    row.client_id = client_id
    row.is_enabled = True
    row.has_session = True
    row.last_auth_at = datetime.utcnow()
    row.updated_at = datetime.utcnow()
    token = access_token
    _SESSION_TOKEN_BY_USER[payload.user_id] = token
    if expiry_time:
        _SESSION_EXPIRY_BY_USER[payload.user_id] = str(expiry_time)
    db.commit()
    db.refresh(row)
    return {
        "ok": True,
        "connected": True,
        "session_token": token,
        "token_source": token_source,
        "token_expiry": expiry_time,
        "profile": profile,
        "data": {
            "user_id": row.user_id,
            "broker": row.broker,
            "client_id": row.client_id,
            "has_session": row.has_session,
            "last_auth_at": row.last_auth_at.isoformat() if row.last_auth_at else None,
        },
    }


@router.post("/disconnect")
def disconnect_dhan(payload: DhanDisconnectRequest, db: Session = Depends(get_db)):
    row = _get_or_create_row(db, payload.user_id)
    row.has_session = False
    row.updated_at = datetime.utcnow()
    _SESSION_TOKEN_BY_USER.pop(payload.user_id, None)
    _SESSION_EXPIRY_BY_USER.pop(payload.user_id, None)
    db.commit()
    return {"ok": True, "connected": False}


@router.get("/status")
def dhan_status(user_id: str, db: Session = Depends(get_db)):
    row = db.query(BrokerSetup).filter(BrokerSetup.user_id == user_id, BrokerSetup.broker == "dhan").first()
    has_session = bool(row and row.has_session and row.is_enabled)
    return {
        "ok": True,
        "connected": has_session,
        "has_session": has_session,
        "session_token": _SESSION_TOKEN_BY_USER.get(user_id),
        "token_expiry": _SESSION_EXPIRY_BY_USER.get(user_id),
        "last_auth_at": row.last_auth_at.isoformat() if row and row.last_auth_at else None,
    }


@router.post("/renew-token")
def renew_dhan_token(payload: DhanRenewTokenRequest, db: Session = Depends(get_db)):
    row = _get_or_create_row(db, payload.user_id)
    client_id = (payload.client_id or row.client_id or "").strip()
    token = (payload.access_token or _SESSION_TOKEN_BY_USER.get(payload.user_id) or "").strip()
    if not client_id:
        raise HTTPException(status_code=400, detail="client_id is required to renew Dhan token.")
    if not _is_live_token(token):
        raise HTTPException(status_code=400, detail="Valid live access token is required before renew.")

    renewed = _renew_access_token(token, client_id)
    renewed_token = str(renewed.get("accessToken") or "").strip()
    expiry_time = renewed.get("expiryTime")
    if not renewed_token:
        raise HTTPException(status_code=502, detail="Dhan renew did not return accessToken.")
    _SESSION_TOKEN_BY_USER[payload.user_id] = renewed_token
    if expiry_time:
        _SESSION_EXPIRY_BY_USER[payload.user_id] = str(expiry_time)
    row.client_id = client_id
    row.is_enabled = True
    row.has_session = True
    row.last_auth_at = datetime.utcnow()
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return {
        "ok": True,
        "connected": True,
        "session_token": renewed_token,
        "token_expiry": expiry_time,
        "data": {
            "user_id": row.user_id,
            "broker": row.broker,
            "client_id": row.client_id,
            "has_session": row.has_session,
            "last_auth_at": row.last_auth_at.isoformat() if row.last_auth_at else None,
        },
    }


def _serialize_position(row: PortfolioPosition) -> dict:
    return {
        "securityId": row.symbol,
        "tradingSymbol": row.symbol,
        "productType": row.product_type.value,
        "netQty": row.net_qty,
        "buyAvg": row.avg_price,
        "ltp": row.ltp,
        "pnl": row.unrealized_pnl,
        "realizedPnl": row.realized_pnl,
        "state": row.state.value,
        "updatedAt": row.updated_at.isoformat(),
    }


def _fetch_dhan_json(*, user_id: str, path: str, db: Session):
    token = (_SESSION_TOKEN_BY_USER.get(user_id) or "").strip()
    if not _is_live_token(token):
        raise HTTPException(status_code=400, detail="Dhan live session is not active. Connect with valid access token.")

    def _call_with_token(tok: str):
        req = Request(
            f"https://api.dhan.co/v2/{path.lstrip('/')}",
            headers={
                "Content-Type": "application/json",
                "access-token": tok,
            },
            method="GET",
        )
        with urlopen(req, timeout=12) as resp:
            raw = resp.read().decode("utf-8", errors="ignore")
            try:
                return json.loads(raw)
            except Exception:
                return None
    try:
        return _call_with_token(token)
    except HTTPError as e:
        # Try one renew-and-retry pass for expired tokens.
        if e.code in {401, 403}:
            row = db.query(BrokerSetup).filter(BrokerSetup.user_id == user_id, BrokerSetup.broker == "dhan").first()
            client_id = (row.client_id if row else "").strip()
            if not client_id:
                raise HTTPException(status_code=400, detail="Dhan client_id missing; cannot renew token.")
            try:
                renewed = _renew_access_token(token, client_id)
                renewed_token = str(renewed.get("accessToken") or "").strip()
                if not renewed_token:
                    raise HTTPException(status_code=502, detail="Dhan renew token API did not return a new access token.")
                _SESSION_TOKEN_BY_USER[user_id] = renewed_token
                expiry_time = renewed.get("expiryTime")
                if expiry_time:
                    _SESSION_EXPIRY_BY_USER[user_id] = str(expiry_time)
                return _call_with_token(renewed_token)
            except HTTPException:
                raise
        body = e.read().decode("utf-8", errors="ignore") if hasattr(e, "read") else ""
        raise HTTPException(status_code=502, detail=f"Dhan API error ({e.code}): {body or e.reason}") from e
    except URLError as e:
        raise HTTPException(status_code=502, detail=f"Dhan API unreachable: {e.reason}") from e


@router.get("/positions")
def dhan_positions(user_id: str, db: Session = Depends(get_db)):
    live = _fetch_dhan_json(user_id=user_id, path="positions", db=db)
    if isinstance(live, list):
        return {"ok": True, "source": "dhan_live", "data": live}
    if isinstance(live, dict):
        rows = live.get("data") if isinstance(live.get("data"), list) else live
        return {"ok": True, "source": "dhan_live", "data": rows}
    raise HTTPException(status_code=502, detail="Unexpected Dhan positions response format.")


@router.get("/holdings")
def dhan_holdings(user_id: str, db: Session = Depends(get_db)):
    live = _fetch_dhan_json(user_id=user_id, path="holdings", db=db)
    if isinstance(live, list):
        return {"ok": True, "source": "dhan_live", "data": live}
    if isinstance(live, dict):
        rows = live.get("data") if isinstance(live.get("data"), list) else live
        return {"ok": True, "source": "dhan_live", "data": rows}
    raise HTTPException(status_code=502, detail="Unexpected Dhan holdings response format.")


@router.get("/orders")
def dhan_orders(user_id: str, db: Session = Depends(get_db)):
    live = _fetch_dhan_json(user_id=user_id, path="orders", db=db)
    if isinstance(live, list):
        return {"ok": True, "source": "dhan_live", "data": live}
    if isinstance(live, dict):
        rows = live.get("data") if isinstance(live.get("data"), list) else live
        return {"ok": True, "source": "dhan_live", "data": rows}
    raise HTTPException(status_code=502, detail="Unexpected Dhan orders response format.")

from __future__ import annotations

import json
import os
from datetime import datetime
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.brokers import is_live_enabled
from app.db.models import (
    ExecutionMode,
    OrderChargeBreakup,
    OrderProductType,
    OrderSide,
    OrderStatus,
    OrderType,
    PortfolioPosition,
    BrokerSetup,
    SymbolLeverage,
    TradeOrder,
)
from app.db.session import get_db
from app.api.dhan import _SESSION_TOKEN_BY_USER
from app.services.charges import calculate_charges
from app.services.portfolio_manager import apply_order_fill_to_portfolio

router = APIRouter(prefix="/api/orders", tags=["orders"])

BROKER_LEVERAGE = {
    "dhan": {"INTRADAY": 5.0, "MARGIN": 4.0, "DELIVERY": 1.0},
    "angelone": {"INTRADAY": 5.0, "MARGIN": 4.0, "DELIVERY": 1.0},
    "samco": {"INTRADAY": 5.0, "MARGIN": 4.0, "DELIVERY": 1.0},
    "upstox": {"INTRADAY": 5.0, "MARGIN": 4.0, "DELIVERY": 1.0},
}


def _normalize_exchange_status(raw_status: str | None) -> OrderStatus | None:
    if not raw_status:
        return None
    status = str(raw_status).strip().upper()
    mapping = {
        "NEW": OrderStatus.NEW,
        "OPEN": OrderStatus.PLACED,
        "PLACED": OrderStatus.PLACED,
        "PENDING": OrderStatus.PLACED,
        "TRIGGER_PENDING": OrderStatus.PLACED,
        "PARTIAL": OrderStatus.PARTIAL,
        "PARTIALLY_FILLED": OrderStatus.PARTIAL,
        "FILLED": OrderStatus.FILLED,
        "COMPLETE": OrderStatus.FILLED,
        "CANCELED": OrderStatus.CANCELED,
        "CANCELLED": OrderStatus.CANCELED,
        "REJECTED": OrderStatus.REJECTED,
    }
    return mapping.get(status)


def _is_exchange_acknowledged(order: TradeOrder) -> bool:
    if order.execution_mode != ExecutionMode.LIVE:
        return False
    return bool(
        (order.broker_order_id or "").strip()
        and order.status in {OrderStatus.PLACED, OrderStatus.PARTIAL, OrderStatus.FILLED}
    )


class PlaceOrderRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    broker: str = Field(default="dhan")
    symbol: str = Field(..., min_length=1)
    side: OrderSide
    product_type: OrderProductType
    order_type: OrderType = Field(default=OrderType.MARKET)
    qty: int = Field(..., gt=0)
    price: float = Field(default=0.0, ge=0.0)
    strategy_tag: str | None = None
    strategy_payload: dict | None = None
    client_order_ref: str | None = None


class OcoTargetUpdateRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    target_price: float = Field(..., gt=0)


def _serialize_order(order: TradeOrder) -> dict:
    breakup = order.charge_breakup
    return {
        "id": order.id,
        "order_uuid": order.order_uuid,
        "user_id": order.user_id,
        "broker": order.broker,
        "symbol": order.symbol,
        "side": order.side.value,
        "product_type": order.product_type.value,
        "order_type": order.order_type.value,
        "qty": order.qty,
        "price": order.price,
        "status": order.status.value,
        "execution_mode": order.execution_mode.value,
        "broker_order_id": order.broker_order_id,
        "client_order_ref": order.client_order_ref,
        "average_fill_price": order.average_fill_price,
        "filled_qty": order.filled_qty,
        "remaining_qty": order.remaining_qty,
        "rejection_reason": order.rejection_reason,
        "strategy_tag": order.strategy_tag,
        "strategy_payload": json.loads(order.strategy_payload) if order.strategy_payload else None,
        "created_at": order.created_at.isoformat(),
        "updated_at": order.updated_at.isoformat(),
        "exchange_order_acknowledged": _is_exchange_acknowledged(order),
        "charge_breakup": {
            "brokerage": breakup.brokerage,
            "stt": breakup.stt,
            "gst": breakup.gst,
            "stamp_duty": breakup.stamp_duty,
            "exchange_txn_charge": breakup.exchange_txn_charge,
            "sebi_charge": breakup.sebi_charge,
            "ipft_charge": breakup.ipft_charge,
            "dp_charge": breakup.dp_charge,
            "total_charges": breakup.total_charges,
        }
        if breakup
        else None,
    }


def _resolve_effective_fill_price(order: TradeOrder) -> float:
    if float(order.average_fill_price or 0) > 0:
        return float(order.average_fill_price)
    return float(order.price or 0)


def _leverage_multiplier(broker: str, product_type: str) -> float:
    b = (broker or "dhan").lower()
    p = (product_type or "DELIVERY").upper()
    return float(BROKER_LEVERAGE.get(b, BROKER_LEVERAGE["dhan"]).get(p, 1.0))


def _normalize_leverage_overrides(raw: dict | None) -> dict:
    if not isinstance(raw, dict):
        return {}
    normalized: dict[str, dict[str, float]] = {}
    for broker_name, products in raw.items():
        if not broker_name or not isinstance(products, dict):
            continue
        b = str(broker_name).lower()
        product_map: dict[str, float] = {}
        for product_name, leverage in products.items():
            if not product_name:
                continue
            try:
                lev = float(leverage)
            except (TypeError, ValueError):
                continue
            if lev <= 0:
                continue
            product_map[str(product_name).upper()] = lev
        if product_map:
            normalized[b] = product_map
    return normalized


def _lookup_symbol_leverage(db: Session, broker: str, symbol: str, product_type: str) -> float | None:
    b = (broker or "dhan").lower()
    s = (symbol or "").upper()
    p = (product_type or "DELIVERY").upper()
    if not s:
        return None
    row = db.query(SymbolLeverage).filter(SymbolLeverage.broker == b, SymbolLeverage.symbol == s).first()
    if row is None:
        return None
    if p == "INTRADAY":
        return float(row.intraday_leverage) if row.intraday_leverage and row.intraday_leverage > 0 else None
    if p == "MARGIN":
        return float(row.margin_leverage) if row.margin_leverage and row.margin_leverage > 0 else None
    if p == "DELIVERY":
        return float(row.delivery_leverage) if row.delivery_leverage and row.delivery_leverage > 0 else None
    return None


def _resolve_order_leverage(
    broker: str,
    product_type: str,
    strategy_payload: dict | None = None,
    db: Session | None = None,
    symbol: str | None = None,
) -> float:
    b = (broker or "dhan").lower()
    p = (product_type or "DELIVERY").upper()
    overrides = _normalize_leverage_overrides((strategy_payload or {}).get("leverage_overrides"))
    overridden = overrides.get(b, {}).get(p)
    if overridden and overridden > 0:
        return float(overridden)
    if db is not None:
        db_value = _lookup_symbol_leverage(db, b, symbol or "", p)
        if db_value and db_value > 0:
            return float(db_value)
    return _leverage_multiplier(b, p)


def _get_user_available_funds(db: Session, user_id: str, base_capital: float) -> float:
    rows = (
        db.query(TradeOrder)
        .filter(
            TradeOrder.user_id == user_id,
            TradeOrder.status.in_([OrderStatus.FILLED, OrderStatus.PARTIAL]),
        )
        .all()
    )
    available = float(base_capital)
    for row in rows:
        filled_qty = int(row.filled_qty or 0)
        if filled_qty <= 0:
            continue
        turnover = float(filled_qty) * _resolve_effective_fill_price(row)
        charges = float(row.charge_breakup.total_charges) if row.charge_breakup else 0.0
        strategy_payload = json.loads(row.strategy_payload or "{}") if row.strategy_payload else {}
        leverage = _resolve_order_leverage(
            row.broker,
            row.product_type.value,
            strategy_payload=strategy_payload,
            db=db,
            symbol=row.symbol,
        )
        required_capital = (turnover / max(leverage, 1.0)) + charges
        if row.side == OrderSide.BUY:
            available -= required_capital
        elif row.side == OrderSide.SELL and row.product_type == OrderProductType.INTRADAY:
            available -= required_capital
        else:
            available += max(turnover - charges, 0.0)
    return available


def _requires_funds_check(side: OrderSide, product_type: OrderProductType) -> bool:
    if side == OrderSide.BUY:
        return True
    # For sell-side funds checks, only intraday short sells are supported.
    return side == OrderSide.SELL and product_type == OrderProductType.INTRADAY


def _map_dhan_product(product_type: str) -> str:
    p = (product_type or "").upper()
    if p == "INTRADAY":
        return "INTRA"
    if p == "MARGIN":
        return "MARGIN"
    return "CNC"


def _map_dhan_order_type(order_type: str) -> str:
    o = (order_type or "").upper()
    return "LIMIT" if o == "LIMIT" else "MARKET"


def _place_live_order_via_dhan_api(
    *,
    db: Session,
    user_id: str,
    symbol: str,
    side: str,
    product_type: str,
    qty: int,
    price: float,
    order_type: str,
    correlation_id: str,
) -> dict:
    token = str(_SESSION_TOKEN_BY_USER.get(user_id) or "").strip()
    if not token or token.startswith("dhan_"):
        raise HTTPException(status_code=400, detail="Dhan live session token not available. Connect Dhan first.")

    setup = db.query(BrokerSetup).filter(BrokerSetup.user_id == user_id, BrokerSetup.broker == "dhan").first()
    if not setup or not setup.client_id or not setup.has_session:
        raise HTTPException(status_code=400, detail="Dhan broker setup is incomplete for this user.")

    payload = {
        "securityId": symbol,
        "exchangeSegment": "NSE_EQ",
        "transactionType": (side or "").upper(),
        "quantity": int(qty),
        "orderType": _map_dhan_order_type(order_type),
        "productType": _map_dhan_product(product_type),
        "price": float(price or 0.0),
        "triggerPrice": 0.0,
        "validity": "DAY",
        "correlationId": correlation_id,
    }
    req = Request(
        "https://api.dhan.co/v2/orders",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "access-token": token,
            "dhanClientId": setup.client_id,
        },
        method="POST",
    )
    try:
        with urlopen(req, timeout=15) as resp:
            raw = resp.read().decode("utf-8", errors="ignore")
            data = json.loads(raw) if raw else {}
    except HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore") if hasattr(e, "read") else ""
        raise HTTPException(status_code=502, detail=f"Dhan place order failed ({e.code}): {body or e.reason}") from e
    except URLError as e:
        raise HTTPException(status_code=502, detail=f"Dhan order API unreachable: {e.reason}") from e

    broker_order_id = (
        data.get("orderId")
        or data.get("order_id")
        or data.get("oms_order_id")
        or data.get("id")
    )
    status = str(data.get("orderStatus") or data.get("status") or "PLACED").upper()
    if not broker_order_id:
        raise HTTPException(status_code=502, detail=f"Dhan order response missing order id: {data}")
    return {
        "broker_order_id": str(broker_order_id),
        "status": status,
        "filled_qty": int(data.get("filledQty") or data.get("filled_qty") or 0),
        "average_fill_price": float(data.get("averagePrice") or data.get("average_fill_price") or 0.0),
        "raw_payload": data,
    }


@router.post("/place")
def place_order(payload: PlaceOrderRequest, db: Session = Depends(get_db)):
    broker = (payload.broker or "dhan").lower()
    live_mode = is_live_enabled(db, payload.user_id, broker=broker)
    if not live_mode:
        raise HTTPException(status_code=400, detail="Live broker session is required. Paper/simulated mode is disabled.")
    execution_mode = ExecutionMode.LIVE
    turnover = float(payload.qty) * float(payload.price or 0.0)
    starting_capital = float(os.getenv("PAPER_STARTING_CAPITAL", "100000"))

    if payload.side == OrderSide.SELL and payload.product_type == OrderProductType.MARGIN:
        raise HTTPException(status_code=400, detail="MTF does not support SELL. Use INTRADAY for sell orders.")

    estimated_charges = calculate_charges(
        broker=broker,
        product_type=payload.product_type.value,
        side=payload.side.value,
        turnover=turnover,
        is_sell_delivery=payload.side == OrderSide.SELL and payload.product_type == OrderProductType.DELIVERY,
    )
    strategy_payload = dict(payload.strategy_payload or {})
    normalized_overrides = _normalize_leverage_overrides(strategy_payload.get("leverage_overrides"))
    if normalized_overrides:
        strategy_payload["leverage_overrides"] = normalized_overrides
    leverage = _resolve_order_leverage(
        broker,
        payload.product_type.value,
        strategy_payload=strategy_payload,
        db=db,
        symbol=payload.symbol,
    )
    required_amount = (turnover / max(leverage, 1.0)) + float(estimated_charges.get("total_charges") or 0.0)
    available_amount = _get_user_available_funds(db, payload.user_id, base_capital=starting_capital)
    funds_check_applies = _requires_funds_check(payload.side, payload.product_type)
    if funds_check_applies and required_amount > available_amount:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Insufficient funds: need ₹{required_amount:.2f}, "
                f"available ₹{available_amount:.2f}. Reduce quantity or price."
            ),
        )

    order = TradeOrder(
        user_id=payload.user_id,
        broker=broker,
        symbol=payload.symbol.upper(),
        side=payload.side,
        product_type=payload.product_type,
        order_type=payload.order_type,
        qty=payload.qty,
        price=payload.price,
        status=OrderStatus.NEW,
        execution_mode=execution_mode,
        client_order_ref=payload.client_order_ref or f"ord-{uuid4().hex[:22]}",
        strategy_tag=payload.strategy_tag,
        strategy_payload=json.dumps(strategy_payload),
        remaining_qty=payload.qty,
    )
    db.add(order)
    db.flush()

    db.add(OrderChargeBreakup(trade_order_id=order.id, **estimated_charges, tax_payload=json.dumps(estimated_charges)))

    broker_result = _place_live_order_via_dhan_api(
        db=db,
        user_id=payload.user_id,
        symbol=payload.symbol.upper(),
        side=payload.side.value,
        product_type=payload.product_type.value,
        qty=payload.qty,
        price=payload.price,
        order_type=payload.order_type.value,
        correlation_id=order.client_order_ref,
    )
    broker_order_id = str(broker_result.get("broker_order_id") or "").strip()
    normalized_status = _normalize_exchange_status(broker_result.get("status"))
    raw_payload = broker_result.get("raw_payload") or {}

    order.broker_order_id = broker_order_id or None
    order.raw_broker_payload = json.dumps(raw_payload)

    if not broker_order_id:
        order.status = OrderStatus.REJECTED
        order.rejection_reason = "Exchange placement not acknowledged (missing broker order ID)."
        order.average_fill_price = 0.0
        order.filled_qty = 0
        order.remaining_qty = payload.qty
    elif normalized_status is None:
        order.status = OrderStatus.REJECTED
        order.rejection_reason = f"Unknown exchange status: {broker_result.get('status')}"
        order.average_fill_price = 0.0
        order.filled_qty = 0
        order.remaining_qty = payload.qty
    else:
        order.status = normalized_status
        order.average_fill_price = float(broker_result.get("average_fill_price") or 0.0)
        filled = int(broker_result.get("filled_qty") or 0)
        order.filled_qty = min(max(filled, 0), payload.qty)
        order.remaining_qty = max(payload.qty - order.filled_qty, 0)
        if order.status == OrderStatus.REJECTED:
            order.rejection_reason = broker_result.get("rejection_reason") or "Exchange rejected order."

    order.updated_at = datetime.utcnow()
    apply_order_fill_to_portfolio(db, order)
    db.commit()
    db.refresh(order)
    return {
        "ok": True,
        "data": _serialize_order(order),
        "exchange": {
            "mode": order.execution_mode.value,
            "broker_order_id": order.broker_order_id,
            "status": order.status.value,
            "placed": _is_exchange_acknowledged(order),
            "reason": order.rejection_reason,
        },
        "funds_check": {
            "checked": funds_check_applies,
            "leverage_used": leverage,
            "required_amount": round(required_amount, 2),
            "available_amount_before": round(available_amount, 2),
            "sufficient": (required_amount <= available_amount) if funds_check_applies else True,
        },
    }


@router.get("")
def list_orders(
    user_id: str,
    status: str | None = Query(default=None),
    symbol: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    query = db.query(TradeOrder).filter(TradeOrder.user_id == user_id)
    if status:
        query = query.filter(TradeOrder.status == OrderStatus(status.upper()))
    if symbol:
        query = query.filter(TradeOrder.symbol == symbol.upper())
    rows = query.order_by(TradeOrder.created_at.desc()).limit(200).all()
    return {"data": [_serialize_order(row) for row in rows]}


@router.get("/{order_id}")
def get_order(order_id: int, user_id: str, db: Session = Depends(get_db)):
    row = db.query(TradeOrder).filter(TradeOrder.id == order_id, TradeOrder.user_id == user_id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"data": _serialize_order(row)}


@router.post("/{order_id}/cancel")
def cancel_order(order_id: int, user_id: str, db: Session = Depends(get_db)):
    row = db.query(TradeOrder).filter(TradeOrder.id == order_id, TradeOrder.user_id == user_id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Order not found")
    if row.status in {OrderStatus.CANCELED, OrderStatus.REJECTED, OrderStatus.CLOSED}:
        return {"ok": True, "data": _serialize_order(row)}
    if row.status == OrderStatus.FILLED:
        raise HTTPException(status_code=400, detail="Filled orders cannot be canceled")

    row.status = OrderStatus.CANCELED
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return {"ok": True, "data": _serialize_order(row)}


@router.post("/{order_id}/trail-sl-to-cost")
def trail_sl_to_cost(order_id: int, user_id: str, db: Session = Depends(get_db)):
    row = db.query(TradeOrder).filter(TradeOrder.id == order_id, TradeOrder.user_id == user_id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Order not found")
    if row.status in {OrderStatus.CANCELED, OrderStatus.REJECTED, OrderStatus.CLOSED}:
        raise HTTPException(status_code=400, detail="Cannot trail SL for closed/canceled/rejected order")

    payload = json.loads(row.strategy_payload or "{}")
    entry_price = float(row.average_fill_price or row.price or 0.0)
    if entry_price <= 0:
        raise HTTPException(status_code=400, detail="Entry price unavailable for trailing SL")

    payload["stop_loss"] = entry_price
    payload["trail_sl_to_cost"] = True
    payload["trail_sl_to_cost_approved_at"] = datetime.utcnow().isoformat()
    row.strategy_payload = json.dumps(payload)
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return {"ok": True, "data": _serialize_order(row)}


@router.post("/{order_id}/oco-target-update")
def oco_target_update(order_id: int, payload: OcoTargetUpdateRequest, db: Session = Depends(get_db)):
    row = db.query(TradeOrder).filter(TradeOrder.id == order_id, TradeOrder.user_id == payload.user_id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Order not found")
    if row.status in {OrderStatus.CANCELED, OrderStatus.REJECTED, OrderStatus.CLOSED}:
        raise HTTPException(status_code=400, detail="Cannot update target for closed/canceled/rejected order")

    strategy_payload = json.loads(row.strategy_payload or "{}")
    if strategy_payload.get("requested_order_type") != "SUPER":
        raise HTTPException(status_code=400, detail="OCO target update is supported only for SUPER orders")

    strategy_payload["oco_order_type"] = "OCO"
    strategy_payload["target_2"] = float(payload.target_price)
    strategy_payload["oco_target_updated_at"] = datetime.utcnow().isoformat()
    row.strategy_payload = json.dumps(strategy_payload)
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return {"ok": True, "data": _serialize_order(row)}


@router.get("/portfolio/positions")
def list_portfolio_positions(user_id: str, db: Session = Depends(get_db)):
    rows = (
        db.query(PortfolioPosition)
        .filter(PortfolioPosition.user_id == user_id)
        .order_by(PortfolioPosition.updated_at.desc())
        .all()
    )
    return {
        "data": [
            {
                "id": row.id,
                "broker": row.broker,
                "symbol": row.symbol,
                "product_type": row.product_type.value,
                "net_qty": row.net_qty,
                "avg_price": row.avg_price,
                "ltp": row.ltp,
                "realized_pnl": row.realized_pnl,
                "unrealized_pnl": row.unrealized_pnl,
                "state": row.state.value,
                "next_move": row.next_move,
                "updated_at": row.updated_at.isoformat(),
            }
            for row in rows
        ]
    }

from __future__ import annotations

import json
from datetime import datetime

from sqlalchemy.orm import Session

from app.db.models import OrderStatus, PortfolioPosition, PositionState, TradeOrder
from app.services.brokers.dhan_execution import fetch_dhan_order_updates


def _next_move_for_position(position: PortfolioPosition) -> str:
    if position.net_qty == 0:
        return "ExitTarget" if position.realized_pnl >= 0 else "ExitSL"
    if position.unrealized_pnl > 0:
        return "TrailSL"
    if position.unrealized_pnl < 0:
        return "Hold"
    return "BookPartial"


def apply_order_fill_to_portfolio(db: Session, order: TradeOrder) -> PortfolioPosition | None:
    if order.status not in {OrderStatus.FILLED, OrderStatus.PARTIAL, OrderStatus.CLOSED}:
        return None

    position = (
        db.query(PortfolioPosition)
        .filter(
            PortfolioPosition.user_id == order.user_id,
            PortfolioPosition.broker == order.broker,
            PortfolioPosition.symbol == order.symbol,
            PortfolioPosition.product_type == order.product_type,
        )
        .first()
    )
    if position is None:
        position = PortfolioPosition(
            user_id=order.user_id,
            broker=order.broker,
            symbol=order.symbol,
            product_type=order.product_type,
        )
        db.add(position)
        db.flush()

    signed_qty = order.filled_qty if order.side.value == "BUY" else -order.filled_qty
    next_qty = position.net_qty + signed_qty
    if next_qty != 0 and order.filled_qty > 0:
        weighted_value = (position.avg_price * max(position.net_qty, 0)) + (order.average_fill_price * order.filled_qty)
        position.avg_price = weighted_value / max(next_qty, 1)
    position.net_qty = next_qty
    position.ltp = order.average_fill_price or position.ltp
    position.unrealized_pnl = (position.ltp - position.avg_price) * position.net_qty
    if position.net_qty == 0:
        position.realized_pnl += position.unrealized_pnl
        position.unrealized_pnl = 0.0
        position.state = PositionState.CLOSED
        order.status = OrderStatus.CLOSED
    else:
        position.state = PositionState.OPEN
    position.next_move = _next_move_for_position(position)
    position.last_order_uuid = order.order_uuid
    position.updated_at = datetime.utcnow()
    return position


def reconcile_broker_orders(db: Session) -> int:
    updates = fetch_dhan_order_updates()
    count = 0
    for update in updates:
        order = db.query(TradeOrder).filter(TradeOrder.broker_order_id == update["broker_order_id"]).first()
        if order is None:
            continue
        mapped_status = update["status"].upper()
        if mapped_status not in OrderStatus.__members__:
            continue
        order.status = OrderStatus[mapped_status]
        order.filled_qty = int(update.get("filled_qty") or order.filled_qty)
        order.average_fill_price = float(update.get("average_fill_price") or order.average_fill_price)
        order.remaining_qty = max(order.qty - order.filled_qty, 0)
        order.raw_broker_payload = json.dumps(update.get("raw_payload") or {})
        order.updated_at = datetime.utcnow()
        apply_order_fill_to_portfolio(db, order)
        count += 1
    if count:
        db.commit()
    return count

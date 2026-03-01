from __future__ import annotations

from datetime import datetime
from random import random
from uuid import uuid4


_BROKER_ORDER_BOOK: dict[str, dict] = {}


def _map_product_type(product_type: str) -> str:
    return {
        "INTRADAY": "INTRADAY",
        "MARGIN": "MARGIN",
        "DELIVERY": "CNC",
    }.get((product_type or "").upper(), "INTRADAY")


def execute_dhan_order(
    *,
    symbol: str,
    side: str,
    product_type: str,
    qty: int,
    price: float,
    order_type: str,
    client_order_ref: str,
) -> dict:
    broker_order_id = f"DHAN-{uuid4().hex[:12].upper()}"
    mapped_payload = {
        "securityId": symbol,
        "transactionType": side.upper(),
        "productType": _map_product_type(product_type),
        "quantity": qty,
        "price": price,
        "orderType": order_type.upper(),
        "correlationId": client_order_ref,
        "timestamp": datetime.utcnow().isoformat(),
    }

    simulated_fill_ratio = 1.0 if random() > 0.2 else 0.5
    filled_qty = int(qty * simulated_fill_ratio)
    status = "FILLED" if filled_qty == qty else "PARTIAL"
    avg_fill_price = price

    _BROKER_ORDER_BOOK[broker_order_id] = {
        "status": status,
        "filled_qty": filled_qty,
        "average_fill_price": avg_fill_price,
        "raw_payload": mapped_payload,
    }
    return {
        "broker_order_id": broker_order_id,
        "status": status,
        "filled_qty": filled_qty,
        "average_fill_price": avg_fill_price,
        "raw_payload": mapped_payload,
    }


def cancel_dhan_order(*, broker_order_id: str) -> dict:
    row = _BROKER_ORDER_BOOK.get(broker_order_id)
    if row is None:
        return {"ok": False, "reason": "missing_order"}
    if row["status"] == "FILLED":
        return {"ok": False, "reason": "already_filled"}
    row["status"] = "CANCELED"
    return {"ok": True}


def fetch_dhan_order_updates() -> list[dict]:
    updates: list[dict] = []
    for broker_order_id, row in _BROKER_ORDER_BOOK.items():
        updates.append(
            {
                "broker_order_id": broker_order_id,
                "status": row["status"],
                "filled_qty": row["filled_qty"],
                "average_fill_price": row["average_fill_price"],
                "raw_payload": row["raw_payload"],
            }
        )
    return updates

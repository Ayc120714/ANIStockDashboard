from __future__ import annotations

from datetime import datetime
from enum import Enum
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Enum as SQLEnum, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .session import Base


class OrderSide(str, Enum):
    BUY = "BUY"
    SELL = "SELL"


class OrderProductType(str, Enum):
    INTRADAY = "INTRADAY"
    MARGIN = "MARGIN"
    DELIVERY = "DELIVERY"


class OrderType(str, Enum):
    MARKET = "MARKET"
    LIMIT = "LIMIT"


class OrderStatus(str, Enum):
    NEW = "NEW"
    PLACED = "PLACED"
    PARTIAL = "PARTIAL"
    FILLED = "FILLED"
    CANCELED = "CANCELED"
    REJECTED = "REJECTED"
    CLOSED = "CLOSED"


class ExecutionMode(str, Enum):
    PAPER = "PAPER"
    LIVE = "LIVE"


class PositionState(str, Enum):
    OPEN = "OPEN"
    CLOSED = "CLOSED"


class BrokerSetup(Base):
    __tablename__ = "broker_setups"
    __table_args__ = (UniqueConstraint("user_id", "broker", name="uq_broker_setup_user"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    broker: Mapped[str] = mapped_column(String(32), index=True)
    client_id: Mapped[str] = mapped_column(String(64), default="")
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    has_session: Mapped[bool] = mapped_column(Boolean, default=False)
    last_auth_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    live_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class TradeOrder(Base):
    __tablename__ = "trade_orders"
    __table_args__ = (
        UniqueConstraint("client_order_ref", name="uq_trade_order_client_ref"),
        UniqueConstraint("broker", "broker_order_id", name="uq_trade_order_broker_order_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_uuid: Mapped[str] = mapped_column(String(64), default=lambda: str(uuid4()), unique=True, index=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    broker: Mapped[str] = mapped_column(String(32), default="dhan", index=True)
    symbol: Mapped[str] = mapped_column(String(64), index=True)
    side: Mapped[OrderSide] = mapped_column(SQLEnum(OrderSide), index=True)
    product_type: Mapped[OrderProductType] = mapped_column(SQLEnum(OrderProductType))
    order_type: Mapped[OrderType] = mapped_column(SQLEnum(OrderType), default=OrderType.MARKET)
    qty: Mapped[int] = mapped_column(Integer)
    price: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[OrderStatus] = mapped_column(SQLEnum(OrderStatus), default=OrderStatus.NEW, index=True)
    execution_mode: Mapped[ExecutionMode] = mapped_column(SQLEnum(ExecutionMode), default=ExecutionMode.PAPER)
    broker_order_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    client_order_ref: Mapped[str] = mapped_column(String(96), index=True)
    strategy_tag: Mapped[str | None] = mapped_column(String(96), nullable=True)
    strategy_payload: Mapped[str | None] = mapped_column(Text, nullable=True)
    average_fill_price: Mapped[float] = mapped_column(Float, default=0.0)
    filled_qty: Mapped[int] = mapped_column(Integer, default=0)
    remaining_qty: Mapped[int] = mapped_column(Integer, default=0)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_broker_payload: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    fills: Mapped[list["TradeFill"]] = relationship("TradeFill", back_populates="order", cascade="all, delete-orphan")
    charge_breakup: Mapped["OrderChargeBreakup"] = relationship(
        "OrderChargeBreakup", back_populates="order", uselist=False, cascade="all, delete-orphan"
    )


class TradeFill(Base):
    __tablename__ = "trade_fills"
    __table_args__ = (UniqueConstraint("trade_order_id", "fill_ref", name="uq_trade_fill_ref"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    trade_order_id: Mapped[int] = mapped_column(ForeignKey("trade_orders.id", ondelete="CASCADE"), index=True)
    fill_ref: Mapped[str] = mapped_column(String(128), default=lambda: str(uuid4()))
    qty: Mapped[int] = mapped_column(Integer)
    price: Mapped[float] = mapped_column(Float)
    filled_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    order: Mapped[TradeOrder] = relationship("TradeOrder", back_populates="fills")


class PortfolioPosition(Base):
    __tablename__ = "portfolio_positions"
    __table_args__ = (UniqueConstraint("user_id", "broker", "symbol", "product_type", name="uq_position_key"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    broker: Mapped[str] = mapped_column(String(32), index=True)
    symbol: Mapped[str] = mapped_column(String(64), index=True)
    product_type: Mapped[OrderProductType] = mapped_column(SQLEnum(OrderProductType))
    net_qty: Mapped[int] = mapped_column(Integer, default=0)
    avg_price: Mapped[float] = mapped_column(Float, default=0.0)
    ltp: Mapped[float] = mapped_column(Float, default=0.0)
    realized_pnl: Mapped[float] = mapped_column(Float, default=0.0)
    unrealized_pnl: Mapped[float] = mapped_column(Float, default=0.0)
    state: Mapped[PositionState] = mapped_column(SQLEnum(PositionState), default=PositionState.OPEN, index=True)
    next_move: Mapped[str] = mapped_column(String(32), default="Hold")
    last_order_uuid: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class OrderChargeBreakup(Base):
    __tablename__ = "order_charge_breakups"
    __table_args__ = (UniqueConstraint("trade_order_id", name="uq_charge_breakup_order"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    trade_order_id: Mapped[int] = mapped_column(ForeignKey("trade_orders.id", ondelete="CASCADE"), index=True)
    brokerage: Mapped[float] = mapped_column(Float, default=0.0)
    stt: Mapped[float] = mapped_column(Float, default=0.0)
    gst: Mapped[float] = mapped_column(Float, default=0.0)
    stamp_duty: Mapped[float] = mapped_column(Float, default=0.0)
    exchange_txn_charge: Mapped[float] = mapped_column(Float, default=0.0)
    sebi_charge: Mapped[float] = mapped_column(Float, default=0.0)
    ipft_charge: Mapped[float] = mapped_column(Float, default=0.0)
    dp_charge: Mapped[float] = mapped_column(Float, default=0.0)
    total_charges: Mapped[float] = mapped_column(Float, default=0.0)
    tax_payload: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    order: Mapped[TradeOrder] = relationship("TradeOrder", back_populates="charge_breakup")


class PriceAlert(Base):
    __tablename__ = "price_alerts"
    __table_args__ = (
        UniqueConstraint("user_id", "list_type", "symbol", "direction", "threshold_price", name="uq_price_alert_unique"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    list_type: Mapped[str] = mapped_column(String(24), default="short_term", index=True)
    symbol: Mapped[str] = mapped_column(String(64), index=True)
    direction: Mapped[str] = mapped_column(String(8), default="ABOVE", index=True)
    threshold_price: Mapped[float] = mapped_column(Float)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    triggers: Mapped[list["PriceAlertTrigger"]] = relationship(
        "PriceAlertTrigger", back_populates="alert", cascade="all, delete-orphan"
    )


class PriceAlertTrigger(Base):
    __tablename__ = "price_alert_triggers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    alert_id: Mapped[int] = mapped_column(ForeignKey("price_alerts.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    symbol: Mapped[str] = mapped_column(String(64), index=True)
    direction: Mapped[str] = mapped_column(String(8))
    threshold_price: Mapped[float] = mapped_column(Float)
    trigger_price: Mapped[float] = mapped_column(Float)
    triggered_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)

    alert: Mapped[PriceAlert] = relationship("PriceAlert", back_populates="triggers")


class SymbolLeverage(Base):
    __tablename__ = "symbol_leverage_overrides"
    __table_args__ = (UniqueConstraint("broker", "symbol", name="uq_symbol_leverage_broker_symbol"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    broker: Mapped[str] = mapped_column(String(32), index=True)
    symbol: Mapped[str] = mapped_column(String(64), index=True)
    intraday_leverage: Mapped[float | None] = mapped_column(Float, nullable=True)
    margin_leverage: Mapped[float | None] = mapped_column(Float, nullable=True)
    delivery_leverage: Mapped[float | None] = mapped_column(Float, nullable=True)
    source: Mapped[str | None] = mapped_column(String(128), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

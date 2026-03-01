from __future__ import annotations

from dataclasses import dataclass
from typing import Dict


@dataclass(frozen=True)
class BrokerChargeProfile:
    brokerage_rate: float
    max_brokerage_per_order: float
    stt_intraday_sell: float
    stt_delivery_buy: float
    stt_delivery_sell: float
    exchange_txn_rate: float
    sebi_rate: float
    ipft_rate: float
    stamp_intraday_buy: float
    stamp_delivery_buy: float
    gst_rate: float
    dp_charge_sell_delivery: float


# Samco-baseline constants (used as common baseline profile).
SAMCO_BASELINE = BrokerChargeProfile(
    brokerage_rate=0.0003,
    max_brokerage_per_order=20.0,
    stt_intraday_sell=0.00025,
    stt_delivery_buy=0.001,
    stt_delivery_sell=0.001,
    exchange_txn_rate=0.0000345,
    sebi_rate=0.000001,
    ipft_rate=0.0000005,
    stamp_intraday_buy=0.00003,
    stamp_delivery_buy=0.00015,
    gst_rate=0.18,
    dp_charge_sell_delivery=13.5,
)

BROKER_PROFILES: Dict[str, BrokerChargeProfile] = {
    "samco": SAMCO_BASELINE,
    "dhan": SAMCO_BASELINE,
    "angelone": SAMCO_BASELINE,
    "upstox": SAMCO_BASELINE,
}


def _safe_round(value: float) -> float:
    return round(max(value, 0.0), 4)


def calculate_charges(
    *,
    broker: str,
    product_type: str,
    side: str,
    turnover: float,
    is_sell_delivery: bool = False,
) -> Dict[str, float]:
    profile = BROKER_PROFILES.get((broker or "").lower(), SAMCO_BASELINE)
    product = (product_type or "").upper()
    trade_side = (side or "").upper()
    turnover = float(max(turnover, 0.0))

    brokerage = min(turnover * profile.brokerage_rate, profile.max_brokerage_per_order)

    stt = 0.0
    if product == "INTRADAY" and trade_side == "SELL":
        stt = turnover * profile.stt_intraday_sell
    elif product == "DELIVERY":
        if trade_side == "BUY":
            stt = turnover * profile.stt_delivery_buy
        elif trade_side == "SELL":
            stt = turnover * profile.stt_delivery_sell

    stamp_duty = 0.0
    if trade_side == "BUY":
        if product == "DELIVERY":
            stamp_duty = turnover * profile.stamp_delivery_buy
        else:
            stamp_duty = turnover * profile.stamp_intraday_buy

    exchange_txn_charge = turnover * profile.exchange_txn_rate
    sebi_charge = turnover * profile.sebi_rate
    ipft_charge = turnover * profile.ipft_rate

    gst_taxable = brokerage + exchange_txn_charge
    gst = gst_taxable * profile.gst_rate

    dp_charge = profile.dp_charge_sell_delivery if is_sell_delivery else 0.0

    total_charges = brokerage + stt + gst + stamp_duty + exchange_txn_charge + sebi_charge + ipft_charge + dp_charge

    return {
        "brokerage": _safe_round(brokerage),
        "stt": _safe_round(stt),
        "gst": _safe_round(gst),
        "stamp_duty": _safe_round(stamp_duty),
        "exchange_txn_charge": _safe_round(exchange_txn_charge),
        "sebi_charge": _safe_round(sebi_charge),
        "ipft_charge": _safe_round(ipft_charge),
        "dp_charge": _safe_round(dp_charge),
        "total_charges": _safe_round(total_charges),
    }

"""
Weekly LOW/MID/HIGH 5m cross-up helper.
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Dict, List, Optional, Tuple

import pandas as pd

from app.db.database import SessionLocal
from app.db.models import HistoricalCandle


def _to_float(v) -> Optional[float]:
    try:
        return float(v)
    except Exception:
        return None


def previous_week_levels(symbol: str) -> Optional[Tuple[float, float, float]]:
    db = SessionLocal()
    try:
        since = date.today() - timedelta(days=90)
        rows = (
            db.query(HistoricalCandle.candle_date, HistoricalCandle.high, HistoricalCandle.low, HistoricalCandle.close)
            .filter(
                HistoricalCandle.instrument_type == "stock",
                HistoricalCandle.symbol == symbol,
                HistoricalCandle.candle_date >= since,
            )
            .order_by(HistoricalCandle.candle_date.asc())
            .all()
        )
        if not rows:
            return None
        df = pd.DataFrame(
            [
                {
                    "date": r.candle_date,
                    "high": _to_float(r.high),
                    "low": _to_float(r.low),
                    "close": _to_float(r.close),
                }
                for r in rows
            ]
        ).dropna(subset=["date", "high", "low", "close"])
        if df.empty:
            return None
        df["date"] = pd.to_datetime(df["date"], errors="coerce")
        df = df.dropna(subset=["date"]).set_index("date").sort_index()
        w = df.resample("W-FRI").agg({"high": "max", "low": "min", "close": "last"}).dropna(subset=["close"])
        if len(w) < 2:
            return None
        prev = w.iloc[-2]
        w_high = float(prev["high"])
        w_low = float(prev["low"])
        w_mid = (w_high + w_low) / 2.0
        return w_low, w_mid, w_high
    finally:
        db.close()


def detect_cross_up_events(symbol: str, prev_close: Optional[float], cur_close: Optional[float]) -> List[Dict]:
    if prev_close is None or cur_close is None:
        return []
    levels = previous_week_levels(symbol)
    if not levels:
        return []

    wl, wm, wh = levels
    out: List[Dict] = []
    band = max((wh - wl) / 2.0, 0.01)
    for level_name, level_val in (("LOW", wl), ("MID", wm), ("HIGH", wh)):
        crossed = float(prev_close) <= float(level_val) < float(cur_close)
        if crossed:
            entry = float(cur_close)
            if level_name == "LOW":
                sl, t1, t2 = wl, wm, wh
            elif level_name == "MID":
                sl, t1, t2 = wm, wh, wh + band
            else:  # HIGH
                sl, t1, t2 = wh, wh + band, wh + (2.0 * band)
            out.append(
                {
                    "alert_type": f"weekly_cross_up_{level_name.lower()}",
                    "severity": "critical",
                    "indicator": "Weekly Levels 5m",
                    "detail": (
                        f"5m close crossed above previous-week {level_name} ({level_val:.2f}) | "
                        f"Entry {entry:.2f} | SL {sl:.2f} | T1 {t1:.2f} | T2 {t2:.2f}"
                    ),
                    "level_name": level_name,
                    "level_value": round(level_val, 2),
                    "entry": round(entry, 2),
                    "stop_loss": round(sl, 2),
                    "target_1": round(t1, 2),
                    "target_2": round(t2, 2),
                }
            )
    return out


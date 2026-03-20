"""Financial Advisor API – ratings, signals, analysis, alerts, portfolio health."""

import logging
from datetime import date, timedelta
import time
from typing import List, Optional
import re

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import desc

from app.db.database import SessionLocal
from app.db.models import Alert, HistoricalCandle, StockAnalysis, StockFundamentals, StockRating, StockSectorInfo, TechnicalSignal

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/advisor", tags=["advisor"])
_MONTHLY_SETUP_CACHE = {"ts": 0.0, "data": []}
_ATTACHED_INDICATOR_CACHE = {"ts": 0.0, "key": "", "data": []}


def _prefetch_screener(symbols: list):
    """Fetch latest fundamentals from screener.in for symbols that have no recent data."""
    from app.external.screener_fetcher import fetch_fundamentals, upsert_fundamentals
    import time
    for sym in symbols:
        try:
            db = SessionLocal()
            latest = (
                db.query(StockFundamentals)
                .filter_by(symbol=sym)
                .order_by(StockFundamentals.fetched_at.desc())
                .first()
            )
            db.close()
            if latest and latest.fetched_at and (date.today() - latest.fetched_at.date()).days < 1:
                continue
            periods = fetch_fundamentals(sym)
            if periods:
                upsert_fundamentals(sym, periods)
                logger.info(f"Screener: fetched {len(periods)} periods for {sym}")
            time.sleep(2)
        except Exception as e:
            logger.warning(f"Screener prefetch failed for {sym}: {e}")


def _ema_series(values: List[float], period: int) -> List[float]:
    if not values:
        return []
    alpha = 2.0 / (period + 1.0)
    out = [float(values[0])]
    for v in values[1:]:
        out.append(alpha * float(v) + (1 - alpha) * out[-1])
    return out


def _macd_signal_stats(closes: List[float]) -> tuple[Optional[float], Optional[float]]:
    if len(closes) < 26:
        return None, None
    ema12 = _ema_series(closes, 12)
    ema26 = _ema_series(closes, 26)
    macd_line = [a - b for a, b in zip(ema12, ema26)]
    signal = _ema_series(macd_line, 9)
    if not signal:
        return None, None
    tail = signal[-12:] if len(signal) >= 12 else signal
    return signal[-1], (sum(tail) / len(tail)) if tail else None


def _macd_signal_series(closes: List[float]) -> tuple[List[float], List[float]]:
    """Return MACD signal and EMA12(MACD signal) series for daily trigger checks."""
    if len(closes) < 26:
        return [], []
    ema12 = _ema_series(closes, 12)
    ema26 = _ema_series(closes, 26)
    macd_line = [a - b for a, b in zip(ema12, ema26)]
    macd_signal = _ema_series(macd_line, 9)
    macd_signal_ema12 = _ema_series(macd_signal, 12)
    return macd_signal, macd_signal_ema12


def _latest_daily_entry_trigger(stock_daily_points: List[tuple]) -> dict:
    """
    Detect latest daily bar where:
    - MACD signal crosses above EMA12(MACD signal)
    - MACD signal > 0
    """
    if len(stock_daily_points) < 40:
        return {
            "entry_triggered": False,
            "entry_day": None,
            "entry_reason": "insufficient_daily_data",
            "daily_macd_signal": None,
            "daily_macd_signal_ema12": None,
            "daily_macd_cross_above_ema12": False,
            "daily_macd_gt_zero": False,
        }

    dates = [d for d, _ in stock_daily_points]
    closes = [float(c) for _, c in stock_daily_points if c is not None]
    if len(closes) != len(dates):
        # Keep deterministic alignment in rare missing-close cases.
        aligned = [(d, c) for d, c in stock_daily_points if c is not None]
        dates = [d for d, _ in aligned]
        closes = [float(c) for _, c in aligned]

    sig, sig_ema12 = _macd_signal_series(closes)
    if len(sig) < 2 or len(sig_ema12) < 2 or len(sig) != len(dates):
        return {
            "entry_triggered": False,
            "entry_day": None,
            "entry_reason": "macd_series_unavailable",
            "daily_macd_signal": None,
            "daily_macd_signal_ema12": None,
            "daily_macd_cross_above_ema12": False,
            "daily_macd_gt_zero": False,
        }

    latest_cross_idx = None
    for i in range(1, len(sig)):
        crossed = sig[i - 1] <= sig_ema12[i - 1] and sig[i] > sig_ema12[i]
        if crossed and sig[i] > 0:
            latest_cross_idx = i

    cur_sig = sig[-1]
    cur_sig_ema12 = sig_ema12[-1]
    cur_cross = sig[-2] <= sig_ema12[-2] and cur_sig > cur_sig_ema12

    if latest_cross_idx is None:
        return {
            "entry_triggered": False,
            "entry_day": None,
            "entry_reason": "no_daily_cross_above_ema12_with_macd_gt_zero",
            "daily_macd_signal": round(cur_sig, 6),
            "daily_macd_signal_ema12": round(cur_sig_ema12, 6),
            "daily_macd_cross_above_ema12": bool(cur_cross),
            "daily_macd_gt_zero": bool(cur_sig > 0),
        }

    return {
        "entry_triggered": True,
        "entry_day": str(dates[latest_cross_idx]),
        "entry_reason": "daily_macd_signal_crossed_above_ema12_and_gt_zero",
        "daily_macd_signal": round(cur_sig, 6),
        "daily_macd_signal_ema12": round(cur_sig_ema12, 6),
        "daily_macd_cross_above_ema12": bool(cur_cross),
        "daily_macd_gt_zero": bool(cur_sig > 0),
    }


def _to_weekly_series(daily_points: List[tuple]) -> List[tuple]:
    weekly = {}
    for d, c in daily_points:
        y, w, _ = d.isocalendar()
        weekly[(y, w)] = (d, c)
    return sorted(weekly.values(), key=lambda x: x[0])


def _to_monthly_series(daily_points: List[tuple]) -> List[tuple]:
    monthly = {}
    for d, c in daily_points:
        monthly[(d.year, d.month)] = (d, c)
    return sorted(monthly.values(), key=lambda x: x[0])


def _ema_last(values: List[float], period: int) -> Optional[float]:
    if not values or len(values) < period:
        return None
    series = _ema_series(values, period)
    return float(series[-1]) if series else None


def _parse_market_cap_cr(value) -> Optional[float]:
    """
    Parse market cap text into Crores.
    Supports values like:
    - "12,345 Cr"
    - "1.25 Lakh Cr"
    - "12500000000"
    """
    if value is None:
        return None
    if isinstance(value, (int, float)):
        n = float(value)
        if n <= 0:
            return None
        # If this is raw rupees, convert to crores.
        if n > 100000:
            return n / 10000000.0
        return n

    s = str(value).strip().lower().replace(",", "")
    if not s:
        return None
    m = re.search(r"([0-9]*\.?[0-9]+)", s)
    if not m:
        return None
    num = float(m.group(1))
    if "lakh" in s and "cr" in s:
        return num * 100000.0
    if "cr" in s or "crore" in s:
        return num
    if "bn" in s or "billion" in s:
        # 1 billion rupees = 100 crores
        return num * 100.0
    if "m" in s or "million" in s:
        # 1 million rupees = 0.1 crores
        return num * 0.1
    # Raw rupees fallback
    if num > 100000:
        return num / 10000000.0
    return num


def _latest_5m_metrics(symbol: str) -> dict:
    """
    Fetch latest 5m candle metrics from yfinance.
    Returns close/prev_close and relative volume (volume / EMA20(volume)).
    """
    try:
        import yfinance as yf
    except Exception:
        return {"ok": False, "reason": "yfinance_unavailable"}

    ticker = f"{symbol}.NS" if "." not in symbol else symbol
    try:
        hist = yf.Ticker(ticker).history(period="5d", interval="5m", auto_adjust=False)
    except Exception:
        return {"ok": False, "reason": "yfinance_fetch_failed"}
    if hist is None or hist.empty or len(hist) < 21:
        return {"ok": False, "reason": "insufficient_5m_data"}

    try:
        close_series = hist["Close"].dropna()
        vol_series = hist["Volume"].fillna(0)
        if len(close_series) < 2 or len(vol_series) < 21:
            return {"ok": False, "reason": "insufficient_5m_data"}
        close_now = float(close_series.iloc[-1])
        close_prev = float(close_series.iloc[-2])
        vol_now = float(vol_series.iloc[-1])
        ema20 = float(vol_series.ewm(span=20, adjust=False).mean().iloc[-1])
        rel_vol = (vol_now / ema20) if ema20 > 0 else 0.0
        return {
            "ok": True,
            "close_now": close_now,
            "close_prev": close_prev,
            "vol_now": vol_now,
            "vol_ema20": ema20,
            "rel_vol": rel_vol,
            "source": "yfinance",
        }
    except Exception:
        return {"ok": False, "reason": "5m_metric_error"}


def _relative_strength(stock_points: List[tuple], bench_points: List[tuple], period: int) -> Optional[float]:
    if not stock_points or not bench_points:
        return None
    s_map = {d: c for d, c in stock_points}
    b_map = {d: c for d, c in bench_points}
    common_dates = sorted(set(s_map.keys()) & set(b_map.keys()))
    if len(common_dates) < period + 1:
        return None
    end_d = common_dates[-1]
    start_d = common_dates[-period - 1]
    s0, s1 = s_map[start_d], s_map[end_d]
    b0, b1 = b_map[start_d], b_map[end_d]
    if not s0 or not b0 or not b1:
        return None
    stock_ratio = s1 / s0
    bench_ratio = b1 / b0
    if bench_ratio == 0:
        return None
    return stock_ratio / bench_ratio - 1.0


def _passes_bull_trend_rules(
    signal: TechnicalSignal,
    cmp_price: Optional[float],
    ema50: Optional[float],
    stock_daily_points: List[tuple],
    bench_daily_points: List[tuple],
) -> tuple[bool, dict]:
    """Strict bullish filter:
    - MACD signal > 0
    - MACD signal > avg(last 12 MACD signal values)
    - Daily close > EMA50 and EMA200
    - Weekly close > EMA30 OR weekly close crossed above EMA30
    - Relative strength vs NIFTY > 0 for daily(123), weekly(52), monthly(12)
    """
    closes = [c for _, c in stock_daily_points if c is not None]
    daily_close = closes[-1] if closes else cmp_price

    macd_signal, macd_signal_avg12 = _macd_signal_stats(closes)
    macd_gt_zero = bool(macd_signal is not None and macd_signal > 0)
    macd_above_12avg = bool(
        macd_signal is not None and macd_signal_avg12 is not None and macd_signal > macd_signal_avg12
    )

    daily_ema50 = ema50
    if daily_ema50 is None and len(closes) >= 50:
        daily_ema50 = _ema_series(closes, 50)[-1]
    daily_ema200 = signal.ema200
    if daily_ema200 is None and len(closes) >= 200:
        daily_ema200 = _ema_series(closes, 200)[-1]

    close_gt_ema50 = bool(daily_close is not None and daily_ema50 is not None and daily_close > daily_ema50)
    close_gt_ema200 = bool(daily_close is not None and daily_ema200 is not None and daily_close > daily_ema200)

    weekly_series = _to_weekly_series(stock_daily_points)
    weekly_closes = [c for _, c in weekly_series if c is not None]
    weekly_ema30_series = _ema_series(weekly_closes, 30) if weekly_closes else []
    weekly_close = weekly_closes[-1] if weekly_closes else None
    weekly_ema30 = weekly_ema30_series[-1] if weekly_ema30_series else None
    weekly_close_prev = weekly_closes[-2] if len(weekly_closes) >= 2 else None
    weekly_ema30_prev = weekly_ema30_series[-2] if len(weekly_ema30_series) >= 2 else None

    weekly_above_ema30 = bool(
        weekly_close is not None and weekly_ema30 is not None and weekly_close > weekly_ema30
    )
    weekly_crossed_ema30 = bool(
        weekly_close_prev is not None
        and weekly_ema30_prev is not None
        and weekly_close is not None
        and weekly_ema30 is not None
        and weekly_close_prev <= weekly_ema30_prev
        and weekly_close > weekly_ema30
    )
    weekly_ok = weekly_above_ema30 or weekly_crossed_ema30

    bench_weekly = _to_weekly_series(bench_daily_points)
    monthly_series = _to_monthly_series(stock_daily_points)
    bench_monthly = _to_monthly_series(bench_daily_points)

    rs_daily_123 = _relative_strength(stock_daily_points, bench_daily_points, 123)
    rs_weekly_52 = _relative_strength(weekly_series, bench_weekly, 52)
    rs_monthly_12 = _relative_strength(monthly_series, bench_monthly, 12)
    rs_ok = bool(
        rs_daily_123 is not None and rs_daily_123 > 0
        and rs_weekly_52 is not None and rs_weekly_52 > 0
        and rs_monthly_12 is not None and rs_monthly_12 > 0
    )

    passed = macd_gt_zero and macd_above_12avg and close_gt_ema50 and close_gt_ema200 and weekly_ok and rs_ok
    return passed, {
        "macd_signal_val": macd_signal,
        "macd_signal_avg12": macd_signal_avg12,
        "macd_gt_zero": macd_gt_zero,
        "macd_above_12avg": macd_above_12avg,
        "daily_close": daily_close,
        "ema50": daily_ema50,
        "ema200": daily_ema200,
        "close_gt_ema50": close_gt_ema50,
        "close_gt_ema200": close_gt_ema200,
        "weekly_close": weekly_close,
        "weekly_ema30": weekly_ema30,
        "weekly_above_ema30": weekly_above_ema30,
        "weekly_crossed_ema30": weekly_crossed_ema30,
        "rs_daily_123": rs_daily_123,
        "rs_weekly_52": rs_weekly_52,
        "rs_monthly_12": rs_monthly_12,
        "rs_gt_zero_all": rs_ok,
    }


def _compute_monthly_macd_setups(db, limit: int = 200) -> List[dict]:
    # Stock-only universe
    stock_rows = db.query(StockSectorInfo.symbol, StockSectorInfo.sector, StockSectorInfo.price).all()
    universe = [r for r in stock_rows if r.symbol]
    # Deduplicate symbols (StockSectorInfo can contain multiple rows per symbol across indices).
    symbols = list(dict.fromkeys(r.symbol for r in universe))
    if not symbols:
        return []

    sector_map = {r.symbol: r.sector for r in universe}
    cmp_map = {r.symbol: r.price for r in universe if r.price is not None}

    # ~4 years to compute stable monthly MACD/EMA
    since = date.today() - timedelta(days=1600)
    stock_candles = (
        db.query(HistoricalCandle.symbol, HistoricalCandle.candle_date, HistoricalCandle.close)
        .filter(
            HistoricalCandle.instrument_type == "stock",
            HistoricalCandle.symbol.in_(symbols),
            HistoricalCandle.candle_date >= since,
        )
        .order_by(HistoricalCandle.symbol, HistoricalCandle.candle_date)
        .all()
    )
    stock_daily_map = {}
    for sym, d, close in stock_candles:
        if close is None:
            continue
        stock_daily_map.setdefault(sym, []).append((d, float(close)))

    bench_rows = (
        db.query(HistoricalCandle.symbol, HistoricalCandle.candle_date, HistoricalCandle.close)
        .filter(
            HistoricalCandle.instrument_type == "index",
            HistoricalCandle.symbol.in_(["NIFTY", "NIFTY 50"]),
            HistoricalCandle.candle_date >= since,
        )
        .order_by(HistoricalCandle.symbol, HistoricalCandle.candle_date)
        .all()
    )
    bench_by_symbol = {}
    for sym, d, close in bench_rows:
        if close is None:
            continue
        bench_by_symbol.setdefault(sym, []).append((d, float(close)))
    bench_daily = bench_by_symbol.get("NIFTY") or bench_by_symbol.get("NIFTY 50") or []
    bench_weekly = _to_weekly_series(bench_daily)
    bench_monthly = _to_monthly_series(bench_daily)

    # Pull latest daily/weekly technical context for display
    daily_sig_rows = (
        db.query(TechnicalSignal)
        .filter(TechnicalSignal.timeframe == "daily", TechnicalSignal.symbol.in_(symbols))
        .order_by(desc(TechnicalSignal.date))
        .all()
    )
    weekly_sig_rows = (
        db.query(TechnicalSignal)
        .filter(TechnicalSignal.timeframe == "weekly", TechnicalSignal.symbol.in_(symbols))
        .order_by(desc(TechnicalSignal.date))
        .all()
    )
    monthly_sig_rows = (
        db.query(TechnicalSignal)
        .filter(TechnicalSignal.timeframe == "monthly", TechnicalSignal.symbol.in_(symbols))
        .order_by(desc(TechnicalSignal.date))
        .all()
    )
    latest_daily = {}
    latest_weekly = {}
    latest_monthly = {}
    prev_monthly = {}
    for r in daily_sig_rows:
        if r.symbol not in latest_daily:
            latest_daily[r.symbol] = r
    for r in weekly_sig_rows:
        if r.symbol not in latest_weekly:
            latest_weekly[r.symbol] = r
    for r in monthly_sig_rows:
        if r.symbol not in latest_monthly:
            latest_monthly[r.symbol] = r
        elif r.symbol not in prev_monthly:
            prev_monthly[r.symbol] = r

    result = []
    for sym in symbols:
        stock_daily = stock_daily_map.get(sym, [])
        if len(stock_daily) < 260:
            continue

        monthly_series = _to_monthly_series(stock_daily)
        monthly_closes = [c for _, c in monthly_series if c is not None]
        if len(monthly_closes) < 20:
            continue

        ema12_m = _ema_series(monthly_closes, 12)
        ema26_m = _ema_series(monthly_closes, 26)
        macd_m = [a - b for a, b in zip(ema12_m, ema26_m)]
        signal_m = _ema_series(macd_m, 9)
        macd_ema12 = _ema_series(macd_m, 12)
        hist_m = [m - s for m, s in zip(macd_m, signal_m)]
        if len(macd_m) < 2 or len(signal_m) < 2 or len(hist_m) < 2 or len(macd_ema12) < 2:
            continue

        cur_macd, prev_macd = macd_m[-1], macd_m[-2]
        cur_signal, prev_signal = signal_m[-1], signal_m[-2]
        cur_hist, prev_hist = hist_m[-1], hist_m[-2]
        cur_macd_ema12 = macd_ema12[-1]
        signal_avg12_cur = sum(signal_m[-12:]) / min(12, len(signal_m))
        signal_avg12_prev = sum(signal_m[-13:-1]) / 12 if len(signal_m) >= 13 else None

        crossed_above_zero_now = prev_macd <= 0 < cur_macd
        crossed_below_zero_now = prev_macd >= 0 > cur_macd
        recent_cross_window = min(4, len(macd_m) - 1)
        crossed_above_zero_recent = any(
            macd_m[-i - 1] <= 0 < macd_m[-i]
            for i in range(1, recent_cross_window + 1)
        )
        crossed_below_zero_recent = any(
            macd_m[-i - 1] >= 0 > macd_m[-i]
            for i in range(1, recent_cross_window + 1)
        )
        # Treat setup as active while MACD remains in regime (+/-), but keep
        # explicit fresh/recent cross flags for monitoring.
        crossed_above_zero = cur_macd > 0 or crossed_above_zero_recent
        crossed_below_zero = cur_macd < 0 or crossed_below_zero_recent
        macd_ge_ema12 = cur_macd >= cur_macd_ema12
        macd_gt_ema12 = cur_macd > cur_macd_ema12
        macd_lt_ema12 = cur_macd < cur_macd_ema12
        macd_le_ema12 = cur_macd <= cur_macd_ema12
        green_hist_building = cur_hist > 0 and cur_hist > prev_hist
        red_hist_building = cur_hist < 0 and cur_hist < prev_hist
        signal_cross_avg = bool(
            signal_avg12_prev is not None
            and prev_signal <= signal_avg12_prev
            and cur_signal > signal_avg12_cur
        )
        signal_cross_below_avg = bool(
            signal_avg12_prev is not None
            and prev_signal >= signal_avg12_prev
            and cur_signal < signal_avg12_cur
        )

        stock_weekly = _to_weekly_series(stock_daily)
        rs_daily_123 = _relative_strength(stock_daily, bench_daily, 123)
        rs_weekly_52 = _relative_strength(stock_weekly, bench_weekly, 52)
        rs_monthly_12 = _relative_strength(monthly_series, bench_monthly, 12)
        rs_ok = bool(
            rs_daily_123 is not None and rs_daily_123 > 0
            and rs_weekly_52 is not None and rs_weekly_52 > 0
            and rs_monthly_12 is not None and rs_monthly_12 > 0
        )
        rs_bear_ok = bool(
            rs_daily_123 is not None and rs_daily_123 < 0
            and rs_weekly_52 is not None and rs_weekly_52 < 0
            and rs_monthly_12 is not None and rs_monthly_12 < 0
        )

        rs_pos_count = sum(
            [
                1 if rs_daily_123 is not None and rs_daily_123 > 0 else 0,
                1 if rs_weekly_52 is not None and rs_weekly_52 > 0 else 0,
                1 if rs_monthly_12 is not None and rs_monthly_12 > 0 else 0,
            ]
        )
        rs_neg_count = sum(
            [
                1 if rs_daily_123 is not None and rs_daily_123 < 0 else 0,
                1 if rs_weekly_52 is not None and rs_weekly_52 < 0 else 0,
                1 if rs_monthly_12 is not None and rs_monthly_12 < 0 else 0,
            ]
        )

        ms = latest_monthly.get(sym)
        ps = prev_monthly.get(sym)
        cur_psar = ms.psar if ms else None
        prev_psar = ps.psar if ps else None
        cur_month_close = monthly_closes[-1] if monthly_closes else None
        prev_month_close = monthly_closes[-2] if len(monthly_closes) >= 2 else None
        close_above_psar = bool(
            cur_month_close is not None and cur_psar is not None and cur_month_close > cur_psar
        )
        close_below_psar = bool(
            cur_month_close is not None and cur_psar is not None and cur_month_close < cur_psar
        )
        psar_cross_above = bool(
            prev_month_close is not None
            and prev_psar is not None
            and cur_month_close is not None
            and cur_psar is not None
            and prev_month_close <= prev_psar
            and cur_month_close > cur_psar
        )
        psar_cross_below = bool(
            prev_month_close is not None
            and prev_psar is not None
            and cur_month_close is not None
            and cur_psar is not None
            and prev_month_close >= prev_psar
            and cur_month_close < cur_psar
        )

        # Monthly setup rule requested by user:
        # close crosses above PSAR + MACD > 0 + MACD >= EMA12(MACD).
        monthly_psar_macd_rule = psar_cross_above and (cur_macd > 0) and macd_ge_ema12
        # Softer variation to catch potential early movers even without fresh cross.
        monthly_psar_macd_soft = close_above_psar and (cur_macd > 0) and macd_ge_ema12

        # Strong + potential framework (less strict) to surface earlier movers.
        uptrend_complete = crossed_above_zero and macd_ge_ema12 and green_hist_building and rs_ok and monthly_psar_macd_rule
        downtrend_complete = crossed_below_zero and macd_le_ema12 and red_hist_building and rs_bear_ok and psar_cross_below

        up_score = 0
        up_score += 3 if monthly_psar_macd_rule else 0
        up_score += 2 if monthly_psar_macd_soft else 0
        up_score += 2 if cur_macd > 0 else 0
        up_score += 2 if macd_ge_ema12 else 0
        up_score += 1 if green_hist_building else 0
        up_score += 1 if signal_cross_avg else 0
        up_score += rs_pos_count

        down_score = 0
        down_score += 3 if psar_cross_below else 0
        down_score += 2 if (close_below_psar and cur_macd < 0 and macd_le_ema12) else 0
        down_score += 2 if cur_macd < 0 else 0
        down_score += 2 if macd_le_ema12 else 0
        down_score += 1 if red_hist_building else 0
        down_score += 1 if signal_cross_below_avg else 0
        down_score += rs_neg_count

        potential_uptrend = (
            monthly_psar_macd_rule
            or monthly_psar_macd_soft
            or (
                (cur_macd > 0)
                and macd_ge_ema12
                and (green_hist_building or signal_cross_avg or rs_pos_count >= 1)
            )
            or (up_score >= 4)
        )
        potential_downtrend = (
            psar_cross_below
            or (
                (cur_macd < 0)
                and macd_le_ema12
                and (red_hist_building or signal_cross_below_avg or rs_neg_count >= 1)
            )
            or (down_score >= 4)
        )

        if not (uptrend_complete or downtrend_complete or potential_uptrend or potential_downtrend):
            continue

        ds = latest_daily.get(sym)
        ws = latest_weekly.get(sym)
        is_bear = (downtrend_complete or (potential_downtrend and down_score > up_score)) and not uptrend_complete
        entry_meta = _latest_daily_entry_trigger(stock_daily)
        cmp_val = cmp_map.get(sym)
        target_1 = ds.target_1 if ds else None
        target_2 = ds.target_2 if ds else None
        target_done = bool(
            cmp_val is not None
            and target_1 is not None
            and ((not is_bear and cmp_val >= target_1) or (is_bear and cmp_val <= target_1))
        )
        next_scope_target = None
        if target_done and cmp_val is not None and target_2 is not None:
            if (not is_bear and cmp_val < target_2) or (is_bear and cmp_val > target_2):
                next_scope_target = target_2

        row = {
            "symbol": sym,
            "setup_type": "monthly_macd_setup",
            "cmp": round(cmp_val, 2) if cmp_val is not None else None,
            "sector": sector_map.get(sym),
            "trend": (ds.trend if ds else None) or ("bearish" if is_bear else "bullish"),
            "weekly_trend": ws.trend if ws else None,
            "buy_sell_tier": ds.buy_sell_tier if ds else None,
            "entry_price": ds.entry_price if ds else None,
            "stop_loss": ds.stop_loss if ds else None,
            "target_1": target_1,
            "target_2": target_2,
            "signal_score": ds.signal_score if ds and ds.signal_score is not None else 0,
            "conviction_score": (ds.signal_score if ds and ds.signal_score is not None else 0) + 20,
            "entry_triggered": bool(entry_meta.get("entry_triggered")),
            "entry_day": entry_meta.get("entry_day"),
            "entry_reason": entry_meta.get("entry_reason"),
            "exit_reason": "target_1_hit" if target_done else None,
            "daily_macd_signal": entry_meta.get("daily_macd_signal"),
            "daily_macd_signal_ema12": entry_meta.get("daily_macd_signal_ema12"),
            "daily_macd_cross_above_ema12": bool(entry_meta.get("daily_macd_cross_above_ema12")),
            "daily_macd_gt_zero": bool(entry_meta.get("daily_macd_gt_zero")),
            "monthly_macd": round(cur_macd, 4),
            "monthly_macd_prev": round(prev_macd, 4),
            "monthly_macd_ema12": round(cur_macd_ema12, 4),
            "monthly_signal": round(cur_signal, 4),
            "monthly_signal_prev": round(prev_signal, 4),
            "monthly_signal_avg12": round(signal_avg12_cur, 4),
            "monthly_hist": round(cur_hist, 4),
            "monthly_hist_prev": round(prev_hist, 4),
            "monthly_macd_crossed_above_zero": crossed_above_zero,
            "monthly_macd_crossed_above_zero_now": crossed_above_zero_now,
            "monthly_macd_crossed_below_zero": crossed_below_zero,
            "monthly_macd_crossed_below_zero_now": crossed_below_zero_now,
            "monthly_close": round(cur_month_close, 4) if cur_month_close is not None else None,
            "monthly_close_prev": round(prev_month_close, 4) if prev_month_close is not None else None,
            "monthly_psar": round(cur_psar, 4) if cur_psar is not None else None,
            "monthly_psar_prev": round(prev_psar, 4) if prev_psar is not None else None,
            "monthly_close_above_psar": close_above_psar,
            "monthly_close_below_psar": close_below_psar,
            "monthly_close_crossed_above_psar": psar_cross_above,
            "monthly_close_crossed_below_psar": psar_cross_below,
            "monthly_psar_macd_rule": monthly_psar_macd_rule,
            "monthly_psar_macd_soft": monthly_psar_macd_soft,
            "monthly_macd_ge_ema12": macd_ge_ema12,
            "monthly_macd_gt_ema12": macd_gt_ema12,
            "monthly_macd_lt_ema12": macd_lt_ema12,
            "monthly_macd_le_ema12": macd_le_ema12,
            "monthly_green_hist_building": green_hist_building,
            "monthly_red_hist_building": red_hist_building,
            "macd_signal_cross_above_avg": signal_cross_avg,
            "macd_signal_cross_below_avg": signal_cross_below_avg,
            "daily_trigger": signal_cross_avg,
            "rs_daily_123": rs_daily_123,
            "rs_weekly_52": rs_weekly_52,
            "rs_monthly_12": rs_monthly_12,
            "rs_pos_count": rs_pos_count,
            "rs_neg_count": rs_neg_count,
            "rs_gt_zero_all": rs_ok,
            "rs_lt_zero_all": rs_bear_ok,
            "uptrend_complete": uptrend_complete,
            "uptrend_or_trigger": uptrend_complete or potential_uptrend,
            "potential_uptrend": potential_uptrend,
            "potential_downtrend": potential_downtrend,
            "downtrend_complete": downtrend_complete,
            "up_score": up_score,
            "down_score": down_score,
            "high_conviction": bool(uptrend_complete or downtrend_complete),
            "weekly_aligned": bool(ws and (ws.trend == ("bearish" if is_bear else "bullish"))),
            "actionable": signal_cross_below_avg if is_bear else signal_cross_avg,
            "target_done": target_done,
            "further_scope": bool(next_scope_target is not None),
            "next_scope_target": next_scope_target,
            "status": "done" if target_done else ("entry_ready" if entry_meta.get("entry_triggered") else "in_trade"),
            "signal_type": "strong_sell" if (is_bear and downtrend_complete) else (
                "sell" if is_bear else ("strong_buy" if uptrend_complete else "buy")
            ),
        }
        result.append(row)

    result.sort(
        key=lambda x: (
            -1 if x.get("monthly_psar_macd_rule") else 0,
            -(x.get("up_score") or 0),
            -(x.get("down_score") or 0),
            -(x.get("conviction_score") or 0),
            -(x.get("monthly_hist") or 0),
        )
    )
    return result[:limit]


# ── Ratings ──────────────────────────────────────────────────────────────────

@router.get("/ratings")
def get_ratings(
    recommendation: Optional[str] = None,
    horizon: Optional[str] = None,
    sector: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500),
):
    from sqlalchemy import func as sqlfunc
    db = SessionLocal()
    try:
        latest_sub = (
            db.query(
                StockRating.symbol,
                sqlfunc.max(StockRating.date).label("max_date"),
            )
            .group_by(StockRating.symbol)
            .subquery()
        )
        q = (
            db.query(StockRating)
            .join(
                latest_sub,
                (StockRating.symbol == latest_sub.c.symbol)
                & (StockRating.date == latest_sub.c.max_date),
            )
            .order_by(StockRating.composite_score.desc())
        )
        if recommendation:
            q = q.filter(StockRating.recommendation == recommendation)
        if horizon:
            q = q.filter(StockRating.horizon == horizon)
        rows = q.limit(limit).all()
        symbols = [r.symbol for r in rows]
        cmp_map = {}
        if symbols:
            for si in db.query(StockSectorInfo).filter(
                StockSectorInfo.symbol.in_(symbols)
            ).all():
                cmp_map[si.symbol] = si.price

        result = []
        for r in rows:
            d = _rating_to_dict(r)
            cmp = cmp_map.get(r.symbol)
            d["cmp"] = cmp
            is_bull = (r.trend or "").lower() in ("bullish", "up")

            if cmp and r.entry_price and r.target_short_term:
                if is_bull:
                    hit_target = cmp >= r.target_short_term
                    pct_from_entry = (cmp - r.entry_price) / r.entry_price * 100
                else:
                    hit_target = cmp <= r.target_short_term
                    pct_from_entry = (r.entry_price - cmp) / r.entry_price * 100
                d["pct_from_entry"] = round(pct_from_entry, 1)
                d["hit_target"] = hit_target
                d["actionable"] = not hit_target and pct_from_entry <= 5
            else:
                d["pct_from_entry"] = None
                d["hit_target"] = False
                d["actionable"] = False

            if r.entry_price and r.stop_loss:
                risk = abs(r.entry_price - r.stop_loss)
                sign = 1 if is_bull else -1
                d["risk"] = round(risk, 2)
                d["sl_pct"] = round(risk / r.entry_price * 100, 2) if r.entry_price else None
                d["t4r"] = round(r.entry_price + sign * 4 * risk, 2)
                d["t6r"] = round(r.entry_price + sign * 6 * risk, 2)
                d["t10r"] = round(r.entry_price + sign * 10 * risk, 2)
                d["t4r_pct"] = round(sign * 4 * risk / r.entry_price * 100, 1) if r.entry_price else None
                d["t6r_pct"] = round(sign * 6 * risk / r.entry_price * 100, 1) if r.entry_price else None
                d["t10r_pct"] = round(sign * 10 * risk / r.entry_price * 100, 1) if r.entry_price else None
            else:
                d["risk"] = None
                d["sl_pct"] = None
                d["t4r"] = d["t6r"] = d["t10r"] = None
                d["t4r_pct"] = d["t6r_pct"] = d["t10r_pct"] = None

            result.append(d)

        return {
            "count": len(result),
            "data": result,
        }
    finally:
        db.close()


@router.get("/ratings/{symbol}")
def get_rating_detail(symbol: str):
    db = SessionLocal()
    try:
        row = (
            db.query(StockRating)
            .filter_by(symbol=symbol.upper())
            .order_by(StockRating.date.desc())
            .first()
        )
        if not row:
            raise HTTPException(status_code=404, detail="No rating found")
        return _rating_to_dict(row)
    finally:
        db.close()


def _rating_to_dict(r: StockRating) -> dict:
    return {
        "symbol": r.symbol,
        "date": str(r.date),
        "technical_score": r.technical_score,
        "fundamental_score": r.fundamental_score,
        "ai_score": r.ai_score,
        "composite_score": r.composite_score,
        "recommendation": r.recommendation,
        "horizon": r.horizon,
        "entry_price": r.entry_price,
        "stop_loss": r.stop_loss,
        "target_short_term": r.target_short_term,
        "target_long_term": r.target_long_term,
        "risk_reward_ratio": r.risk_reward_ratio,
        "trend": r.trend,
        "strength": r.strength,
        "key_signal": r.key_signal,
        "reasoning": r.reasoning,
    }


# ── Signals ──────────────────────────────────────────────────────────────────

@router.get("/signals/latest")
def get_latest_signals(
    limit: int = Query(200, ge=1, le=500),
    max_entry_gap_pct: float = Query(10.0, ge=1.0, le=50.0),
    monthly_entry_only: bool = Query(False),
):
    db = SessionLocal()
    try:
        cmp_cache = {}
        sector_cache = {}
        ema50_cache = {}
        stock_symbols = set()
        for si in db.query(StockSectorInfo).all():
            if si.symbol:
                stock_symbols.add(si.symbol)
                sector_cache[si.symbol] = si.sector
            if si.price:
                cmp_cache[si.symbol] = si.price
            if si.ema50 is not None:
                ema50_cache[si.symbol] = si.ema50

        weekly_cache = {}
        for w in db.query(TechnicalSignal).filter(
            TechnicalSignal.timeframe == "weekly"
        ).all():
            weekly_cache[w.symbol] = w

        rows = (
            db.query(TechnicalSignal)
            .filter(TechnicalSignal.timeframe == "daily")
            .order_by(TechnicalSignal.signal_score.desc())
            .all()
        )
        # Apply advisor screening strictly on stock symbols only.
        rows = [r for r in rows if r.symbol in stock_symbols]

        symbols = list({r.symbol for r in rows if r.symbol})
        since = date.today() - timedelta(days=520)
        stock_candles = (
            db.query(HistoricalCandle.symbol, HistoricalCandle.candle_date, HistoricalCandle.close)
            .filter(
                HistoricalCandle.instrument_type == "stock",
                HistoricalCandle.symbol.in_(symbols),
                HistoricalCandle.candle_date >= since,
            )
            .order_by(HistoricalCandle.symbol, HistoricalCandle.candle_date)
            .all()
        ) if symbols else []
        stock_daily_map = {}
        for sym, d, close in stock_candles:
            if close is None:
                continue
            stock_daily_map.setdefault(sym, []).append((d, float(close)))

        bench_rows = (
            db.query(HistoricalCandle.symbol, HistoricalCandle.candle_date, HistoricalCandle.close)
            .filter(
                HistoricalCandle.instrument_type == "index",
                HistoricalCandle.symbol.in_(["NIFTY", "NIFTY 50"]),
                HistoricalCandle.candle_date >= since,
            )
            .order_by(HistoricalCandle.symbol, HistoricalCandle.candle_date)
            .all()
        )
        bench_by_symbol = {}
        for sym, d, close in bench_rows:
            if close is None:
                continue
            bench_by_symbol.setdefault(sym, []).append((d, float(close)))
        bench_daily_points = bench_by_symbol.get("NIFTY") or bench_by_symbol.get("NIFTY 50") or []

        monthly_setup_rows = _compute_monthly_macd_setups(db, limit=2000)
        monthly_by_symbol = {r["symbol"]: r for r in monthly_setup_rows if r.get("symbol")}
        monthly_qualified_symbols = {
            r["symbol"]
            for r in monthly_setup_rows
            if str(r.get("trend", "")).lower() == "bullish"
            and bool(r.get("uptrend_or_trigger") or r.get("monthly_psar_macd_rule"))
        }

        filtered = []
        for s in rows:
            cmp = cmp_cache.get(s.symbol)
            if not cmp or not s.entry_price or not s.stop_loss or not s.target_1:
                continue
            if s.entry_price <= 0:
                continue

            is_bull = s.trend == "bullish"

            # Strict trend quality checks for bullish/uptrend setups.
            rule_meta = {}
            if is_bull:
                passed, rule_meta = _passes_bull_trend_rules(
                    signal=s,
                    cmp_price=cmp,
                    ema50=ema50_cache.get(s.symbol),
                    stock_daily_points=stock_daily_map.get(s.symbol, []),
                    bench_daily_points=bench_daily_points,
                )
                if not passed:
                    continue

            entry_meta = _latest_daily_entry_trigger(stock_daily_map.get(s.symbol, []))
            monthly_meta = monthly_by_symbol.get(s.symbol) or {}
            monthly_qualified = s.symbol in monthly_qualified_symbols
            if is_bull and monthly_entry_only and not (monthly_qualified and entry_meta.get("entry_triggered")):
                continue

            if is_bull:
                hit_target = cmp >= s.target_1
                pct_from_entry = (cmp - s.entry_price) / s.entry_price * 100
            else:
                hit_target = cmp <= s.target_1
                pct_from_entry = (s.entry_price - cmp) / s.entry_price * 100

            if abs(pct_from_entry) > max_entry_gap_pct:
                continue

            risk = abs(s.entry_price - s.stop_loss)
            actionable = not hit_target and abs(pct_from_entry) <= 5
            sl_pct = risk / s.entry_price * 100 if s.entry_price else None

            w = weekly_cache.get(s.symbol)
            weekly_trend = w.trend if w else None
            weekly_st_dir = w.supertrend_direction if w else None
            weekly_aligned = False
            if w:
                if is_bull and w.trend == "bullish":
                    weekly_aligned = True
                elif not is_bull and w.trend == "bearish":
                    weekly_aligned = True

            tier = s.buy_sell_tier or ""
            has_buy_tier = tier in ("B1", "B2")
            has_sell_tier = tier in ("S1", "S2")
            high_conviction = (has_buy_tier and weekly_aligned and is_bull) or \
                              (has_sell_tier and weekly_aligned and not is_bull)

            conv_score = s.signal_score or 0
            if high_conviction:
                conv_score += 30
            elif weekly_aligned:
                conv_score += 15
            if has_buy_tier or has_sell_tier:
                conv_score += 10

            d = _signal_to_dict(s)
            d["cmp"] = round(cmp, 2)
            d["sector"] = sector_cache.get(s.symbol)
            d["pct_from_entry"] = round(pct_from_entry, 1)
            d["hit_target"] = hit_target
            d["actionable"] = actionable
            d["sl_pct"] = round(sl_pct, 1) if sl_pct else None
            d["risk"] = round(risk, 2) if risk else None
            d["weekly_trend"] = weekly_trend
            d["weekly_st_dir"] = weekly_st_dir
            d["weekly_aligned"] = weekly_aligned
            d["high_conviction"] = high_conviction
            d["conviction_score"] = round(conv_score, 1)
            d["monthly_qualified"] = monthly_qualified
            d["entry_triggered"] = bool(entry_meta.get("entry_triggered"))
            d["entry_day"] = entry_meta.get("entry_day")
            d["entry_reason"] = entry_meta.get("entry_reason")
            d["exit_reason"] = "target_1_hit" if hit_target else None
            d["daily_macd_signal"] = entry_meta.get("daily_macd_signal")
            d["daily_macd_signal_ema12"] = entry_meta.get("daily_macd_signal_ema12")
            d["daily_macd_cross_above_ema12"] = bool(entry_meta.get("daily_macd_cross_above_ema12"))
            d["daily_macd_gt_zero"] = bool(entry_meta.get("daily_macd_gt_zero"))
            if monthly_meta:
                d["monthly_setup_trend"] = monthly_meta.get("trend")
                d["monthly_setup_score"] = monthly_meta.get("up_score")
                d["monthly_setup_rule"] = bool(monthly_meta.get("monthly_psar_macd_rule"))

            target_done = bool(hit_target)
            next_scope_target = None
            if target_done and s.target_2:
                if is_bull and cmp < s.target_2:
                    next_scope_target = s.target_2
                elif (not is_bull) and cmp > s.target_2:
                    next_scope_target = s.target_2
            d["target_done"] = target_done
            d["further_scope"] = bool(next_scope_target is not None)
            d["next_scope_target"] = next_scope_target
            if target_done:
                d["status"] = "done"
            elif d["entry_triggered"] and abs(pct_from_entry) <= 2:
                d["status"] = "entry_ready"
            elif actionable:
                d["status"] = "in_trade"
            else:
                d["status"] = "exit_watch"
            if rule_meta:
                d.update(rule_meta)

            filtered.append(d)

        filtered.sort(key=lambda x: -x["conviction_score"])
        filtered = filtered[:limit]

        high_conviction_bullish = [
            x for x in filtered
            if x.get("high_conviction") and str(x.get("trend", "")).lower() == "bullish"
        ]
        high_conviction_bearish = [
            x for x in filtered
            if x.get("high_conviction") and str(x.get("trend", "")).lower() == "bearish"
        ]

        return {
            "count": len(filtered),
            "data": filtered,
            "high_conviction_bullish_count": len(high_conviction_bullish),
            "high_conviction_bearish_count": len(high_conviction_bearish),
            "high_conviction_bullish": high_conviction_bullish[:25],
            "high_conviction_bearish": high_conviction_bearish[:25],
        }
    finally:
        db.close()


@router.get("/signals/monthly-macd-setup")
def get_monthly_macd_setup(
    limit: int = Query(200, ge=1, le=500),
    cache_ttl_sec: int = Query(900, ge=30, le=7200),
):
    now = time.time()
    if (
        _MONTHLY_SETUP_CACHE["data"]
        and now - _MONTHLY_SETUP_CACHE["ts"] < cache_ttl_sec
    ):
        data = _MONTHLY_SETUP_CACHE["data"][:limit]
        return {"count": len(data), "data": data, "cached": True}

    db = SessionLocal()
    try:
        data = _compute_monthly_macd_setups(db, limit=limit)
        _MONTHLY_SETUP_CACHE["data"] = data
        _MONTHLY_SETUP_CACHE["ts"] = now
        return {"count": len(data), "data": data, "cached": False}
    finally:
        db.close()


@router.get("/monthly-macd-setup")
def get_monthly_macd_setup_v2(
    limit: int = Query(200, ge=1, le=500),
    cache_ttl_sec: int = Query(900, ge=30, le=7200),
):
    # Non-conflicting route (preferred by frontend)
    return get_monthly_macd_setup(limit=limit, cache_ttl_sec=cache_ttl_sec)


@router.get("/signals/attached-filter-indicator")
def get_attached_filter_indicator(
    limit: int = Query(150, ge=1, le=500),
    min_market_cap_cr: float = Query(2000.0, ge=0),
    rel_vol_threshold: float = Query(5.0, ge=0.1, le=50.0),
    symbols: str = Query("", description="Optional CSV symbols"),
    refresh: bool = Query(False),
    cache_ttl_sec: int = Query(120, ge=15, le=900),
):
    """
    Stock pass screener based on attached filter logic:
    1) Weekly close progression:
       W0 > W-1, W-1 > W-2, W-2 < W-3
    2) Daily close > previous week high
    3) Daily close > EMA200 and EMA21
    4) Market cap > min_market_cap_cr
    5) Latest 5m close > previous 5m close
    6) Latest 5m rel-volume > rel_vol_threshold
    """
    req_symbols = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    cache_key = f"{limit}|{min_market_cap_cr}|{rel_vol_threshold}|{','.join(sorted(req_symbols))}"
    now = time.time()
    if (
        (not refresh)
        and _ATTACHED_INDICATOR_CACHE["data"]
        and _ATTACHED_INDICATOR_CACHE["key"] == cache_key
        and (now - _ATTACHED_INDICATOR_CACHE["ts"] < cache_ttl_sec)
    ):
        cached_data = _ATTACHED_INDICATOR_CACHE["data"][:limit]
        return {
            "count": len(cached_data),
            "data": cached_data,
            "cached": True,
            "scan_symbols": len(cached_data),
            "rule": {
                "min_market_cap_cr": min_market_cap_cr,
                "rel_vol_threshold": rel_vol_threshold,
            },
        }

    db = SessionLocal()
    try:
        stock_rows = db.query(StockSectorInfo).order_by(StockSectorInfo.id.desc()).all()
        latest_stock_by_symbol = {}
        for r in stock_rows:
            sym = (r.symbol or "").upper().strip()
            if not sym:
                continue
            if req_symbols and sym not in req_symbols:
                continue
            if sym not in latest_stock_by_symbol:
                latest_stock_by_symbol[sym] = r

        universe_symbols = list(latest_stock_by_symbol.keys())
        if not universe_symbols:
            return {
                "count": 0,
                "data": [],
                "cached": False,
                "scan_symbols": 0,
                "rule": {
                    "min_market_cap_cr": min_market_cap_cr,
                    "rel_vol_threshold": rel_vol_threshold,
                },
            }

        since = date.today() - timedelta(days=380)
        candle_rows = (
            db.query(
                HistoricalCandle.symbol,
                HistoricalCandle.candle_date,
                HistoricalCandle.open,
                HistoricalCandle.high,
                HistoricalCandle.low,
                HistoricalCandle.close,
                HistoricalCandle.volume,
            )
            .filter(
                HistoricalCandle.instrument_type == "stock",
                HistoricalCandle.symbol.in_(universe_symbols),
                HistoricalCandle.candle_date >= since,
            )
            .order_by(HistoricalCandle.symbol, HistoricalCandle.candle_date)
            .all()
        )

        daily_map = {}
        for sym, d, o, h, l, c, v in candle_rows:
            if c is None:
                continue
            daily_map.setdefault(sym, []).append((d, o, h, l, c, v))

        prefiltered = []
        for sym in universe_symbols:
            stock = latest_stock_by_symbol[sym]
            daily = daily_map.get(sym, [])
            if len(daily) < 210:
                continue

            closes = [float(x[4]) for x in daily if x[4] is not None]
            if len(closes) < 210:
                continue
            ema21 = _ema_last(closes, 21)
            ema200 = _ema_last(closes, 200)
            d_close = float(closes[-1])
            if ema21 is None or ema200 is None:
                continue

            week_data = {}
            for d, o, h, l, c, v in daily:
                y, w, _ = d.isocalendar()
                k = (y, w)
                cur = week_data.get(k)
                if cur is None:
                    week_data[k] = {
                        "date": d,
                        "close": float(c) if c is not None else None,
                        "high": float(h) if h is not None else None,
                    }
                else:
                    if cur["date"] <= d:
                        cur["date"] = d
                        cur["close"] = float(c) if c is not None else cur["close"]
                    if h is not None:
                        cur["high"] = max(cur["high"], float(h)) if cur["high"] is not None else float(h)
            weekly = [week_data[k] for k in sorted(week_data.keys()) if week_data[k].get("close") is not None]
            if len(weekly) < 4:
                continue

            w0 = float(weekly[-1]["close"])
            w1 = float(weekly[-2]["close"])
            w2 = float(weekly[-3]["close"])
            w3 = float(weekly[-4]["close"])
            prev_week_high = weekly[-2]["high"]

            cond_week = (w0 > w1) and (w1 > w2) and (w2 < w3)
            cond_daily_break = bool(prev_week_high is not None and d_close > float(prev_week_high))
            cond_daily_ema = d_close > ema200
            market_cap_cr = _parse_market_cap_cr(getattr(stock, "market_cap", None))
            cond_mc = bool(market_cap_cr is not None and market_cap_cr > min_market_cap_cr)

            if cond_week and cond_daily_break and cond_daily_ema and cond_mc:
                prefiltered.append(
                    {
                        "symbol": sym,
                        "sector": stock.sector,
                        "subsector": stock.subsector,
                        "market_cap": stock.market_cap,
                        "market_cap_cr": round(market_cap_cr, 2) if market_cap_cr is not None else None,
                        "daily_close": round(d_close, 2),
                        "ema21": round(float(ema21), 2),
                        "ema200": round(float(ema200), 2),
                        "week_close": round(w0, 2),
                        "week_1_close": round(w1, 2),
                        "week_2_close": round(w2, 2),
                        "week_3_close": round(w3, 2),
                        "week_1_high": round(float(prev_week_high), 2) if prev_week_high is not None else None,
                    }
                )

        result = []
        for row in prefiltered:
            m5 = _latest_5m_metrics(row["symbol"])
            if not m5.get("ok"):
                continue
            close_now = float(m5["close_now"])
            close_prev = float(m5["close_prev"])
            rel_vol = float(m5["rel_vol"])
            cond_5m_price = close_now > close_prev
            cond_5m_vol = rel_vol > rel_vol_threshold
            if not (cond_5m_price and cond_5m_vol):
                continue

            result.append(
                {
                    **row,
                    "close_5m": round(close_now, 2),
                    "prev_close_5m": round(close_prev, 2),
                    "vol_5m": round(float(m5["vol_now"]), 0),
                    "vol_5m_ema20": round(float(m5["vol_ema20"]), 0),
                    "rel_vol_5m": round(rel_vol, 2),
                    "source_5m": m5.get("source", "yfinance"),
                }
            )

        result.sort(key=lambda x: (x.get("rel_vol_5m") or 0, x.get("market_cap_cr") or 0), reverse=True)
        result = result[:limit]

        _ATTACHED_INDICATOR_CACHE["ts"] = now
        _ATTACHED_INDICATOR_CACHE["key"] = cache_key
        _ATTACHED_INDICATOR_CACHE["data"] = result

        return {
            "count": len(result),
            "data": result,
            "cached": False,
            "scan_symbols": len(universe_symbols),
            "prefiltered_symbols": len(prefiltered),
            "rule": {
                "min_market_cap_cr": min_market_cap_cr,
                "rel_vol_threshold": rel_vol_threshold,
            },
        }
    finally:
        db.close()


@router.get("/signals/{symbol}")
def get_signals(
    symbol: str,
    limit: int = Query(10, ge=1, le=50),
    cache_ttl_sec: int = Query(900, ge=30, le=7200),
):
    # Defensive alias: if route matching resolves this path as a symbol,
    # still return monthly setup payload for compatibility.
    if symbol.lower() == "monthly-macd-setup":
        return get_monthly_macd_setup(limit=limit, cache_ttl_sec=cache_ttl_sec)

    db = SessionLocal()
    try:
        rows = (
            db.query(TechnicalSignal)
            .filter_by(symbol=symbol.upper())
            .order_by(TechnicalSignal.date.desc())
            .limit(limit)
            .all()
        )
        return {"count": len(rows), "data": [_signal_to_dict(s) for s in rows]}
    finally:
        db.close()


def _signal_to_dict(s: TechnicalSignal) -> dict:
    return {
        "symbol": s.symbol,
        "timeframe": s.timeframe,
        "date": str(s.date),
        "scan_time": str(s.scan_time) if s.scan_time else None,
        "ema5": s.ema5, "ema21": s.ema21, "ema200": s.ema200,
        "ema_cross": s.ema_cross,
        "macd": s.macd, "macd_signal": s.macd_signal,
        "macd_histogram": s.macd_histogram, "macd_cross": s.macd_cross,
        "rsi": s.rsi, "cci": s.cci, "adx": s.adx,
        "di_plus": s.di_plus, "di_minus": s.di_minus,
        "buy_sell_tier": s.buy_sell_tier,
        "supertrend": s.supertrend,
        "supertrend_direction": s.supertrend_direction,
        "supertrend_flip": s.supertrend_flip,
        "ttm_squeeze": s.ttm_squeeze, "ttm_momentum": s.ttm_momentum,
        "donchian_upper": s.donchian_upper, "donchian_lower": s.donchian_lower,
        "donchian_breakout": s.donchian_breakout,
        "vwap": s.vwap, "psar": s.psar, "atr_vstop": s.atr_vstop,
        "volume_ratio": s.volume_ratio, "volume_strength": s.volume_strength,
        "is_52w_high": s.is_52w_high, "is_52w_low": s.is_52w_low,
        "relative_strength": s.relative_strength,
        "signal_score": s.signal_score, "trend": s.trend,
        "signal_type": s.signal_type,
        "entry_price": s.entry_price, "stop_loss": s.stop_loss,
        "target_1": s.target_1, "target_2": s.target_2,
    }


# ── Fundamentals ─────────────────────────────────────────────────────────────

@router.get("/fundamentals/{symbol}")
def get_fundamentals(symbol: str, limit: int = Query(20, ge=1, le=50)):
    db = SessionLocal()
    try:
        rows = (
            db.query(StockFundamentals)
            .filter_by(symbol=symbol.upper())
            .order_by(StockFundamentals.fetched_at.desc())
            .limit(limit)
            .all()
        )
        return {
            "count": len(rows),
            "data": [
                {
                    "period": r.period, "period_type": r.period_type,
                    "revenue": r.revenue, "operating_profit": r.operating_profit,
                    "opm_pct": r.opm_pct, "net_profit": r.net_profit,
                    "eps": r.eps,
                    "revenue_yoy_pct": r.revenue_yoy_pct,
                    "profit_yoy_pct": r.profit_yoy_pct,
                    "eps_yoy_pct": r.eps_yoy_pct,
                    "roe": r.roe, "roce": r.roce,
                    "debt_to_equity": r.debt_to_equity,
                    "pe_ratio": r.pe_ratio, "pb_ratio": r.pb_ratio,
                    "dividend_yield": r.dividend_yield,
                    "promoter_holding_pct": r.promoter_holding_pct,
                    "fii_holding_pct": r.fii_holding_pct,
                    "dii_holding_pct": r.dii_holding_pct,
                    "public_holding_pct": r.public_holding_pct,
                }
                for r in rows
            ],
        }
    finally:
        db.close()


# ── AI Analysis ──────────────────────────────────────────────────────────────

@router.get("/analysis/{symbol}")
def get_analyses(symbol: str, limit: int = Query(5, ge=1, le=20)):
    db = SessionLocal()
    try:
        rows = (
            db.query(StockAnalysis)
            .filter_by(symbol=symbol.upper())
            .order_by(StockAnalysis.created_at.desc())
            .limit(limit)
            .all()
        )
        return {
            "count": len(rows),
            "data": [
                {
                    "id": r.id,
                    "analysis_type": r.analysis_type,
                    "summary": r.summary,
                    "report": r.report_json,
                    "rating": r.rating,
                    "confidence": r.confidence,
                    "target_price": r.target_price,
                    "horizon": r.horizon,
                    "key_catalysts": r.key_catalysts,
                    "key_risks": r.key_risks,
                    "llm_provider": r.llm_provider,
                    "created_at": str(r.created_at),
                }
                for r in rows
            ],
        }
    finally:
        db.close()


@router.get("/weekly-research/{symbol}")
def get_weekly_research(symbol: str):
    """Return latest weekly Freedom Research analysis for a stock."""
    db = SessionLocal()
    try:
        row = (
            db.query(StockAnalysis)
            .filter_by(symbol=symbol.upper(), analysis_type="weekly_research")
            .order_by(StockAnalysis.created_at.desc())
            .first()
        )
        if not row:
            raise HTTPException(status_code=404, detail="No weekly research found")
        return {
            "symbol": row.symbol,
            "summary": row.summary,
            "report": row.report_json,
            "rating": row.rating,
            "confidence": row.confidence,
            "target_price": row.target_price,
            "horizon": row.horizon,
            "created_at": str(row.created_at),
        }
    finally:
        db.close()


@router.post("/analyze/{symbol}")
def trigger_analysis(symbol: str, analysis_type: str = Query("earnings")):
    sym = symbol.upper()

    # Auto-fetch fundamentals from screener.in before running AI analysis
    try:
        from app.external.screener_fetcher import fetch_fundamentals, upsert_fundamentals
        periods = fetch_fundamentals(sym)
        if periods:
            upsert_fundamentals(sym, periods)
            logger.info(f"Screener: fetched {len(periods)} periods for {sym}")
        else:
            logger.warning(f"Screener: no data for {sym}")
    except Exception as e:
        logger.warning(f"Screener fetch failed for {sym}: {e}")

    from app.external.ai_analyst import (
        analyze_company_deep,
        analyze_earnings,
        analyze_growth_fundamentals,
        generate_equity_report,
        run_freedom_research,
    )

    fn_map = {
        "earnings": analyze_earnings,
        "deep_review": analyze_company_deep,
        "growth": analyze_growth_fundamentals,
        "equity_report": generate_equity_report,
        "weekly_research": run_freedom_research,
    }
    fn = fn_map.get(analysis_type)
    if not fn:
        raise HTTPException(status_code=400, detail=f"Invalid type: {analysis_type}")

    result = fn(sym)
    if not result:
        raise HTTPException(status_code=500, detail="Analysis failed – check LLM API keys")
    return {"status": "ok", "analysis_type": analysis_type, "result": result}


class CompareBody(BaseModel):
    symbols: List[str]


@router.post("/compare")
def compare_stocks_api(body: CompareBody):
    if len(body.symbols) < 2 or len(body.symbols) > 3:
        raise HTTPException(status_code=400, detail="Provide 2-3 symbols")
    sym_list = [s.upper() for s in body.symbols]
    _prefetch_screener(sym_list)
    from app.external.ai_analyst import compare_stocks
    result = compare_stocks(sym_list)
    if not result:
        raise HTTPException(status_code=500, detail="Comparison failed")
    return {"status": "ok", "result": result}


@router.get("/signals/weekly-level-cross-up")
def get_weekly_level_cross_up_alerts(limit: int = Query(100, ge=1, le=500), symbol: Optional[str] = None):
    """
    Display recent weekly LOW/MID/HIGH cross-up alerts generated by live scanner.
    """
    db = SessionLocal()
    try:
        q = (
            db.query(Alert)
            .filter(Alert.alert_type.like("weekly_cross_up_%"))
            .order_by(desc(Alert.timestamp))
        )
        if symbol:
            q = q.filter(Alert.symbol == symbol.upper())
        rows = q.limit(limit).all()
        out = []
        for r in rows:
            sd = r.signal_detail or {}
            out.append(
                {
                    "id": r.id,
                    "symbol": r.symbol,
                    "alert_type": r.alert_type,
                    "severity": r.severity,
                    "message": r.message,
                    "source": r.source,
                    "level_name": sd.get("level_name"),
                    "level_value": sd.get("level_value"),
                    "timestamp": str(r.timestamp),
                    "is_sent_telegram": r.is_sent_telegram,
                }
            )
        return {"count": len(out), "data": out}
    finally:
        db.close()


@router.post("/signals/live-scan-now")
def run_live_scan_now():
    """
    Execute one immediate intraday scan cycle across watchlist symbols.
    This allows on-demand 5m alert generation/Telegram dispatch without
    waiting for the background scanner interval.
    """
    try:
        from app.external.live_signal_scanner import scan_cycle
        scan_cycle()
        return {"status": "ok", "message": "Live 5m scan executed"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to run live scan: {e}")


@router.post("/alerts/resend-pending-weekly-cross")
def resend_pending_weekly_cross_alerts(limit: int = Query(200, ge=1, le=2000)):
    """
    Re-send pending weekly LOW/MID/HIGH cross alerts via Telegram and
    mark rows as sent when delivery succeeds.
    """
    db = SessionLocal()
    try:
        rows = (
            db.query(Alert)
            .filter(
                Alert.alert_type.like("weekly_cross_up_%"),
                Alert.is_sent_telegram.is_(False),
            )
            .order_by(desc(Alert.timestamp))
            .limit(limit)
            .all()
        )
        if not rows:
            return {"status": "ok", "total": 0, "sent": 0, "failed": 0}

        from app.notifications.telegram_notifier import send_stock_alert

        sent = 0
        failed = 0
        for row in rows:
            sd = row.signal_detail or {}
            ok = send_stock_alert(
                {
                    "symbol": row.symbol,
                    "alert_type": row.alert_type,
                    "severity": row.severity or "critical",
                    "message": row.message or "",
                    "trend": sd.get("trend") or "uptrend",
                    "signal_score": sd.get("signal_score"),
                    "signal_type": sd.get("signal_type") or "buy",
                    "entry": sd.get("entry"),
                    "stop_loss": sd.get("stop_loss"),
                    "target_1": sd.get("target_1"),
                    "target_2": sd.get("target_2"),
                }
            )
            if ok:
                row.is_sent_telegram = True
                sent += 1
            else:
                failed += 1

        db.commit()
        return {"status": "ok", "total": len(rows), "sent": sent, "failed": failed}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to resend pending alerts: {e}")
    finally:
        db.close()


# ── Alerts ───────────────────────────────────────────────────────────────────

@router.get("/alerts")
def get_alerts(
    source: Optional[str] = None,
    severity: Optional[str] = None,
    symbol: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
):
    db = SessionLocal()
    try:
        q = db.query(Alert).order_by(Alert.timestamp.desc())
        if source:
            q = q.filter(Alert.source == source)
        if severity:
            q = q.filter(Alert.severity == severity)
        if symbol:
            q = q.filter(Alert.symbol == symbol.upper())
        rows = q.limit(limit).all()

        sym_signals = {}
        alert_syms = list({r.symbol for r in rows if r.symbol})
        if alert_syms:
            sigs = (
                db.query(TechnicalSignal)
                .filter(
                    TechnicalSignal.symbol.in_(alert_syms),
                    TechnicalSignal.timeframe == "daily",
                )
                .order_by(TechnicalSignal.date.desc())
                .all()
            )
            for s in sigs:
                if s.symbol not in sym_signals:
                    sym_signals[s.symbol] = s

        def _try_float(v):
            if v is None:
                return None
            try:
                return float(v)
            except (ValueError, TypeError):
                return None

        def _alert_to_dict(a):
            sd = a.signal_detail or {}
            entry = _try_float(sd.get("entry"))
            sl = _try_float(sd.get("stop_loss"))
            t1 = _try_float(sd.get("target_1"))
            t2 = _try_float(sd.get("target_2"))
            score = _try_float(sd.get("signal_score"))

            if entry is None or sl is None:
                sig = sym_signals.get(a.symbol)
                if sig:
                    entry = entry or sig.entry_price
                    sl = sl or sig.stop_loss
                    t1 = t1 or sig.target_1
                    t2 = t2 or sig.target_2
                    score = score if score is not None else sig.signal_score

            return {
                "id": a.id,
                "symbol": a.symbol,
                "alert_type": a.alert_type,
                "severity": a.severity,
                "source": a.source,
                "message": a.message,
                "entry_price": entry,
                "stop_loss": sl,
                "target_1": t1,
                "target_2": t2,
                "indicator": sd.get("indicator"),
                "signal_score": score,
                "is_read": a.is_read,
                "is_sent_telegram": a.is_sent_telegram,
                "timestamp": str(a.timestamp),
            }

        return {
            "count": len(rows),
            "data": [_alert_to_dict(a) for a in rows],
        }
    finally:
        db.close()


@router.put("/alerts/{alert_id}/read")
def mark_alert_read(alert_id: int):
    db = SessionLocal()
    try:
        row = db.query(Alert).filter_by(id=alert_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="Alert not found")
        row.is_read = True
        db.commit()
        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


# ── Portfolio Health ─────────────────────────────────────────────────────────

@router.get("/portfolio-health")
def portfolio_health(symbols: str = Query(..., description="Comma-separated symbols")):
    sym_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    if not sym_list:
        raise HTTPException(status_code=400, detail="No symbols provided")
    _prefetch_screener(sym_list)
    from app.external.ai_analyst import analyze_portfolio_health
    result = analyze_portfolio_health(sym_list)
    if not result:
        raise HTTPException(status_code=500, detail="Analysis failed")
    return {"status": "ok", "result": result}


# ── Manual refresh ───────────────────────────────────────────────────────────

@router.get("/refresh")
def manual_refresh():
    results = {}

    try:
        from app.external.screener_fetcher import refresh_all_watchlist_fundamentals
        results["screener"] = refresh_all_watchlist_fundamentals()
    except Exception as e:
        results["screener_error"] = str(e)

    try:
        from app.external.technical_engine import run_eod_all
        results["technical_signals"] = run_eod_all()
    except Exception as e:
        results["technical_signals_error"] = str(e)

    try:
        from app.external.technical_engine import run_weekly_all
        results["weekly_signals"] = run_weekly_all()
    except Exception as e:
        results["weekly_signals_error"] = str(e)

    try:
        from app.external.rating_engine import rate_all_watchlist
        results["ratings"] = rate_all_watchlist()
    except Exception as e:
        results["ratings_error"] = str(e)

    return {"status": "ok", **results}

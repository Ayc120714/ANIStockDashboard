"""
Live Signal Scanner – runs every N minutes during market hours on configured
symbol universe, detects new technical signals, generates alerts, and sends
Telegram notifications for critical ones.
"""

import logging
import os
import threading
import time
from datetime import date, datetime
from typing import Dict, List, Optional

from app.config.nse_holidays import is_trading_day
from app.db.database import SessionLocal
from app.db.models import Alert, StockSectorInfo, TechnicalSignal, Watchlist
from app.external.technical_engine import run_intraday_analysis
from app.external.weekly_level_cross_5m_alerts import detect_cross_up_events as detect_weekly_cross_up_events

logger = logging.getLogger(__name__)

_scanner_thread: Optional[threading.Thread] = None
_stop_event = threading.Event()
_previous_signals: Dict[str, Dict] = {}
_telegram_event_cache: Dict[str, float] = {}
_price_rsi_history: Dict[str, List[Dict]] = {}


def _to_float(v):
    try:
        return float(v)
    except Exception:
        return None


def _append_price_rsi_point(symbol: str, indicators: Dict):
    close_val = _to_float(indicators.get("intraday_close") or indicators.get("ema5"))
    rsi_val = _to_float(indicators.get("rsi"))
    hist_val = _to_float(indicators.get("macd_histogram"))
    if close_val is None or rsi_val is None:
        return
    arr = _price_rsi_history.get(symbol) or []
    arr.append(
        {
            "close": close_val,
            "rsi": rsi_val,
            "hist": hist_val,
            "ts": datetime.now().isoformat(),
        }
    )
    _price_rsi_history[symbol] = arr[-90:]


def _pivot_lows(vals: List[float], left: int = 2, right: int = 2) -> List[int]:
    out: List[int] = []
    n = len(vals)
    for i in range(left, n - right):
        v = vals[i]
        if all(v <= vals[j] for j in range(i - left, i + right + 1) if j != i):
            out.append(i)
    return out


def _pivot_highs(vals: List[float], left: int = 2, right: int = 2) -> List[int]:
    out: List[int] = []
    n = len(vals)
    for i in range(left, n - right):
        v = vals[i]
        if all(v >= vals[j] for j in range(i - left, i + right + 1) if j != i):
            out.append(i)
    return out


def _detect_divergence_alerts(symbol: str) -> List[Dict]:
    rows = _price_rsi_history.get(symbol) or []
    if len(rows) < 20:
        return []
    closes = [float(r["close"]) for r in rows]
    rsis = [float(r["rsi"]) for r in rows]
    hists = [r.get("hist") for r in rows]
    alerts: List[Dict] = []

    lows = _pivot_lows(closes)
    if len(lows) >= 2:
        i1, i2 = lows[-2], lows[-1]
        p1, p2 = closes[i1], closes[i2]
        r1, r2 = rsis[i1], rsis[i2]
        h1 = _to_float(hists[i1])
        h2 = _to_float(hists[i2])
        hist_ok = (h1 is None or h2 is None) or (h2 > h1)
        if p2 < p1 * 0.998 and r2 > (r1 + 1.5) and hist_ok and r2 <= 55:
            alerts.append(
                {
                    "alert_type": "rsi_divergence_bullish_5m",
                    "severity": "critical",
                    "indicator": "RSI Divergence",
                    "detail": (
                        f"Bullish divergence (5m): price LL {p1:.2f}->{p2:.2f}, "
                        f"RSI HL {r1:.1f}->{r2:.1f}"
                    ),
                }
            )

    highs = _pivot_highs(closes)
    if len(highs) >= 2:
        i1, i2 = highs[-2], highs[-1]
        p1, p2 = closes[i1], closes[i2]
        r1, r2 = rsis[i1], rsis[i2]
        h1 = _to_float(hists[i1])
        h2 = _to_float(hists[i2])
        hist_ok = (h1 is None or h2 is None) or (h2 < h1)
        if p2 > p1 * 1.002 and r2 < (r1 - 1.5) and hist_ok and r2 >= 45:
            alerts.append(
                {
                    "alert_type": "rsi_divergence_bearish_5m",
                    "severity": "critical",
                    "indicator": "RSI Divergence",
                    "detail": (
                        f"Bearish divergence (5m): price HH {p1:.2f}->{p2:.2f}, "
                        f"RSI LH {r1:.1f}->{r2:.1f}"
                    ),
                }
            )

    return alerts


def _get_scan_symbols() -> List[str]:
    db = SessionLocal()
    try:
        out: List[str] = []
        seen = set()

        # Always include watchlist symbols.
        wl_rows = db.query(Watchlist.symbol).distinct().all()
        for (sym,) in wl_rows:
            s = str(sym or "").strip().upper()
            if s and s not in seen:
                seen.add(s)
                out.append(s)

        include_all = os.getenv("SIGNAL_SCAN_INCLUDE_ALL_STOCKS", "true").lower() == "true"
        if include_all:
            all_rows = db.query(StockSectorInfo.symbol).distinct().all()
            for (sym,) in all_rows:
                s = str(sym or "").strip().upper()
                if s and s not in seen:
                    seen.add(s)
                    out.append(s)

        max_scan = int(os.getenv("SIGNAL_SCAN_MAX_SYMBOLS", "0") or 0)
        if max_scan > 0:
            out = out[:max_scan]

        return out
    finally:
        db.close()


def _detect_new_signals(symbol: str, current: Dict, previous: Optional[Dict]) -> List[Dict]:
    """Compare current vs previous scan and return list of alert dicts."""
    alerts: List[Dict] = []
    if not current:
        return alerts

    prev = previous or {}

    # SuperTrend flip
    if current.get("supertrend_flip") in ("buy", "sell"):
        alerts.append({
            "alert_type": f"supertrend_{current['supertrend_flip']}",
            "severity": "critical",
            "indicator": "SuperTrend",
            "detail": f"SuperTrend flipped to {current['supertrend_flip'].upper()}",
        })

    # Buy/Sell tier change (B2/B3/S2/S3 only to reduce noise)
    cur_tier = current.get("buy_sell_tier")
    prev_tier = prev.get("buy_sell_tier")
    if cur_tier and cur_tier != prev_tier and cur_tier in ("B2", "B3", "S2", "S3"):
        severity = "critical" if cur_tier in ("B3", "S3") else "warning"
        side = "BUY" if cur_tier.startswith("B") else "SELL"
        alerts.append({
            "alert_type": cur_tier.lower(),
            "severity": severity,
            "indicator": "RSI/CCI/ADX",
            "detail": f"{side} signal tier {cur_tier}",
        })

    # MACD crossover
    if current.get("macd_cross") in ("buy", "sell") and prev.get("macd_cross") != current["macd_cross"]:
        alerts.append({
            "alert_type": f"macd_{current['macd_cross']}",
            "severity": "warning",
            "indicator": "MACD",
            "detail": f"MACD {current['macd_cross'].upper()} crossover",
        })

    # Volume spike (>3x average)
    vol_ratio = current.get("volume_ratio") or 0
    prev_vol = prev.get("volume_ratio") or 0
    if vol_ratio >= 3.0 and prev_vol < 3.0:
        alerts.append({
            "alert_type": "volume_spike",
            "severity": "warning",
            "indicator": "Volume",
            "detail": f"Volume spike {vol_ratio:.1f}x average",
        })

    # VWAP cross
    cur_vwap = current.get("vwap")
    if cur_vwap and prev:
        prev_close = prev.get("ema5")  # approximate previous close from EMA5
        cur_close = current.get("ema5")
        if prev_close and cur_close:
            if prev_close < cur_vwap and cur_close > cur_vwap:
                alerts.append({
                    "alert_type": "vwap_cross_above",
                    "severity": "info",
                    "indicator": "VWAP",
                    "detail": "Price crossed above VWAP",
                })
            elif prev_close > cur_vwap and cur_close < cur_vwap:
                alerts.append({
                    "alert_type": "vwap_cross_below",
                    "severity": "info",
                    "indicator": "VWAP",
                    "detail": "Price crossed below VWAP",
                })

    # Donchian breakout
    if current.get("donchian_breakout") and prev.get("donchian_breakout") != current["donchian_breakout"]:
        direction = current["donchian_breakout"]
        alerts.append({
            "alert_type": f"donchian_{direction}",
            "severity": "warning",
            "indicator": "Donchian",
            "detail": f"Donchian channel breakout {direction.upper()}",
        })

    return alerts


def _save_alerts(symbol: str, alerts_data: List[Dict], indicators: Dict):
    if not alerts_data:
        return
    db = SessionLocal()
    try:
        for a in alerts_data:
            entry = a.get("entry", indicators.get("entry_price"))
            sl = a.get("stop_loss", indicators.get("stop_loss"))
            t1 = a.get("target_1", indicators.get("target_1"))
            t2 = a.get("target_2", indicators.get("target_2"))
            levels_txt = (
                f" | Entry: {entry:.2f}" if isinstance(entry, (int, float)) else ""
            ) + (
                f" | SL: {sl:.2f}" if isinstance(sl, (int, float)) else ""
            ) + (
                f" | T1: {t1:.2f}" if isinstance(t1, (int, float)) else ""
            ) + (
                f" | T2: {t2:.2f}" if isinstance(t2, (int, float)) else ""
            )
            msg = f"[{symbol}] {a['detail']}{levels_txt} | Score: {indicators.get('signal_score', '?')}"
            alert = Alert(
                symbol=symbol,
                alert_type=a["alert_type"],
                severity=a["severity"],
                source="intraday",
                message=msg,
                signal_detail={
                    "indicator": a["indicator"],
                    "signal_score": indicators.get("signal_score"),
                    "signal_type": indicators.get("signal_type"),
                    "entry": entry,
                    "stop_loss": sl,
                    "target_1": t1,
                    "target_2": t2,
                },
                timestamp=datetime.now(),
            )
            db.add(alert)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Error saving alerts for {symbol}: {e}")
    finally:
        db.close()


def _send_telegram_for_critical(symbol: str, alerts_data: List[Dict], indicators: Dict):
    critical = [a for a in alerts_data if a["severity"] in ("critical", "warning")]
    if not critical:
        return
    try:
        from app.notifications.telegram_notifier import send_stock_alert
        for a in critical:
            entry = a.get("entry", indicators.get("entry_price"))
            sl = a.get("stop_loss", indicators.get("stop_loss"))
            t1 = a.get("target_1", indicators.get("target_1"))
            t2 = a.get("target_2", indicators.get("target_2"))
            send_stock_alert({
                "symbol": symbol,
                "alert_type": a["alert_type"],
                "severity": a["severity"],
                "message": a["detail"],
                "trend": indicators.get("trend"),
                "signal_score": indicators.get("signal_score"),
                "signal_type": indicators.get("signal_type"),
                "entry": entry,
                "stop_loss": sl,
                "target_1": t1,
                "target_2": t2,
            })
    except Exception as e:
        logger.debug(f"Telegram send failed for {symbol}: {e}")


def _should_send_telegram_event(cache_key: str, ttl_sec: int = 900) -> bool:
    """Simple in-memory dedup guard for event spam protection."""
    now = time.time()
    prev = _telegram_event_cache.get(cache_key)
    if prev and (now - prev) < ttl_sec:
        return False
    _telegram_event_cache[cache_key] = now
    return True


def _send_entry_exit_events(symbol: str, indicators: Dict):
    """Send entry/exit/target lifecycle events for intraday validated streams."""
    try:
        from app.notifications.telegram_notifier import send_stock_alert
    except Exception as e:
        logger.debug(f"Telegram import failed for {symbol}: {e}")
        return

    entry = indicators.get("entry_price")
    sl = indicators.get("stop_loss")
    t1 = indicators.get("target_1")
    t2 = indicators.get("target_2")
    signal_type = str(indicators.get("signal_type") or "").lower()
    is_bull = "sell" not in signal_type and not signal_type.startswith("s")

    events = []
    if indicators.get("macd_cross") == "buy" and indicators.get("macd_signal", 0) > 0 and entry and sl and t1:
        events.append(("ENTRY_READY", "critical", "Monthly-qualified daily MACD trigger aligned"))
    if indicators.get("supertrend_flip") == "sell" or indicators.get("macd_cross") == "sell":
        events.append(("EXIT_READY", "warning", "Exit condition detected from intraday stream"))

    cmp_price = None
    try:
        db = SessionLocal()
        row = db.query(StockSectorInfo).filter(StockSectorInfo.symbol == symbol).first()
        cmp_price = row.price if row else None
        db.close()
    except Exception:
        pass

    target_done = False
    if cmp_price and t1:
        target_done = (cmp_price >= t1) if is_bull else (cmp_price <= t1)
    if target_done:
        events.append(("TARGET_DONE", "info", "Target 1 reached; evaluate further scope"))

    for event_type, severity, reason in events:
        dedup_key = f"{symbol}:{event_type}:{datetime.now().strftime('%Y%m%d%H')}"
        if not _should_send_telegram_event(dedup_key):
            continue
        send_stock_alert({
            "symbol": symbol,
            "alert_type": event_type,
            "severity": severity,
            "message": reason,
            "trend": indicators.get("trend"),
            "signal_score": indicators.get("signal_score"),
            "signal_type": indicators.get("signal_type"),
            "entry": entry,
            "stop_loss": sl,
            "target_1": t1,
            "target_2": t2,
        })


def scan_cycle():
    """Execute one full scan cycle across all watchlist symbols."""
    global _previous_signals

    symbols = _get_scan_symbols()
    if not symbols:
        logger.debug("No watchlist symbols to scan")
        return

    logger.info(f"Live scan: {len(symbols)} watchlist symbols")
    new_signals: Dict[str, Dict] = {}

    for sym in symbols:
        try:
            indicators = run_intraday_analysis(sym)
            if not indicators:
                continue

            _append_price_rsi_point(sym, indicators)
            new_signals[sym] = indicators
            prev = _previous_signals.get(sym)
            alerts_data = _detect_new_signals(sym, indicators, prev)

            # Weekly LOW/MID/HIGH cross-up alerts on 5m close stream.
            prev_close_5m = _to_float((prev or {}).get("intraday_close") or (prev or {}).get("ema5"))
            cur_close_5m = _to_float(indicators.get("intraday_close") or indicators.get("ema5"))
            weekly_cross_alerts = detect_weekly_cross_up_events(sym, prev_close_5m, cur_close_5m)
            if weekly_cross_alerts:
                alerts_data.extend(weekly_cross_alerts)
            divergence_alerts = _detect_divergence_alerts(sym)
            if divergence_alerts:
                gated = []
                for a in divergence_alerts:
                    key = f"{sym}:{a.get('alert_type')}:{datetime.now().strftime('%Y%m%d%H')}"
                    if _should_send_telegram_event(key, ttl_sec=2 * 60 * 60):
                        gated.append(a)
                if gated:
                    alerts_data.extend(gated)

            if alerts_data:
                _save_alerts(sym, alerts_data, indicators)
                _send_telegram_for_critical(sym, alerts_data, indicators)

            _send_entry_exit_events(sym, indicators)

            # Save intraday TechnicalSignal snapshot
            db = SessionLocal()
            try:
                row = TechnicalSignal(
                    symbol=sym,
                    timeframe="intraday",
                    date=date.today(),
                    scan_time=datetime.now(),
                    **{k: v for k, v in indicators.items()
                       if k not in ("nearest_supply", "nearest_demand", "smc_structure")
                       and hasattr(TechnicalSignal, k)},
                )
                db.add(row)
                db.commit()
            except Exception:
                db.rollback()
            finally:
                db.close()

        except Exception as e:
            logger.debug(f"Scan error for {sym}: {e}")

    _previous_signals = new_signals


def _run_loop():
    interval = int(os.getenv("SIGNAL_SCAN_INTERVAL", "5")) * 60
    logger.info(f"Live signal scanner started (interval={interval}s)")

    while not _stop_event.is_set():
        if not is_trading_day():
            _stop_event.wait(60)
            continue

        now = datetime.now()
        market_start = now.replace(hour=9, minute=25, second=0, microsecond=0)
        market_end = now.replace(hour=15, minute=20, second=0, microsecond=0)

        if now < market_start or now > market_end:
            _stop_event.wait(30)
            continue

        try:
            scan_cycle()
        except Exception as e:
            logger.error(f"Scan cycle error: {e}")

        _stop_event.wait(interval)

    logger.info("Live signal scanner stopped")


def start_scanner():
    global _scanner_thread
    if not os.getenv("SIGNAL_SCAN_ENABLED", "true").lower() == "true":
        logger.info("Live signal scanner disabled via SIGNAL_SCAN_ENABLED")
        return
    if _scanner_thread and _scanner_thread.is_alive():
        logger.info("Scanner already running")
        return
    _stop_event.clear()
    _scanner_thread = threading.Thread(target=_run_loop, daemon=True)
    _scanner_thread.start()


def stop_scanner():
    global _scanner_thread
    _stop_event.set()
    if _scanner_thread and _scanner_thread.is_alive():
        _scanner_thread.join(timeout=15)
    _scanner_thread = None
    logger.info("Live signal scanner stopped")

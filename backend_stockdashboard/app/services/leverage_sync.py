from __future__ import annotations

import csv
import html
import io
import re
import urllib.request
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.db.models import SymbolLeverage

DHAN_MARGIN_PAGE_URL = "https://dhan.co/calculators/margin-calculator/"
DHAN_MARGIN_SHEET_CSV_URL = (
    "https://docs.google.com/spreadsheets/d/"
    "1zqhM3geRNW_ZzEx62y0W5U2ZlaXxG-NDn0V8sJk5TQ4/export?format=csv&gid=1663719548"
)
SAMCO_MARGIN_PAGE_URL = "https://www.samco.in/calculators/equity-margin-calculator"

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
)

_last_sync_meta: dict = {
    "last_run_at": None,
    "status": "never",
    "summary": None,
    "error": None,
}


def _fetch_text(url: str, timeout: int = 60) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as resp:  # nosec - controlled URL constants
        charset = resp.headers.get_content_charset() or "utf-8"
        return resp.read().decode(charset, errors="ignore")


def _to_positive_float(value) -> float | None:
    if value is None:
        return None
    if isinstance(value, str):
        value = value.strip()
        if not value or value in {"-", "--", "N/A", "NA"}:
            return None
        value = value.replace("x", "").replace("X", "").replace("%", "").strip()
    try:
        n = float(value)
    except (TypeError, ValueError):
        return None
    return n if n > 0 else None


def _normalize_symbol(symbol: str) -> str:
    return str(symbol or "").strip().upper()


def _normalize_broker(broker: str) -> str:
    return str(broker or "").strip().lower()


def _upsert_leverage(
    db: Session,
    *,
    broker: str,
    symbol: str,
    intraday_leverage: float | None,
    margin_leverage: float | None,
    delivery_leverage: float | None,
    source: str,
    notes: str | None = None,
) -> str:
    b = _normalize_broker(broker)
    s = _normalize_symbol(symbol)
    if not b or not s:
        return "invalid"
    if intraday_leverage is None and margin_leverage is None and delivery_leverage is None:
        return "invalid"

    row = db.query(SymbolLeverage).filter(SymbolLeverage.broker == b, SymbolLeverage.symbol == s).first()
    if row is None:
        db.add(
            SymbolLeverage(
                broker=b,
                symbol=s,
                intraday_leverage=intraday_leverage,
                margin_leverage=margin_leverage,
                delivery_leverage=delivery_leverage,
                source=source,
                notes=notes,
            )
        )
        return "inserted"

    changed = (
        row.intraday_leverage != intraday_leverage
        or row.margin_leverage != margin_leverage
        or row.delivery_leverage != delivery_leverage
        or row.source != source
        or row.notes != notes
    )
    if not changed:
        return "unchanged"

    row.intraday_leverage = intraday_leverage
    row.margin_leverage = margin_leverage
    row.delivery_leverage = delivery_leverage
    row.source = source
    row.notes = notes
    row.updated_at = datetime.utcnow()
    return "updated"


def _parse_dhan_rows(csv_text: str) -> list[dict]:
    reader = list(csv.reader(io.StringIO(csv_text)))
    if not reader:
        return []

    header_idx = -1
    header = []
    for i, row in enumerate(reader):
        joined = " | ".join(str(c).strip().lower() for c in row if str(c).strip())
        if "symbol / scrip name" in joined and ("mis" in joined or "intraday" in joined) and "mtf" in joined:
            header_idx = i
            header = [str(c).strip().lower() for c in row]
            break
    if header_idx < 0:
        return []

    def idx_for(candidates: list[str]) -> int:
        for cand in candidates:
            for idx, col in enumerate(header):
                if cand in col:
                    return idx
        return -1

    symbol_idx = idx_for(["symbol / scrip", "symbol", "scrip"])
    intraday_idx = idx_for(["mis", "intraday"])
    margin_idx = idx_for(["mtf", "margin trading"])
    isin_idx = idx_for(["isin"])
    if symbol_idx < 0 or intraday_idx < 0:
        return []

    out = []
    for row in reader[header_idx + 1 :]:
        if symbol_idx >= len(row):
            continue
        symbol = _normalize_symbol(row[symbol_idx])
        if not symbol:
            continue
        intraday = _to_positive_float(row[intraday_idx] if intraday_idx < len(row) else None)
        margin = _to_positive_float(row[margin_idx] if margin_idx < len(row) else None)
        if intraday is None and margin is None:
            continue
        isin = row[isin_idx].strip() if isin_idx >= 0 and isin_idx < len(row) else ""
        out.append(
            {
                "broker": "dhan",
                "symbol": symbol,
                "intraday_leverage": intraday,
                "margin_leverage": margin,
                "delivery_leverage": 1.0,
                "source": "dhan_google_sheet",
                "notes": f"ISIN:{isin}" if isin else None,
            }
        )
    return out


def _strip_html_tags(text: str) -> str:
    clean = re.sub(r"<[^>]+>", " ", text)
    clean = html.unescape(clean)
    clean = re.sub(r"\s+", " ", clean).strip()
    return clean


def _parse_samco_rows(page_html: str) -> list[dict]:
    tables = re.findall(r"<table[\s\S]*?</table>", page_html, flags=re.IGNORECASE)
    target = None
    for table in tables:
        lower = table.lower()
        if "mis multiplier" in lower and "cnc multiplier" in lower:
            target = table
            break
    if not target:
        return []

    rows = re.findall(r"<tr[\s\S]*?</tr>", target, flags=re.IGNORECASE)
    parsed_rows: list[list[str]] = []
    for tr in rows:
        cells = re.findall(r"<t[hd][^>]*>([\s\S]*?)</t[hd]>", tr, flags=re.IGNORECASE)
        if not cells:
            continue
        parsed_rows.append([_strip_html_tags(c) for c in cells])
    if not parsed_rows:
        return []

    header = [c.lower() for c in parsed_rows[0]]
    symbol_idx = next((i for i, c in enumerate(header) if "script" in c or "scrip" in c), -1)
    cnc_idx = next((i for i, c in enumerate(header) if "cnc" in c), -1)
    mis_idx = next((i for i, c in enumerate(header) if "mis" in c or "intraday" in c), -1)
    if symbol_idx < 0 or mis_idx < 0:
        return []

    out = []
    for row in parsed_rows[1:]:
        if symbol_idx >= len(row):
            continue
        symbol = _normalize_symbol(row[symbol_idx])
        if not symbol:
            continue
        intraday = _to_positive_float(row[mis_idx] if mis_idx < len(row) else None)
        delivery = _to_positive_float(row[cnc_idx] if cnc_idx >= 0 and cnc_idx < len(row) else None)
        if intraday is None and delivery is None:
            continue
        out.append(
            {
                "broker": "samco",
                "symbol": symbol,
                "intraday_leverage": intraday,
                # Samco page exposes CNC + MIS. Use MIS as margin fallback.
                "margin_leverage": intraday,
                "delivery_leverage": delivery,
                "source": "samco_margin_page",
                "notes": "margin_leverage mirrored from MIS",
            }
        )
    return out


def _merge_dedup_rows(rows: list[dict]) -> list[dict]:
    merged: dict[tuple[str, str], dict] = {}
    for item in rows:
        key = (_normalize_broker(item.get("broker")), _normalize_symbol(item.get("symbol")))
        if not key[0] or not key[1]:
            continue
        merged[key] = item
    return list(merged.values())


def sync_symbol_leverage(db: Session) -> dict:
    result = {
        "dhan_rows": 0,
        "samco_rows": 0,
        "inserted": 0,
        "updated": 0,
        "unchanged": 0,
        "invalid": 0,
    }

    dhan_csv = _fetch_text(DHAN_MARGIN_SHEET_CSV_URL)
    dhan_rows = _parse_dhan_rows(dhan_csv)
    result["dhan_rows"] = len(dhan_rows)

    samco_html = _fetch_text(SAMCO_MARGIN_PAGE_URL)
    samco_rows = _parse_samco_rows(samco_html)
    result["samco_rows"] = len(samco_rows)

    all_rows = _merge_dedup_rows(dhan_rows + samco_rows)
    for item in all_rows:
        status = _upsert_leverage(
            db,
            broker=item["broker"],
            symbol=item["symbol"],
            intraday_leverage=item.get("intraday_leverage"),
            margin_leverage=item.get("margin_leverage"),
            delivery_leverage=item.get("delivery_leverage"),
            source=item.get("source") or "weekly_sync",
            notes=item.get("notes"),
        )
        result[status] += 1

    db.commit()
    return result


def run_leverage_sync(db: Session) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    try:
        summary = sync_symbol_leverage(db)
        _last_sync_meta.update(
            {
                "last_run_at": now,
                "status": "ok",
                "summary": summary,
                "error": None,
            }
        )
        return {"ok": True, "summary": summary}
    except Exception as exc:  # noqa: BLE001 - bubble details to caller
        _last_sync_meta.update(
            {
                "last_run_at": now,
                "status": "error",
                "error": str(exc),
            }
        )
        raise


def get_last_leverage_sync_meta() -> dict:
    return dict(_last_sync_meta)


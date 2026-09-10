"""Data cleaning, deduplication, indicator calculation and export."""

import json
import logging
from datetime import UTC, datetime
from typing import Any

import pandas as pd

from src.config import (
    OUTPUT_PATH,
    SMA_WINDOW,
    STALENESS_DAYS,
    TICKER_DECIMALS,
    TICKER_GROUPS,
    TICKER_LABELS,
)
from src.indicators import compute_indicators

logger = logging.getLogger(__name__)

# Canonical column names mapped from yfinance's lower-cased headers.
COLUMN_MAP = {
    "open": "open",
    "high": "high",
    "low": "low",
    "close": "close",
    "adj close": "close",
    "volume": "volume",
}

BASE_COLS = ["date", "open", "high", "low", "close", "volume"]


def _flatten_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Collapse multi-level columns into a flat, lower-case field set."""
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(-1)
    df.columns = [str(col).strip().lower() for col in df.columns]
    return df


def _round(value: Any) -> float | None:
    """Coerce a numeric value to a rounded float or None for NaN."""
    if value is None:
        return None
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None
    if pd.isna(numeric):
        return None
    return round(numeric, 4)


def _round_int(value: Any) -> int | None:
    """Coerce a volume value to an integer or None for NaN."""
    if value is None:
        return None
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None
    if pd.isna(numeric):
        return None
    return int(numeric)


def clean_frame(df: pd.DataFrame) -> pd.DataFrame:
    """Normalise a raw yfinance frame into a canonical OHLCV table."""
    df = _flatten_columns(df.copy())
    df = df.rename(columns=COLUMN_MAP)

    # Move the date index into a real column.
    df = df.reset_index()
    date_col = next((c for c in df.columns if "date" in str(c).lower()), None)
    if date_col is None:
        raise ValueError("No date column found in frame")
    df = df.rename(columns={date_col: "date"})

    missing = [c for c in BASE_COLS if c not in df.columns]
    if missing:
        raise ValueError(f"Missing columns: {missing}")

    df = df[BASE_COLS]
    df["date"] = pd.to_datetime(df["date"], utc=True).dt.strftime("%Y-%m-%d")

    for col in ("open", "high", "low", "close", "volume"):
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df = df.dropna(subset=["close"])
    df = df.drop_duplicates(subset=["date"])
    df = df.sort_values("date").reset_index(drop=True)
    return df


def _summarize(df: pd.DataFrame) -> dict[str, Any]:
    """Extract headline metrics from the latest row of an enriched frame."""
    if df.empty:
        return {}
    last = df.iloc[-1]

    def value(col: str) -> float | None:
        return _round(last[col]) if col in df.columns else None

    return {
        "latest_date": last["date"],
        "latest_close": value("close"),
        "daily_return_pct": value("daily_return_pct"),
        "sma": value(f"sma_{SMA_WINDOW}d"),
        "rsi_14": value("rsi_14"),
        "high_52w": value("high_52w"),
        "low_52w": value("low_52w"),
        "volatility_20d": value("volatility_20d"),
    }


def _is_stale(data_blocks: list[dict[str, Any]]) -> bool:
    """True when the newest observation across all assets is too old."""
    dates = [
        b["summary"]["latest_date"]
        for b in data_blocks
        if b.get("summary", {}).get("latest_date")
    ]
    if not dates:
        return True
    latest = max(dates)
    latest_dt = datetime.fromisoformat(latest).replace(tzinfo=UTC)
    age_days = (datetime.now(UTC) - latest_dt).days
    return age_days > STALENESS_DAYS


def build_payload(raw: dict[str, pd.DataFrame]) -> dict[str, Any]:
    """Clean, enrich and summarise every ticker frame into a payload dict."""
    data_blocks: list[dict[str, Any]] = []
    tickers: list[str] = []

    for ticker, frame in raw.items():
        try:
            cleaned = clean_frame(frame)
            enriched = compute_indicators(cleaned, SMA_WINDOW)

            extra_cols = [c for c in enriched.columns if c not in BASE_COLS]
            records: list[dict[str, Any]] = []
            for _, row in enriched.iterrows():
                record: dict[str, Any] = {
                    "date": row["date"],
                    "open": _round(row["open"]),
                    "high": _round(row["high"]),
                    "low": _round(row["low"]),
                    "close": _round(row["close"]),
                    "volume": _round_int(row["volume"]),
                }
                for col in extra_cols:
                    record[col] = _round(row[col])
                records.append(record)

            data_blocks.append(
                {
                    "ticker": ticker,
                    "label": TICKER_LABELS.get(ticker, ticker),
                    "group": TICKER_GROUPS.get(ticker, "Other"),
                    "decimals": TICKER_DECIMALS.get(ticker, 2),
                    "summary": _summarize(enriched),
                    "records": records,
                }
            )
            tickers.append(ticker)
            logger.info("Processed %d records for %s", len(records), ticker)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Skipping %s: %s", ticker, exc)

    return {
        "generated_at": datetime.now(UTC).isoformat(),
        "is_stale": _is_stale(data_blocks),
        "tickers": tickers,
        "pipeline_meta": {},
        "alerts": [],
        "data": data_blocks,
    }


def write_json(payload: dict[str, Any]) -> None:
    """Persist the payload to disk as pretty-printed JSON."""
    with open(OUTPUT_PATH, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
    logger.info("Wrote %d ticker(s) to %s", len(payload["data"]), OUTPUT_PATH)


def load_payload() -> dict[str, Any]:
    """Read the persisted dataset back into memory."""
    with open(OUTPUT_PATH, encoding="utf-8") as handle:
        return json.load(handle)

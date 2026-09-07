"""Data cleaning, deduplication, indicator calculation and export."""

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List

import pandas as pd

from src.config import OUTPUT_PATH, SMA_WINDOW

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

    keep = ["date", "open", "high", "low", "close", "volume"]
    missing = [c for c in keep if c not in df.columns]
    if missing:
        raise ValueError(f"Missing columns: {missing}")

    df = df[keep]
    df["date"] = pd.to_datetime(df["date"], utc=True).dt.strftime("%Y-%m-%d")

    for col in ("open", "high", "low", "close", "volume"):
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df = df.dropna(subset=["close"])
    df = df.drop_duplicates(subset=["date"])
    df = df.sort_values("date").reset_index(drop=True)
    return df


def compute_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """Add a simple moving average and daily percentage change."""
    df = df.copy()
    sma_col = f"sma_{SMA_WINDOW}d"
    df[sma_col] = df["close"].rolling(
        window=SMA_WINDOW, min_periods=SMA_WINDOW
    ).mean()
    df["daily_return_pct"] = df["close"].pct_change() * 100.0
    return df


def process_all(raw: Dict[str, pd.DataFrame]) -> Dict[str, Any]:
    """Clean, enrich and persist every ticker frame to a single JSON file."""
    sma_col = f"sma_{SMA_WINDOW}d"
    payload: Dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "tickers": [],
        "data": [],
    }

    for ticker, frame in raw.items():
        try:
            cleaned = clean_frame(frame)
            enriched = compute_indicators(cleaned)

            records: List[Dict[str, Any]] = []
            for _, row in enriched.iterrows():
                records.append(
                    {
                        "date": row["date"],
                        "open": _round(row["open"]),
                        "high": _round(row["high"]),
                        "low": _round(row["low"]),
                        "close": _round(row["close"]),
                        "volume": _round_int(row["volume"]),
                        sma_col: _round(row[sma_col]),
                        "daily_return_pct": _round(row["daily_return_pct"]),
                    }
                )

            payload["tickers"].append(ticker)
            payload["data"].append({"ticker": ticker, "records": records})
            logger.info("Processed %d records for %s", len(records), ticker)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Skipping %s: %s", ticker, exc)

    write_json(payload)
    return payload


def write_json(payload: Dict[str, Any]) -> None:
    """Persist the payload to disk as pretty-printed JSON."""
    with open(OUTPUT_PATH, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
    logger.info("Wrote %d ticker(s) to %s", len(payload["data"]), OUTPUT_PATH)


def load_payload() -> Dict[str, Any]:
    """Read the persisted dataset back into memory."""
    with open(OUTPUT_PATH, "r", encoding="utf-8") as handle:
        return json.load(handle)

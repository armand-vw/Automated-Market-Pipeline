"""Data extraction layer built on top of yfinance."""

import logging
from typing import Dict

import pandas as pd
import yfinance as yf

from src.config import LOOKBACK_DAYS, TICKERS

logger = logging.getLogger(__name__)


def fetch_market_data(tickers: list[str] | None = None) -> Dict[str, pd.DataFrame]:
    """Fetch daily OHLCV data for every configured ticker.

    Uses ``auto_adjust=True`` so the single ``Close`` column is already
    adjusted, which keeps the column structure simple and predictable.
    """
    tickers = tickers or TICKERS
    raw = yf.download(
        tickers=tickers,
        period=f"{LOOKBACK_DAYS}d",
        interval="1d",
        group_by="ticker",
        auto_adjust=True,
        progress=False,
    )

    results: Dict[str, pd.DataFrame] = {}

    # A single ticker is still returned under a MultiIndex, but handle the
    # edge case where yfinance collapses to a flat DataFrame defensively.
    for ticker in tickers:
        try:
            if isinstance(raw.columns, pd.MultiIndex):
                frame = raw[ticker].copy()
            else:
                frame = raw.copy()
            results[ticker] = frame
            logger.info("Fetched %d rows for %s", len(frame), ticker)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Failed to fetch %s: %s", ticker, exc)

    return results

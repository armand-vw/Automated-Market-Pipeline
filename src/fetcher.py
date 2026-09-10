"""Data extraction layer built on top of yfinance."""

import logging
import time

import pandas as pd
import yfinance as yf

from src.config import LOOKBACK_DAYS, TICKERS

logger = logging.getLogger(__name__)

RETRY_ATTEMPTS = 3
RETRY_BACKOFF_SECONDS = 2.0


def _download(tickers: list[str]) -> pd.DataFrame | None:
    """Download with retries and exponential backoff (yfinance is flaky)."""
    last_error: Exception | None = None
    for attempt in range(1, RETRY_ATTEMPTS + 1):
        try:
            return yf.download(
                tickers=tickers,
                period=f"{LOOKBACK_DAYS}d",
                interval="1d",
                group_by="ticker",
                auto_adjust=True,
                progress=False,
            )
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            logger.warning("Download attempt %d/%d failed: %s", attempt, RETRY_ATTEMPTS, exc)
            if attempt < RETRY_ATTEMPTS:
                time.sleep(RETRY_BACKOFF_SECONDS * attempt)
    logger.error("All download attempts failed: %s", last_error)
    return None


def fetch_market_data(
    tickers: list[str] | None = None,
) -> tuple[dict[str, pd.DataFrame], list[str]]:
    """Fetch daily OHLCV data for every configured ticker.

    Returns ``(results, failures)`` where ``failures`` lists the tickers that
    could not be retrieved.
    """
    tickers = tickers or TICKERS
    raw = _download(tickers)

    results: dict[str, pd.DataFrame] = {}
    failures: list[str] = []

    if raw is None:
        return results, list(tickers)

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
            failures.append(ticker)

    return results, failures

"""Tests for technical indicator calculations."""

import pandas as pd
import pytest

from src.indicators import (
    bollinger,
    compute_indicators,
    daily_return,
    ema,
    range_52w,
    rsi,
    sma,
    volatility,
)


@pytest.fixture
def frame() -> pd.DataFrame:
    """A 40-row monotonic OHLCV frame."""
    n = 40
    close = pd.Series(range(100, 100 + n), dtype=float)
    return pd.DataFrame(
        {
            "date": [f"2024-01-{i + 1:02d}" for i in range(n)],
            "open": close - 0.5,
            "high": close + 1.0,
            "low": close - 1.0,
            "close": close,
            "volume": [1000 + i * 10 for i in range(n)],
        }
    )


def test_sma_window_and_values(frame):
    out = sma(frame, 7)
    col = "sma_7d"
    assert col in out.columns
    assert out[col].isna().sum() == 6  # first 6 rows have no full window
    expected = frame["close"].rolling(7).mean()
    assert out[col].iloc[-1] == pytest.approx(expected.iloc[-1])


def test_daily_return(frame):
    out = daily_return(frame)
    assert "daily_return_pct" in out.columns
    expected = frame["close"].pct_change() * 100.0
    assert out["daily_return_pct"].iloc[-1] == pytest.approx(expected.iloc[-1])
    assert out["daily_return_pct"].iloc[0] is None or pd.isna(out["daily_return_pct"].iloc[0])


def test_ema_span(frame):
    out = ema(frame, 20)
    assert "ema_20d" in out.columns
    expected = frame["close"].ewm(span=20, adjust=False).mean()
    assert out["ema_20d"].iloc[-1] == pytest.approx(expected.iloc[-1])


def test_rsi_bounds(frame):
    out = rsi(frame, 14)
    assert "rsi_14" in out.columns
    last = out["rsi_14"].iloc[-1]
    assert 0.0 <= last <= 100.0


def test_bollinger_bands_ordered(frame):
    out = bollinger(frame, 20, 2.0)
    last = out.iloc[-1]
    assert last["bb_lower"] <= last["bb_mid"] <= last["bb_upper"]


def test_volatility_nonnegative(frame):
    out = volatility(frame, 20)
    last = out["volatility_20d"].iloc[-1]
    assert last >= 0.0


def test_range_52w_monotonic(frame):
    out = range_52w(frame)
    last = out.iloc[-1]
    assert last["high_52w"] >= last["low_52w"]


def test_compute_indicators_adds_all_columns(frame):
    enriched = compute_indicators(frame, 7)
    for col in [
        "sma_7d",
        "daily_return_pct",
        "ema_20d",
        "ema_50d",
        "rsi_14",
        "bb_upper",
        "bb_mid",
        "bb_lower",
        "volatility_20d",
        "high_52w",
        "low_52w",
    ]:
        assert col in enriched.columns

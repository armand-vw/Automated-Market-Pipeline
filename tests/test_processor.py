"""Tests for data cleaning and payload construction."""

import pandas as pd
import pytest

from src.processor import _round, build_payload, clean_frame


def _raw_frame() -> pd.DataFrame:
    idx = pd.to_datetime(["2024-01-03", "2024-01-04", "2024-01-03"])
    df = pd.DataFrame(
        {
            "Open": [10.0, 11.0, 12.0],
            "High": [12.0, 12.0, 13.0],
            "Low": [9.0, 10.0, 11.0],
            "Close": [11.0, 11.5, 12.0],
            "Volume": [100, 200, 100],
        },
        index=idx,
    )
    df.index.name = "Date"
    return df


def test_clean_frame_normalises_and_deduplicates():
    cleaned = clean_frame(_raw_frame())
    assert list(cleaned.columns) == ["date", "open", "high", "low", "close", "volume"]
    # duplicate date dropped, chronological order kept
    assert list(cleaned["date"]) == ["2024-01-03", "2024-01-04"]
    assert cleaned["date"].is_unique


def test_clean_frame_handles_multilevel_columns():
    idx = pd.to_datetime(["2024-01-03", "2024-01-04"])
    cols = pd.MultiIndex.from_product([["MSFT"], ["Open", "High", "Low", "Close", "Volume"]])
    df = pd.DataFrame(
        [[10.0, 12.0, 9.0, 11.0, 100], [11.0, 12.0, 10.0, 11.5, 200]],
        index=idx,
        columns=cols,
    )
    df.index.name = "Date"
    cleaned = clean_frame(df)
    assert "close" in cleaned.columns
    assert cleaned["close"].iloc[-1] == 11.5


def test_build_payload_structure():
    raw = {"MSFT": _raw_frame()}
    payload = build_payload(raw)
    assert payload["tickers"] == ["MSFT"]
    assert len(payload["data"]) == 1
    block = payload["data"][0]
    assert block["ticker"] == "MSFT"
    assert block["label"] == "Microsoft"
    assert block["group"] == "Equities"
    assert block["decimals"] == 2
    assert "summary" in block
    assert len(block["records"]) == 2
    record = block["records"][0]
    for key in ["date", "open", "high", "low", "close", "volume", "daily_return_pct"]:
        assert key in record


def test_round_handles_nan_and_none():
    assert _round(None) is None
    assert _round(float("nan")) is None
    assert _round(3.14159) == pytest.approx(3.1416)

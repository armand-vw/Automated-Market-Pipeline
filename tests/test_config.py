"""Tests for configuration loading."""

import src.config as config


def test_tickers_loaded_from_json():
    assert len(config.TICKERS) >= 25
    assert "BTC-USD" in config.TICKERS
    assert "ETH-USD" in config.TICKERS
    assert "^GSPC" in config.TICKERS


def test_labels_and_groups():
    assert config.TICKER_LABELS["BTC-USD"] == "Bitcoin"
    assert config.TICKER_GROUPS["BTC-USD"] == "Crypto"
    assert config.TICKER_GROUPS["MSFT"] == "Equities"


def test_decimals_per_ticker():
    assert config.TICKER_DECIMALS["DOGE-USD"] == 4
    assert config.TICKER_DECIMALS["USDZAR=X"] == 4
    assert config.TICKER_DECIMALS["MSFT"] == 2


def test_scalar_settings():
    assert config.LOOKBACK_DAYS >= 365
    assert config.SMA_WINDOW == 7
    assert config.ALERT_THRESHOLD < 0
    assert config.OUTPUT_PATH.endswith(".json")

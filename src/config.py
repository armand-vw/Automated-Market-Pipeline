"""Configuration loader.

All tunable settings live in ``config.json`` at the repository root. This
module loads that file once and exposes convenient constants for the rest of
the pipeline. Secrets (such as the Discord webhook URL) remain environment
variables and are never committed.
"""

import json
from pathlib import Path
from typing import Any

_CONFIG_PATH = Path(__file__).resolve().parent.parent / "config.json"

with _CONFIG_PATH.open("r", encoding="utf-8") as _handle:
    _CONFIG: dict[str, Any] = json.load(_handle)

LOOKBACK_DAYS = int(_CONFIG.get("lookback_days", 365))
SMA_WINDOW = int(_CONFIG.get("sma_window", 7))
ALERT_THRESHOLD = float(_CONFIG.get("alert_threshold", -2.5))
STALENESS_DAYS = int(_CONFIG.get("staleness_days", 5))
MAX_ALERTS = int(_CONFIG.get("max_alerts", 50))
OUTPUT_PATH = _CONFIG.get("output_path", "data/market_data.json")
DISCORD_WEBHOOK_ENV = _CONFIG.get("discord_webhook_env", "DISCORD_WEBHOOK_URL")

_ASSETS: list[dict[str, Any]] = _CONFIG.get("assets", [])

TICKERS: list[str] = [a["ticker"] for a in _ASSETS]
TICKER_LABELS: dict[str, str] = {a["ticker"]: a.get("label", a["ticker"]) for a in _ASSETS}
TICKER_GROUPS: dict[str, str] = {a["ticker"]: a.get("group", "Other") for a in _ASSETS}
TICKER_DECIMALS: dict[str, int] = {a["ticker"]: int(a.get("decimals", 2)) for a in _ASSETS}

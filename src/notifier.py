"""Discord webhook threshold alert dispatcher."""

import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List

import requests

from src.config import ALERT_THRESHOLD, DISCORD_WEBHOOK_ENV, TICKER_LABELS
from src.processor import load_payload

logger = logging.getLogger(__name__)


def _latest_return(records: List[Dict[str, Any]]) -> float | None:
    """Return the most recent daily return, or None when unavailable."""
    if not records:
        return None
    value = records[-1].get("daily_return_pct")
    if value is None:
        return None
    return float(value)


def check_and_notify() -> List[str]:
    """Evaluate latest daily returns and alert on threshold breaches.

    Fails gracefully (no-op) when the webhook environment variable is
    missing or empty, so local runs never crash on missing secrets.
    """
    webhook_url = os.getenv(DISCORD_WEBHOOK_ENV, "").strip()
    if not webhook_url:
        logger.info("No %s set; skipping Discord alerts.", DISCORD_WEBHOOK_ENV)
        return []

    payload = load_payload()
    triggered: List[str] = []

    for block in payload.get("data", []):
        ticker = block.get("ticker")
        label = block.get("label") or TICKER_LABELS.get(ticker, ticker)
        ret = _latest_return(block.get("records", []))
        if ret is None or ret > ALERT_THRESHOLD:
            continue
        _send_alert(webhook_url, ticker, label, ret)
        triggered.append(ticker)

    return triggered


def _send_alert(webhook_url: str, ticker: str, label: str, ret: float) -> None:
    """POST a rich Discord embed alert to the configured webhook."""
    embed = {
        "title": f"Market Alert: {label}",
        "description": (
            f"{label} ({ticker}) fell {ret:.2f}% in the latest session, "
            f"crossing the {ALERT_THRESHOLD}% threshold."
        ),
        "color": 0xED4245,
        "fields": [
            {"name": "Ticker", "value": ticker, "inline": True},
            {"name": "Daily Return", "value": f"{ret:.2f}%", "inline": True},
            {"name": "Threshold", "value": f"{ALERT_THRESHOLD}%", "inline": True},
        ],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    try:
        response = requests.post(webhook_url, json={"embeds": [embed]}, timeout=10)
        response.raise_for_status()
        logger.info("Alert sent for %s (%.2f%%)", ticker, ret)
    except requests.RequestException as exc:
        logger.error("Failed to send Discord alert for %s: %s", ticker, exc)

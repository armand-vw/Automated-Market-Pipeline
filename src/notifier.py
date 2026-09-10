"""Discord webhook threshold alert dispatcher."""

import logging
import os
from datetime import UTC, datetime
from typing import Any

import requests

from src.config import ALERT_THRESHOLD, DISCORD_WEBHOOK_ENV

logger = logging.getLogger(__name__)


def _latest_return(records: list[dict[str, Any]]) -> float | None:
    """Return the most recent daily return, or None when unavailable."""
    if not records:
        return None
    value = records[-1].get("daily_return_pct")
    if value is None:
        return None
    return float(value)


def check_and_notify(data_blocks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Evaluate latest daily returns and record any threshold breaches.

    Always returns the list of triggered alerts (used for the dashboard's
    alert history). A Discord webhook is only sent when the environment
    variable is set, so local runs never crash on missing secrets.
    """
    webhook_url = os.getenv(DISCORD_WEBHOOK_ENV, "").strip()
    if not webhook_url:
        logger.info("No %s set; recording alerts locally only.", DISCORD_WEBHOOK_ENV)

    alerts: list[dict[str, Any]] = []

    for block in data_blocks:
        ticker = block.get("ticker")
        label = block.get("label") or ticker
        records = block.get("records", [])
        ret = _latest_return(records)
        if ret is None or ret > ALERT_THRESHOLD:
            continue

        alert = {
            "ticker": ticker,
            "label": label,
            "daily_return_pct": ret,
            "date": records[-1].get("date"),
            "triggered_at": datetime.now(UTC).isoformat(),
        }
        alerts.append(alert)
        logger.info("Threshold breach: %s (%.2f%%)", ticker, ret)

        if webhook_url:
            _send_alert(webhook_url, ticker, label, ret)

    return alerts


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
        "timestamp": datetime.now(UTC).isoformat(),
    }

    try:
        response = requests.post(webhook_url, json={"embeds": [embed]}, timeout=10)
        response.raise_for_status()
        logger.info("Alert sent for %s (%.2f%%)", ticker, ret)
    except requests.RequestException as exc:
        logger.error("Failed to send Discord alert for %s: %s", ticker, exc)

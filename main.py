"""Pipeline orchestrator: fetch -> process -> notify -> persist."""

import logging
import sys
from datetime import UTC, datetime
from typing import Any

from src import fetcher, notifier, processor
from src.config import MAX_ALERTS, OUTPUT_PATH

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("main")


def _previous_alerts() -> list[dict[str, Any]]:
    """Load previously persisted alerts so history accumulates across runs."""
    try:
        return processor.load_payload().get("alerts", [])
    except (FileNotFoundError, ValueError):
        return []


def _build_meta(started_at: datetime, rows: int, failures: list[str], ok: bool) -> dict[str, Any]:
    finished_at = datetime.now(UTC)
    return {
        "started_at": started_at.isoformat(),
        "finished_at": finished_at.isoformat(),
        "duration_seconds": round((finished_at - started_at).total_seconds(), 2),
        "status": "ok" if ok else "partial",
        "rows_processed": rows,
        "tickers_fetched": None,  # filled below
        "tickers_failed": failures,
    }


def main() -> int:
    """Run the full ETL pipeline sequentially."""
    started_at = datetime.now(UTC)

    logger.info("Step 1/4: Fetching market data...")
    raw, failures = fetcher.fetch_market_data()
    if not raw:
        logger.error("No ticker data fetched; aborting.")
        return 1

    logger.info("Step 2/4: Processing data...")
    payload = processor.build_payload(raw)

    logger.info("Step 3/4: Evaluating threshold alerts...")
    new_alerts = notifier.check_and_notify(payload["data"])
    if new_alerts:
        logger.info("Alerts triggered: %s", ", ".join(a["ticker"] for a in new_alerts))
    else:
        logger.info("No threshold breaches detected.")

    # Merge with history so the alert log accumulates (newest first, capped).
    alerts = (new_alerts + _previous_alerts())[:MAX_ALERTS]
    payload["alerts"] = alerts

    rows = sum(len(b["records"]) for b in payload["data"])
    payload["pipeline_meta"] = _build_meta(started_at, rows, failures, ok=not failures)
    payload["pipeline_meta"]["tickers_fetched"] = len(payload["tickers"])

    logger.info("Step 4/4: Persisting data...")
    processor.write_json(payload)

    logger.info("Pipeline complete. Output written to %s", OUTPUT_PATH)
    return 0


if __name__ == "__main__":
    sys.exit(main())

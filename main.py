"""Pipeline orchestrator: fetch -> process -> notify."""

import logging
import sys

from src import fetcher, notifier, processor
from src.config import OUTPUT_PATH

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("main")


def main() -> int:
    """Run the full ETL pipeline sequentially."""
    logger.info("Step 1/3: Fetching market data...")
    raw = fetcher.fetch_market_data()
    if not raw:
        logger.error("No ticker data fetched; aborting.")
        return 1

    logger.info("Step 2/3: Processing data...")
    processor.process_all(raw)

    logger.info("Step 3/3: Evaluating threshold alerts...")
    triggered = notifier.check_and_notify()
    if triggered:
        logger.info("Alerts sent for: %s", ", ".join(triggered))
    else:
        logger.info("No threshold breaches detected.")

    logger.info("Pipeline complete. Output written to %s", OUTPUT_PATH)
    return 0


if __name__ == "__main__":
    sys.exit(main())

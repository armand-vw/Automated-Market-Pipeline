"""Central configuration for the automated market pipeline.

Edit these constants to change pipeline behaviour without touching any
processing or notification logic.
"""

# Tickers to fetch (equities and forex pairs supported by yfinance).
TICKERS = ["MSFT", "AMZN", "USDZAR=X"]

# Number of calendar days of daily OHLCV data to fetch.
LOOKBACK_DAYS = 30

# Simple moving average window (in trading days).
SMA_WINDOW = 7

# Daily return (percent) at or below which a Discord alert fires.
ALERT_THRESHOLD = -2.5

# Where the processed dataset is written (served by GitHub Pages).
OUTPUT_PATH = "data/market_data.json"

# Environment variable that holds the Discord webhook URL.
DISCORD_WEBHOOK_ENV = "DISCORD_WEBHOOK_URL"

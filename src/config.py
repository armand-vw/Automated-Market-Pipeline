"""Central configuration for the automated market pipeline.

Edit these constants to change pipeline behaviour without touching any
processing or notification logic.
"""

# Tickers to fetch (equities, indices and forex pairs supported by yfinance).
TICKERS = [
    "MSFT",
    "AMZN",
    "^GSPC",
    "^IXIC",
    "^NDX",
    "^DJI",
    "USDZAR=X",
]

# Friendly display names shown on the dashboard and in Discord alerts.
TICKER_LABELS = {
    "MSFT": "Microsoft",
    "AMZN": "Amazon",
    "^GSPC": "S&P 500",
    "^IXIC": "NASDAQ Composite",
    "^NDX": "NASDAQ-100",
    "^DJI": "Dow Jones",
    "USDZAR=X": "USD / ZAR",
}

# Asset categories used to group the dashboard dropdown and formatting.
TICKER_GROUPS = {
    "MSFT": "Equities",
    "AMZN": "Equities",
    "^GSPC": "Indices",
    "^IXIC": "Indices",
    "^NDX": "Indices",
    "^DJI": "Indices",
    "USDZAR=X": "FX",
}

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

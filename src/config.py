"""Central configuration for the automated market pipeline.

Edit these constants to change pipeline behaviour without touching any
processing or notification logic.
"""

# Tickers to fetch (equities, indices, forex and commodities supported by
# yfinance).
TICKERS = [
    # Equities — global top 10 by market cap.
    "MSFT",
    "AMZN",
    "NVDA",
    "AAPL",
    "GOOGL",
    "META",
    "AVGO",
    "BRK-B",
    "TSM",
    "LLY",
    "2222.SR",
    # Indices — broad market health (global & local).
    "^GSPC",
    "^IXIC",
    "^J203.JO",
    # Forex — key currency pairs.
    "USDZAR=X",
    "EURUSD=X",
    "GBPZAR=X",
    # Commodities — inflation & industrial indicators.
    "GC=F",
    "CL=F",
]

# Friendly display names shown on the dashboard and in Discord alerts.
TICKER_LABELS = {
    "MSFT": "Microsoft",
    "AMZN": "Amazon",
    "NVDA": "NVIDIA",
    "AAPL": "Apple",
    "GOOGL": "Alphabet",
    "META": "Meta",
    "AVGO": "Broadcom",
    "BRK-B": "Berkshire Hathaway",
    "TSM": "TSMC",
    "LLY": "Eli Lilly",
    "2222.SR": "Saudi Aramco",
    "^GSPC": "S&P 500",
    "^IXIC": "NASDAQ Composite",
    "^J203.JO": "JSE Top 40",
    "USDZAR=X": "USD / ZAR",
    "EURUSD=X": "EUR / USD",
    "GBPZAR=X": "GBP / ZAR",
    "GC=F": "Gold Futures",
    "CL=F": "WTI Crude Oil",
}

# Asset categories used to group the dashboard dropdown and formatting.
TICKER_GROUPS = {
    "MSFT": "Equities",
    "AMZN": "Equities",
    "NVDA": "Equities",
    "AAPL": "Equities",
    "GOOGL": "Equities",
    "META": "Equities",
    "AVGO": "Equities",
    "BRK-B": "Equities",
    "TSM": "Equities",
    "LLY": "Equities",
    "2222.SR": "Equities",
    "^GSPC": "Indices",
    "^IXIC": "Indices",
    "^J203.JO": "Indices",
    "USDZAR=X": "FX",
    "EURUSD=X": "FX",
    "GBPZAR=X": "FX",
    "GC=F": "Commodities",
    "CL=F": "Commodities",
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

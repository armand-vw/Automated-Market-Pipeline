# Automated Market Pipeline

A serverless, decoupled market data pipeline and analytics dashboard. A Python ETL job runs nightly via GitHub Actions, fetches financial data across equities, indices, forex, commodities, and crypto, computes technical indicators, exports the results to a JSON file, and sends Discord alerts when a daily drop crosses a configurable threshold. The dashboard is a static site served from GitHub Pages.

**Live app:** <https://armand-vw.github.io/Automated-Market-Pipeline/>

![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/armand-vw/Automated-Market-Pipeline/pipeline.yml?label=pipeline)
![GitHub Pages](https://img.shields.io/badge/pages-live-brightgreen)
![Python](https://img.shields.io/badge/python-3.11-blue)

## Features

- **Nightly ETL** — fetches 365 days of OHLCV data for 25 assets via `yfinance` (with retry/backoff).
- **Technical indicators** — SMA, EMA 20/50, RSI(14), Bollinger Bands, 52-week high/low, and rolling volatility, computed by an extensible indicator registry.
- **Interactive dashboard** — candlestick/line charts (TradingView Lightweight Charts), indicator overlays, timeframe presets, volume sub-chart, and multi-asset comparison.
- **Market overview** — a sortable leaderboard with sparklines across all assets.
- **Discord alerts** — a rich embed fires when an asset's daily return falls at or below `-2.5%`, with a persisted alert history.
- **Tooling** — CSV export, a threshold simulator, a clickable system-health modal, and a dark/light theme.
- **Privacy-first analytics** — a zero-dependency tracker records pageviews and UI interactions in the visitor's own browser; an in-app analytics view (`analytics.html`) summarizes them. No external services, IDs, or accounts.

## Tracked assets

| Group | Assets |
| ----- | ------ |
| **Equities** (11) | `MSFT`, `AMZN`, `NVDA`, `AAPL`, `GOOGL`, `META`, `AVGO`, `BRK-B`, `TSM`, `LLY`, `2222.SR` |
| **Indices** (3) | `^GSPC` (S&P 500), `^IXIC` (NASDAQ Composite), `^J203.JO` (JSE Top 40) |
| **FX** (3) | `USDZAR=X`, `EURUSD=X`, `GBPZAR=X` |
| **Commodities** (2) | `GC=F` (Gold), `CL=F` (WTI Crude Oil) |
| **Crypto** (6) | `BTC-USD`, `ETH-USD`, `SOL-USD`, `XRP-USD`, `ADA-USD`, `DOGE-USD` |

## Architecture

```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│  fetcher.py │──▶│ processor.py │──▶│ notifier.py │──▶│ data/*.json │
└─────────────┘   └─────┬───────┘   └─────────────┘   └──────┬──────┘
      yfinance         indicators.py         Discord webhook         │
                       (registry)                                    ▼
                                              GitHub Pages (index.html + script.js)
```

## Project structure

```
.
├── .github/workflows/pipeline.yml   # CI: lint + test + ETL + auto-commit + deploy
├── src/
│   ├── config.py                    # Loads config.json
│   ├── fetcher.py                   # yfinance extraction (retry/backoff)
│   ├── indicators.py                # Extensible indicator registry
│   ├── processor.py                 # Clean, dedupe, indicators, export
│   └── notifier.py                  # Discord threshold alert dispatcher
├── tests/                           # pytest unit tests
├── config.json                      # Assets, thresholds, lookback, indicators
├── vendor/lightweight-charts...js   # Vendored charting library
├── data/market_data.json            # Generated dataset (committed nightly)
├── index.html / style.css / script.js  # Static dashboard
├── analytics.js                     # First-party tracking (localStorage)
├── analytics.html / analytics-dashboard.js  # Privacy-first analytics view
├── main.py                          # Orchestrator entry point
└── requirements.txt                 # Runtime dependencies
```

## Getting started (local)

```bash
git clone https://github.com/armand-vw/Automated-Market-Pipeline.git
cd Automated-Market-Pipeline

python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt

# (Optional) receive Discord alerts
export DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."

# Run tests and lint
pytest -q
ruff check .

# Run the pipeline
python main.py
```

## Configuration

All tunable settings live in [`config.json`](config.json):

| Key               | Default                 | Purpose                                  |
| ----------------- | ----------------------- | ---------------------------------------- |
| `assets`          | 25 assets               | Tickers, labels, groups, decimals        |
| `lookback_days`   | `365`                   | Days of history to fetch                 |
| `sma_window`      | `7`                     | Simple moving average window             |
| `alert_threshold` | `-2.5`                  | Daily return that triggers a Discord alert |
| `staleness_days`  | `5`                     | Marks data stale if older than this      |
| `max_alerts`      | `50`                    | Alert history retention                  |

### Adding an asset or indicator

- **Asset** — append an entry to `assets` in `config.json` (ticker, label, group, decimals).
- **Indicator** — add a pure function in `src/indicators.py` and register it in the `INDICATORS` dict; the processor applies it automatically.

## Deployment

1. **Discord secret** — *Settings → Secrets and variables → Actions* → add `DISCORD_WEBHOOK_URL`.
2. **GitHub Pages** — *Settings → Pages* → Source: **GitHub Actions**.
3. The nightly workflow (`0 0 * * *`) and any manual run (*Actions → Market Data Pipeline → Run workflow*) lint, test, fetch data, update `data/market_data.json`, commit it back to `main`, and redeploy the site.

## License

MIT © [armand-vw](https://github.com/armand-vw)

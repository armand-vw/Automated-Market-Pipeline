# Automated Market Pipeline

A serverless, decoupled market data pipeline and analytics dashboard. A Python ETL job runs nightly via GitHub Actions, fetches financial and FX data, computes technical indicators, exports the results to a JSON file, and sends Discord alerts when a daily drop crosses a configurable threshold. The dashboard is a static site served directly from GitHub Pages.

**Live app:** <https://armand-vw.github.io/Automated-Market-Pipeline/>

![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/armand-vw/Automated-Market-Pipeline/pipeline.yml?label=pipeline)
![GitHub Pages](https://img.shields.io/badge/pages-live-brightgreen)
![Python](https://img.shields.io/badge/python-3.11-blue)

## Features

- **Nightly ETL** — fetches 30 days of OHLCV data for equities (`MSFT`, `AMZN`), major US indices (`^GSPC`, `^IXIC`, `^NDX`, `^DJI`), and FX (`USDZAR=X`) via `yfinance`.
- **Indicators** — computes a 7-day simple moving average and daily percentage change.
- **Discord alerts** — posts a rich embed when an asset's daily return falls at or below `-2.5%`.
- **Interactive dashboard** — metric cards, a grouped asset selector, a Chart.js line chart, and a historical logs table.

## Architecture

```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│  fetcher.py │──▶│ processor.py│──▶│ notifier.py │──▶│ data/*.json │
└─────────────┘   └─────────────┘   └─────────────┘   └──────┬──────┘
      yfinance         pandas          Discord webhook         │
                                                              ▼
                                              GitHub Pages (index.html + script.js)
```

## Project structure

```
.
├── .github/workflows/pipeline.yml   # GitHub Actions ETL + auto-commit
├── src/
│   ├── config.py                    # Single place to configure the pipeline
│   ├── fetcher.py                   # yfinance data extraction
│   ├── processor.py                 # Clean, dedupe, indicators, export
│   └── notifier.py                  # Discord threshold alert dispatcher
├── data/market_data.json            # Generated dataset (committed nightly)
├── index.html / style.css / script.js  # Static dashboard
├── main.py                          # Orchestrator entry point
└── requirements.txt                 # Dependencies
```

## Getting started (local)

```bash
# 1. Clone and enter the repo
git clone https://github.com/armand-vw/Automated-Market-Pipeline.git
cd Automated-Market-Pipeline

# 2. Create a virtual environment and install dependencies
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 3. (Optional) export a Discord webhook to receive alerts
export DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."

# 4. Run the pipeline
python main.py
```

## Configuration

All tunable settings live in [`src/config.py`](src/config.py):

| Constant           | Default            | Purpose                                   |
| ------------------ | ------------------ | ----------------------------------------- |
| `TICKERS`          | `MSFT, AMZN, ^GSPC, ^IXIC, ^NDX, ^DJI, USDZAR=X` | Assets to fetch        |
| `TICKER_LABELS`    | friendly names     | Display names for the dashboard & alerts  |
| `TICKER_GROUPS`    | `Equities/Indices/FX` | Category used to group the selector   |
| `LOOKBACK_DAYS`    | `30`               | Days of history to fetch                  |
| `SMA_WINDOW`       | `7`                | Simple moving average window              |
| `ALERT_THRESHOLD`  | `-2.5`             | Daily return that triggers a Discord alert|
| `OUTPUT_PATH`      | `data/market_data.json` | Where results are written           |

## Deployment

1. **Discord secret** — in the repo go to *Settings → Secrets and variables → Actions* and add `DISCORD_WEBHOOK_URL`.
2. **GitHub Pages** — go to *Settings → Pages* and set *Source* to **Deploy from a branch**, branch `main`, folder `/ (root)`.
3. The nightly workflow (`0 0 * * *`) and any manual run (`Actions → Market Data Pipeline → Run workflow`) will fetch data, update `data/market_data.json`, and commit it back to `main`, which rebuilds the Pages site automatically.

## License

MIT © [armand-vw](https://github.com/armand-vw)

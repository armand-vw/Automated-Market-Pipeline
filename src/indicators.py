"""Technical indicator calculations.

Every indicator is a pure function that takes the cleaned OHLCV DataFrame
(columns: ``date``, ``open``, ``high``, ``low``, ``close``, ``volume``) and
returns a new DataFrame with one or more additional columns.

To add a new indicator: write a function here and register it in ``INDICATORS``.
The processor applies every registered indicator automatically.
"""

from collections.abc import Callable

import pandas as pd


def sma(df: pd.DataFrame, window: int) -> pd.DataFrame:
    """Simple moving average of close."""
    col = f"sma_{window}d"
    return pd.DataFrame({col: df["close"].rolling(window=window, min_periods=window).mean()})


def daily_return(df: pd.DataFrame) -> pd.DataFrame:
    """Day-over-day percentage change of close."""
    return pd.DataFrame({"daily_return_pct": df["close"].pct_change() * 100.0})


def ema(df: pd.DataFrame, span: int) -> pd.DataFrame:
    """Exponential moving average of close."""
    col = f"ema_{span}d"
    return pd.DataFrame({col: df["close"].ewm(span=span, adjust=False).mean()})


def rsi(df: pd.DataFrame, window: int = 14) -> pd.DataFrame:
    """Relative Strength Index (Wilder's smoothing)."""
    delta = df["close"].diff()
    gain = delta.clip(lower=0.0)
    loss = -delta.clip(upper=0.0)
    avg_gain = gain.ewm(alpha=1.0 / window, min_periods=window, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1.0 / window, min_periods=window, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0.0, float("nan"))
    rsi_series = 100.0 - 100.0 / (1.0 + rs)
    # With no losses the RSI is conventionally 100 (not NaN).
    rsi_series = rsi_series.where(avg_loss != 0.0, 100.0)
    return pd.DataFrame({"rsi_14": rsi_series})


def bollinger(df: pd.DataFrame, window: int = 20, num_std: float = 2.0) -> pd.DataFrame:
    """Bollinger Bands (upper/middle/lower) around a rolling mean."""
    mid = df["close"].rolling(window=window, min_periods=window).mean()
    std = df["close"].rolling(window=window, min_periods=window).std()
    return pd.DataFrame(
        {
            "bb_upper": mid + num_std * std,
            "bb_mid": mid,
            "bb_lower": mid - num_std * std,
        }
    )


def volatility(df: pd.DataFrame, window: int = 20) -> pd.DataFrame:
    """Rolling standard deviation of daily returns, expressed as a percent."""
    return pd.DataFrame(
        {"volatility_20d": df["close"].pct_change().rolling(window=window).std() * 100.0}
    )


def range_52w(df: pd.DataFrame, window: int = 252) -> pd.DataFrame:
    """Rolling 52-week high and low of close."""
    return pd.DataFrame(
        {
            "high_52w": df["close"].rolling(window=window, min_periods=1).max(),
            "low_52w": df["close"].rolling(window=window, min_periods=1).min(),
        }
    )


# Registry: name -> (function, kwargs). Applied in insertion order.
INDICATORS: dict[str, tuple[Callable[..., pd.DataFrame], dict]] = {
    "daily_return": (daily_return, {}),
    "ema_20": (ema, {"span": 20}),
    "ema_50": (ema, {"span": 50}),
    "rsi_14": (rsi, {"window": 14}),
    "bollinger": (bollinger, {"window": 20, "num_std": 2.0}),
    "volatility_20d": (volatility, {"window": 20}),
    "range_52w": (range_52w, {"window": 252}),
}


def compute_indicators(df: pd.DataFrame, sma_window: int = 7) -> pd.DataFrame:
    """Apply the configurable SMA plus every registered indicator."""
    result = df.copy()

    sma_col = f"sma_{sma_window}d"
    result[sma_col] = sma(result, sma_window)[sma_col]

    for _name, (func, kwargs) in INDICATORS.items():
        for col, values in func(result, **kwargs).items():
            result[col] = values

    return result

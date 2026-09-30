"""Simple Moving Average forecast with Holt optional fallback."""
from __future__ import annotations
from dataclasses import dataclass
from typing import Any
import math
import statistics

import pandas as pd
import numpy as np

try:
    from statsmodels.tsa.holtwinters import SimpleExpSmoothing  # type: ignore
    HAS_SM = True
except Exception:
    HAS_SM = False


@dataclass
class ForecastResult:
    data: list[float]
    upper: list[float]
    lower: list[float]
    method: str
    drivers: dict[str, Any]


def _last_n_valid(series: list[float], n: int) -> list[float]:
    clean = [float(x) for x in series if x is not None and not math.isnan(x)]
    if len(clean) == 0:
        return [0.0] * max(1, n)
    return clean[-n:] if len(clean) >= n else clean + [clean[-1]] * (n - len(clean))


def simple_moving_average_forecast(
    series: list[float],
    horizon: int = 7,
    window: int = 7,
    name: str | None = None,
) -> ForecastResult:
    """SMA(w) forecast: each horizon point equals mean of last window points.
    Confidence band = ±1σ of residuals on in-sample 1-step predictions."""
    cleaned = _last_n_valid(series, max(window * 3, horizon))
    method = f"SMA(w={window})"
    # Compute residuals in-sample: for i>=window, residual = point[i] - mean(i-window:i)
    residuals: list[float] = []
    for i in range(window, len(cleaned)):
        win_mean = statistics.fmean(cleaned[i - window:i])
        residuals.append(cleaned[i] - win_mean)
    sigma = statistics.pstdev(residuals) if len(residuals) >= 2 else (statistics.pstdev(cleaned) if len(cleaned) >= 2 else 0.0)
    last_mean = statistics.fmean(cleaned[-window:])
    last_std = statistics.pstdev(cleaned[-window:]) if len(cleaned) >= 2 else 0.0
    forecast: list[float] = [round(last_mean, 4)] * horizon
    upper = [round(x + sigma * 1.0, 4) for x in forecast]
    lower = [round(max(0.0, x - sigma * 1.0), 4) for x in forecast]
    drivers = {
        "window": window,
        "horizon": horizon,
        "points_used": len(cleaned),
        "last_mean": round(last_mean, 4),
        "last_std": round(last_std, 4),
        "residual_std": round(sigma, 4),
        "series": name,
    }
    return ForecastResult(forecast, upper, lower, method, drivers)


def holt_forecast(
    series: list[float],
    horizon: int = 7,
    name: str | None = None,
) -> ForecastResult:
    cleaned = _last_n_valid(series, 30)
    if not HAS_SM or len(cleaned) < 10:
        return simple_moving_average_forecast(series, horizon=horizon, name=name)
    try:
        s = pd.Series(cleaned, dtype=float)
        model = SimpleExpSmoothing(s).fit(optimized=True)
        fc = model.forecast(horizon).tolist()
        resid = (s - model.fittedvalues).dropna().to_numpy()
        sigma = float(np.std(resid)) if len(resid) >= 2 else 0.0
        last_mean = float(np.mean(cleaned[-7:]))
        drivers = {
            "method_detail": "statsmodels SimpleExpSmoothing",
            "horizon": horizon,
            "points_used": len(cleaned),
            "last_mean": round(last_mean, 4),
            "residual_std": round(sigma, 4),
            "series": name,
        }
        return ForecastResult(
            [round(float(x), 4) for x in fc],
            [round(float(x) + sigma, 4) for x in fc],
            [round(max(0.0, float(x) - sigma), 4) for x in fc],
            "Holt/SES",
            drivers,
        )
    except Exception:
        return simple_moving_average_forecast(series, horizon=horizon, name=name)


def forecast(
    series: list[float],
    horizon: int = 7,
    window: int = 7,
    name: str | None = None,
) -> ForecastResult:
    """Dispatch: prefer Holt/SimpleExpSmoothing if statsmodels available and >= 15 pts, else SMA."""
    cleaned = [float(x) for x in series if x is not None and not math.isnan(x)]
    if len(cleaned) >= 15 and HAS_SM:
        return holt_forecast(series, horizon=horizon, name=name)
    return simple_moving_average_forecast(series, horizon=horizon, window=window, name=name)


if __name__ == "__main__":
    demo = [10, 12, 11, 14, 13, 15, 14, 16, 17, 16, 18, 17, 20, 19, 21]
    r = forecast(demo, horizon=7, window=7)
    print(r.method, r.drivers)
    print("forecast:", r.data)
    print("upper   :", r.upper)
    print("lower   :", r.lower)

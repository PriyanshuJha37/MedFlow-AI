"""IQR anomaly detection on a daily series."""
from __future__ import annotations
from dataclasses import dataclass
from typing import Any
import statistics
import math


@dataclass
class Anomaly:
    index: int
    date: str | None
    value: float
    q1: float
    q3: float
    iqr: float
    lower_fence: float
    upper_fence: float
    deviation: float
    magnitude: str  # low / medium / high
    direction: str  # high | low


METHOD = "IQR outlier detection on last N points"


def _percentile(sorted_vals: list[float], p: float) -> float:
    """Linear interpolation percentile (matches numpy default)."""
    if not sorted_vals:
        return 0.0
    if len(sorted_vals) == 1:
        return sorted_vals[0]
    k = (len(sorted_vals) - 1) * (p / 100.0)
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return sorted_vals[int(k)]
    d0 = sorted_vals[int(f)] * (c - k)
    d1 = sorted_vals[int(c)] * (k - f)
    return d0 + d1


def detect(
    series: list[float],
    dates: list[str] | None = None,
    window: int = 14,
    threshold_iqr_mult: float = 1.5,
    extreme_mult: float = 3.0,
) -> dict[str, Any]:
    """Return method + drivers + list of anomalies.

    Each anomaly: {index, date (or None), value, q1, q3, iqr, lower_fence, upper_fence,
                    deviation, magnitude ('low'|'medium'|'high'), direction ('low'|'high')}
    """
    cleaned: list[float] = []
    idxs: list[int] = []
    for i, x in enumerate(series):
        try:
            v = float(x)
            if math.isnan(v):
                continue
            cleaned.append(v)
            idxs.append(i)
        except (TypeError, ValueError):
            continue
    if len(cleaned) < 4:
        return {
            "method": METHOD,
            "drivers": {
                "window": window,
                "threshold_iqr_mult": threshold_iqr_mult,
                "extreme_mult": extreme_mult,
                "points_used": len(cleaned),
                "note": "Insufficient data for IQR; returning no anomalies.",
            },
            "anomalies": [],
        }
    windowed = cleaned[-window:]
    windowed_idxs = idxs[-window:]
    s = sorted(windowed)
    q1 = _percentile(s, 25)
    q3 = _percentile(s, 75)
    iqr = q3 - q1
    lower = q1 - threshold_iqr_mult * iqr
    upper = q3 + threshold_iqr_mult * iqr
    lower_extreme = q1 - extreme_mult * iqr
    upper_extreme = q3 + extreme_mult * iqr
    median = statistics.median(windowed) if windowed else 0.0
    anomalies: list[dict[str, Any]] = []
    for pos, val in enumerate(windowed):
        orig_idx = windowed_idxs[pos]
        if val < lower or val > upper:
            direction = "high" if val > upper else "low"
            # deviation: multiples of IQR away from nearest fence
            if val > upper:
                dev = (val - upper) / max(1e-6, iqr)
                mag = "high" if val >= upper_extreme else ("medium" if dev > 0.7 else "low")
            else:
                dev = (lower - val) / max(1e-6, iqr)
                mag = "high" if val <= lower_extreme else ("medium" if dev > 0.7 else "low")
            anomalies.append(Anomaly(
                index=orig_idx,
                date=(dates[orig_idx] if dates and 0 <= orig_idx < len(dates) else None),
                value=float(val),
                q1=float(q1),
                q3=float(q3),
                iqr=float(iqr),
                lower_fence=float(lower),
                upper_fence=float(upper),
                deviation=round(float(dev), 3),
                magnitude=mag,
                direction=direction,
            ).__dict__)
    drivers = {
        "window": window,
        "threshold_iqr_mult": threshold_iqr_mult,
        "extreme_mult": extreme_mult,
        "points_used": len(cleaned),
        "q1": round(float(q1), 3),
        "q3": round(float(q3), 3),
        "median_window": round(float(median), 3),
        "iqr": round(float(iqr), 3),
        "lower_fence": round(float(lower), 3),
        "upper_fence": round(float(upper), 3),
        "anomaly_count": len(anomalies),
    }
    return {"method": METHOD, "drivers": drivers, "anomalies": anomalies}


if __name__ == "__main__":
    demo = [10, 11, 12, 9, 10, 11, 10, 12, 9, 11, 10, 12, 10, 35, 11, 10]  # 35 is outlier
    res = detect(demo, dates=[f"2024-01-{i+1:02d}" for i in range(len(demo))])
    print(res["method"])
    print("drivers:", res["drivers"])
    for a in res["anomalies"]:
        print("anomaly:", a)

"""Stock-out risk score 0–100 from inventory + daily consumption rate + lead time."""
from __future__ import annotations
from dataclasses import dataclass
from typing import Any
import math
import statistics


@dataclass
class RiskResult:
    score: float
    severity: str
    drivers: dict[str, Any]
    method: str


METHOD = "Piecewise DoRS + volatility + surge (capped 0-100)"


def score_one(
    quantity: int,
    daily_rate_mean: float,
    daily_rate_std: float = 0.0,
    lead_time_days: int = 2,
    reorder_level: int = 100,
    critical_level: int = 30,
    dors_warning: int = 7,
    baseline_30d_rate: float | None = None,
    last_3d_rate: float | None = None,
) -> RiskResult:
    """
    Risk components (capped 0..100):
      - DoRS score: days-of-remaining-stock → 0 if safe up to 95 if critical
      - Volatility term: up to +10 if std/mean high
      - Surge term: up to +15 if last-3d rate > 1.5× baseline
    """
    rate = max(1e-3, float(daily_rate_mean))
    dors = quantity / rate
    base = 0.0
    severity = "low"
    if quantity <= critical_level:
        base = 94.0
        severity = "critical"
    elif dors < 2:
        base = 90.0
        severity = "critical"
    elif dors < float(dors_warning):
        base = 72.0
        severity = "high"
    elif dors < 14:
        base = 55.0
        severity = "medium"
    elif dors < 30:
        base = 30.0
        severity = "medium"
    elif dors < 45:
        base = 15.0
        severity = "low"
    else:
        base = 5.0
        severity = "low"

    # Volatility term (up to 10)
    vol_pct = 0.0
    if daily_rate_mean > 1e-2:
        vol_pct = daily_rate_std / daily_rate_mean
    vol_term = min(10.0, 10.0 * (1 - math.exp(-vol_pct)))

    # Surge term (up to 15)
    surge_flag = False
    surge_factor = 0.0
    if baseline_30d_rate is not None and last_3d_rate is not None and baseline_30d_rate > 1e-2:
        surge_factor = last_3d_rate / baseline_30d_rate
        if surge_factor > 1.5:
            # extra 15 when 3x, scaled
            surge_flag = True
            excess = min(3.0, surge_factor) - 1.0
            surge_term = min(15.0, 15.0 * (excess / 2.0))
        else:
            surge_term = 0.0
    else:
        surge_term = 0.0

    # Reorder boost
    if quantity <= reorder_level and base < 68:
        base = max(base, 68.0)
        if severity == "low":
            severity = "medium"

    raw = base + vol_term + surge_term
    score = max(0.0, min(100.0, round(raw, 2)))

    if score >= 80:
        severity = "critical"
    elif score >= 60:
        severity = "high"
    elif score >= 30:
        severity = "medium"

    drivers = {
        "quantity": int(quantity),
        "daily_rate_mean": round(daily_rate_mean, 4),
        "daily_rate_std": round(daily_rate_std, 4),
        "dors": round(dors, 2),
        "lead_time_days": int(lead_time_days),
        "reorder_level": int(reorder_level),
        "critical_level": int(critical_level),
        "dors_warning_days": int(dors_warning),
        "volatility_pct": round(vol_pct * 100, 2),
        "volatility_term": round(vol_term, 2),
        "surge_factor": round(surge_factor, 3) if surge_factor else None,
        "surge_term": round(surge_term, 2),
        "surge_flag": bool(surge_flag),
        "base_component": round(base, 2),
    }
    return RiskResult(score, severity, drivers, METHOD)


def score_batch(items: list[dict]) -> list[RiskResult]:
    """items: list of dicts with keys matching score_one parameters."""
    out: list[RiskResult] = []
    for it in items:
        out.append(score_one(
            quantity=int(it.get("quantity", 0)),
            daily_rate_mean=float(it.get("dailyRateMean") or it.get("daily_rate_mean") or 0.0),
            daily_rate_std=float(it.get("dailyRateStd") or it.get("daily_rate_std") or 0.0),
            lead_time_days=int(it.get("leadTimeDays", it.get("lead_time_days", 2))),
            reorder_level=int(it.get("reorderLevel", it.get("reorder_level", 100))),
            critical_level=int(it.get("criticalLevel", it.get("critical_level", 30))),
            dors_warning=int(it.get("dorsWarning", it.get("dors_warning", 7))),
            baseline_30d_rate=it.get("baseline30dRate", it.get("baseline_30d_rate")),
            last_3d_rate=it.get("last3dRate", it.get("last_3d_rate")),
        ))
    return out


if __name__ == "__main__":
    # Test cases
    demo = [
        dict(quantity=50, dailyRateMean=30.0, reorderLevel=200, criticalLevel=60),  # critical (<2d)
        dict(quantity=300, dailyRateMean=30.0, reorderLevel=200, criticalLevel=60),  # ~10d -> high
        dict(quantity=1500, dailyRateMean=30.0, reorderLevel=200, criticalLevel=60), # ~50d -> low
        dict(quantity=300, dailyRateMean=10.0, dailyRateStd=12.0, reorderLevel=200, criticalLevel=60, # high volatility
             baseline_30d_rate=10.0, last_3d_rate=35.0),  # surge
    ]
    for i, r in enumerate(score_batch(demo)):
        print(i, r.score, r.severity, r.drivers)

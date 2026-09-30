"""Greedy transfer recommender with explainable rationale strings.

For each medicine across all PHCs we find:
  - Destinations with riskScore > HIGH_RISK_THRESHOLD (default 70)
  - Sources with computed DoRS > SURPLUS_DORS (default 45)
Transfer qty = min(source surplus after 30 DoRS floor, destination 2-week deficit).
Greedy by highest destination risk first, then highest source surplus DoRS.
"""
from __future__ import annotations
from dataclasses import dataclass
from typing import Any
import math


HIGH_RISK_THRESHOLD = 70.0
SURPLUS_DORS_FLOOR = 45.0
SOURCE_SAFETY_DORS = 30.0
DEST_TARGET_DAYS = 14
MIN_TRANSFER_QTY = 10
METHOD = (
    "Greedy transfer selector: risk>70 destinations matched to DoRS>45 sources; "
    "qty = min(source surplus after 30DoRS floor, destination 14-day deficit)"
)


@dataclass
class Proposal:
    sourcePhcId: int
    destPhcId: int
    medicineId: int
    proposedQty: int
    riskScore: float
    rationale: str
    sourceName: str | None = None
    destName: str | None = None
    medicineName: str | None = None
    drivers: dict[str, Any] | None = None


def _dors(qty: int, rate: float) -> float:
    return qty / max(1e-3, float(rate))


def recommend(
    inventory: list[dict],
    *,
    high_risk_threshold: float = HIGH_RISK_THRESHOLD,
    surplus_dors_floor: float = SURPLUS_DORS_FLOOR,
    source_safety_dors: float = SOURCE_SAFETY_DORS,
    dest_target_days: float = DEST_TARGET_DAYS,
    min_transfer_qty: int = MIN_TRANSFER_QTY,
) -> dict[str, Any]:
    """inventory items: {phcId, medicineId, currentQty or current_quantity or quantity,
                          dailyRate or daily_rate, riskScore or risk_score,
                          phcName? (optional), medicineName? (optional)}
    Returns: {method, drivers, proposals:[{...Proposal}]}
    """
    # Normalize input
    items: list[dict] = []
    for raw in inventory:
        qty = int(
            raw.get("currentQty", raw.get("current_quantity", raw.get("quantity", 0)))
        )
        rate = float(
            raw.get("dailyRate", raw.get("daily_rate", raw.get("dailyRateMean", 0.0))) or 0.0
        )
        risk = float(
            raw.get("riskScore", raw.get("risk_score", 0.0)) or 0.0
        )
        items.append({
            "phcId": int(raw["phcId"]),
            "medicineId": int(raw["medicineId"]),
            "qty": qty,
            "rate": rate,
            "risk": risk,
            "phcName": raw.get("phcName") or raw.get("phc_name"),
            "medicineName": raw.get("medicineName") or raw.get("medicine_name"),
            "currentQty": qty,
            "dailyRate": rate,
            "riskScore": risk,
        })

    # Group items by medicineId -> list of items
    by_med: dict[int, list[dict]] = {}
    for it in items:
        by_med.setdefault(int(it["medicineId"]), []).append(it)

    proposals: list[Proposal] = []
    summary_considered = 0
    summary_risk_pairs = 0

    for med_id, group in by_med.items():
        summary_considered += 1
        dests = [
            i for i in group if i["risk"] >= high_risk_threshold and i["rate"] > 0
        ]
        sources = [
            i for i in group if _dors(i["qty"], i["rate"]) >= surplus_dors_floor and i["rate"] > 0
        ]
        if not dests or not sources:
            continue
        # Sort destinations high risk first; sources by descending DoRS
        dests.sort(key=lambda i: i["risk"], reverse=True)
        sources.sort(key=lambda i: _dors(i["qty"], i["rate"]), reverse=True)
        for d in dests:
            summary_risk_pairs += 1
            # 2-week deficit = targetDays*rate - currentQty (positive only)
            target = max(0.0, dest_target_days * d["rate"] - d["qty"])
            if target <= 0:
                continue
            # Try sources one at a time until target met or sources exhausted
            remaining = float(target)
            for s in sources:
                if remaining <= 0:
                    break
                src_rate = s["rate"]
                if src_rate <= 0:
                    continue
                safety_stock_qty = max(0.0, source_safety_dors * src_rate)
                surplus_qty = s["qty"] - safety_stock_qty
                if surplus_qty < min_transfer_qty:
                    continue
                transfer = int(max(
                    float(min_transfer_qty),
                    math.floor(min(surplus_qty, remaining)),
                ))
                if transfer < min_transfer_qty:
                    continue
                src_dors_before = round(_dors(s["qty"], s["rate"]), 2)
                src_dors_after = round(_dors(s["qty"] - transfer, s["rate"]), 2)
                dst_dors_before = round(_dors(d["qty"], d["rate"]), 2)
                dst_dors_after = round(_dors(d["qty"] + transfer, d["rate"]), 2)
                rationale = (
                    f"PHC {s['phcName'] or s['phcId']} has {src_dors_before} DoRS surplus "
                    f"({s['qty']} qty; safety floor {source_safety_dors}DoRS -> surplus "
                    f"{int(surplus_qty)}); PHC {d['phcName'] or d['phcId']} at risk={round(d['risk'],1)} "
                    f"({dst_dors_before} DoRS, deficit ~{int(target)} for {dest_target_days}d target). "
                    f"Transfer {transfer} {s['medicineName'] or 'medicine #'+str(med_id)} gives "
                    f"src→{src_dors_after}DoRS, dst→{dst_dors_after}DoRS (both safe)."
                )
                drivers = {
                    "medId": med_id,
                    "srcPhcId": s["phcId"],
                    "dstPhcId": d["phcId"],
                    "srcRate": round(s["rate"], 3),
                    "dstRate": round(d["rate"], 3),
                    "srcDorsBefore": src_dors_before,
                    "srcDorsAfter": src_dors_after,
                    "dstDorsBefore": dst_dors_before,
                    "dstDorsAfter": dst_dors_after,
                    "srcSafetyFloorQty": int(safety_stock_qty),
                    "srcSurplusQty": int(surplus_qty),
                    "dstDeficitQty": int(target),
                    "transferQty": transfer,
                    "highRiskThreshold": high_risk_threshold,
                    "surplusDorsFloor": surplus_dors_floor,
                }
                proposals.append(Proposal(
                    sourcePhcId=int(s["phcId"]),
                    destPhcId=int(d["phcId"]),
                    medicineId=int(med_id),
                    proposedQty=transfer,
                    riskScore=round(float(d["risk"]), 2),
                    rationale=rationale,
                    sourceName=s.get("phcName"),
                    destName=d.get("phcName"),
                    medicineName=s.get("medicineName"),
                    drivers=drivers,
                ))
                # Mutate: reduce source qty (simulate), reduce remaining deficit
                s["qty"] = int(s["qty"] - transfer)
                d["qty"] = int(d["qty"] + transfer)
                remaining -= transfer

    drivers_summary = {
        "medicines_considered": summary_considered,
        "risk_destinations_found": summary_risk_pairs,
        "proposals_generated": len(proposals),
        "high_risk_threshold": high_risk_threshold,
        "surplus_dors_floor": surplus_dors_floor,
        "source_safety_dors": source_safety_dors,
        "dest_target_days": dest_target_days,
        "min_transfer_qty": min_transfer_qty,
    }
    return {
        "method": METHOD,
        "drivers": drivers_summary,
        "proposals": [p.__dict__ for p in proposals],
    }


if __name__ == "__main__":
    demo = [
        # Paracetamol: PHC1 at risk, PHC3 surplus
        {"phcId": 1, "phcName": "SAKET", "medicineId": 1, "medicineName": "Paracetamol",
         "currentQty": 60, "dailyRate": 30, "riskScore": 88},
        {"phcId": 2, "phcName": "JANAK", "medicineId": 1, "medicineName": "Paracetamol",
         "currentQty": 600, "dailyRate": 30, "riskScore": 40},
        {"phcId": 4, "phcName": "GGN",   "medicineId": 1, "medicineName": "Paracetamol",
         "currentQty": 3000, "dailyRate": 30, "riskScore": 5},
        # ORS: PHC1 low, PHC4 surplus
        {"phcId": 1, "phcName": "SAKET", "medicineId": 2, "medicineName": "ORS",
         "currentQty": 40, "dailyRate": 20, "riskScore": 91},
        {"phcId": 4, "phcName": "GGN",   "medicineId": 2, "medicineName": "ORS",
         "currentQty": 2500, "dailyRate": 20, "riskScore": 4},
    ]
    r = recommend(demo)
    print(r["method"])
    print("drivers:", r["drivers"])
    for p in r["proposals"]:
        print("----")
        print("proposal:", p["sourcePhcId"], "->", p["destPhcId"], p["medicineName"],
              "x", p["proposedQty"], "risk", p["riskScore"])
        print(p["rationale"])

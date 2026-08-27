from __future__ import annotations

PLANS = {
    "trial": {
        "id": "trial",
        "name": "Trial",
        "price_monthly_usd": 0,
        "images_per_month": 250,
        "batch_limit": 25,
        "features": ["Automotive presets", "Quality audit", "ZIP export"],
    },
    "starter": {
        "id": "starter",
        "name": "Starter",
        "price_monthly_usd": 49,
        "images_per_month": 1000,
        "batch_limit": 100,
        "features": ["Everything in Trial", "Catalog manifests", "SKU-safe filenames"],
    },
    "business": {
        "id": "business",
        "name": "Business",
        "price_monthly_usd": 149,
        "images_per_month": 5000,
        "batch_limit": 250,
        "features": ["Everything in Starter", "Team-ready workflow", "Priority processing"],
    },
    "agency": {
        "id": "agency",
        "name": "Agency",
        "price_monthly_usd": 399,
        "images_per_month": 20000,
        "batch_limit": 500,
        "features": ["Everything in Business", "API-ready plan", "White-label ready"],
    },
}


def plan_for(plan_id: str | None) -> dict:
    return PLANS.get((plan_id or "trial").lower(), PLANS["trial"])


def public_plans() -> list[dict]:
    return [PLANS[key] for key in ("trial", "starter", "business", "agency")]

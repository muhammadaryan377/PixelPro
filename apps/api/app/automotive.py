from __future__ import annotations

import re
from pathlib import Path

AUTOMOTIVE_PRESETS = {
    "auto-white-1600": {
        "label": "Auto Parts — White Marketplace",
        "description": "Clean white square for catalog and marketplace listings.",
        "width": 1600,
        "height": 1600,
        "background": "#FFFFFF",
        "background_style": "solid",
        "product_scale": 0.80,
        "padding": 0.10,
        "output_format": "JPEG",
        "quality": 94,
        "remove_bg": True,
        "enhance_quality": True,
        "add_product_shadow": False,
    },
    "auto-blue-1024": {
        "label": "Auto Parts — Blue Catalog",
        "description": "Consistent blue product background for dealer or internal catalogs.",
        "width": 1024,
        "height": 1024,
        "background": "#0D5DA8",
        "background_style": "solid",
        "product_scale": 0.74,
        "padding": 0.13,
        "output_format": "JPEG",
        "quality": 93,
        "remove_bg": True,
        "enhance_quality": True,
        "add_product_shadow": False,
    },
    "auto-studio-1600": {
        "label": "Auto Parts — Soft Studio",
        "description": "Neutral studio output for premium store product pages.",
        "width": 1600,
        "height": 1600,
        "background": "#F6F7F8",
        "background_style": "soft-gray",
        "product_scale": 0.78,
        "padding": 0.11,
        "output_format": "JPEG",
        "quality": 94,
        "remove_bg": True,
        "enhance_quality": True,
        "add_product_shadow": True,
        "shadow_opacity": 50,
        "shadow_blur": 24,
    },
    "auto-shopify-2048": {
        "label": "Auto Parts — Shopify 2048",
        "description": "Large square web asset with efficient WEBP export.",
        "width": 2048,
        "height": 2048,
        "background": "#FFFFFF",
        "background_style": "solid",
        "product_scale": 0.80,
        "padding": 0.10,
        "output_format": "WEBP",
        "quality": 92,
        "remove_bg": True,
        "enhance_quality": True,
        "add_product_shadow": False,
    },
}

AUTO_CATEGORIES = [
    "Engine & components",
    "Brakes",
    "Suspension & steering",
    "Electrical & lighting",
    "Cooling",
    "Transmission & drivetrain",
    "Body & exterior",
    "Interior",
    "Wheels & tyres",
    "Filters & service parts",
    "Accessories",
    "Used / dismantled parts",
]

MARKETPLACE_NOTES = [
    "Presets are production starting points, not marketplace-compliance guarantees.",
    "Preserve genuine manufacturer labels, part numbers and physical markings unless the catalog owner explicitly chooses otherwise.",
    "Only process images the customer owns or is authorized to edit.",
]


def safe_slug(value: str, fallback: str = "part") -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value[:80] or fallback


def sku_from_filename(filename: str, index: int, prefix: str = "PART") -> str:
    raw_name = Path(filename or "").name.strip()
    stem = Path(raw_name).stem.strip()
    if raw_name.startswith(".") and raw_name.count(".") == 1:
        stem = ""
    cleaned = re.sub(r"[^A-Za-z0-9_-]+", "-", stem).strip("-_")
    if cleaned:
        return cleaned[:64].upper()
    prefix = re.sub(r"[^A-Za-z0-9]+", "", prefix).upper()[:12] or "PART"
    return f"{prefix}-{index:04d}"


def output_filename(sku: str, output_format: str) -> str:
    ext = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}.get(output_format.upper(), "jpg")
    return f"{safe_slug(sku, 'part')}-pixelpro.{ext}"


def quality_issues(report: dict) -> list[str]:
    issues: list[str] = []
    if not report.get("resolution_ok", False):
        issues.append("Resolution is below the recommended catalog baseline.")
    if report.get("blurry"):
        issues.append("Image may be blurry or low-detail.")
    if report.get("too_dark"):
        issues.append("Image is unusually dark.")
    if report.get("too_bright"):
        issues.append("Image is unusually bright.")
    if report.get("touching_edge"):
        issues.append("Detected product is touching or nearly touching the canvas edge.")
    if report.get("centered") is False:
        issues.append("Detected product is not horizontally centered.")
    return issues


def roi_estimate(images_per_month: int, manual_minutes_per_image: float, hourly_cost_usd: float, pixelpro_monthly_usd: float) -> dict:
    images = max(0, int(images_per_month))
    minutes = max(0.0, float(manual_minutes_per_image))
    hourly = max(0.0, float(hourly_cost_usd))
    subscription = max(0.0, float(pixelpro_monthly_usd))
    manual_hours = images * minutes / 60.0
    manual_cost = manual_hours * hourly
    estimated_automation_hours = images * 0.15 / 60.0
    estimated_automation_labor = estimated_automation_hours * hourly
    estimated_total = estimated_automation_labor + subscription
    savings = manual_cost - estimated_total
    return {
        "images_per_month": images,
        "manual_hours": round(manual_hours, 2),
        "manual_labor_cost_usd": round(manual_cost, 2),
        "estimated_pixelpro_supervision_hours": round(estimated_automation_hours, 2),
        "estimated_pixelpro_total_cost_usd": round(estimated_total, 2),
        "estimated_monthly_savings_usd": round(savings, 2),
        "estimated_annual_savings_usd": round(savings * 12, 2),
        "assumption": "Automation supervision is modeled at 0.15 minute per image; validate with real customer workflows before using in sales material.",
    }

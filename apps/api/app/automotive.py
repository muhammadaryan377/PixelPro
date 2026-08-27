from __future__ import annotations

import re
from pathlib import Path

MARKETPLACE_PROFILES = {
    "amazon-main-1600": {
        "marketplace": "Amazon",
        "label": "Amazon Main Image — 1600",
        "description": "Pure-white main-image profile with high product occupancy.",
        "verified_on": "2026-08-27",
        "rules_summary": [
            "Pure white background (RGB 255,255,255) for main images",
            "No added text, graphics or watermarks",
            "Actual product must be clearly represented",
            "1000+ px supports zoom; this profile uses 1600×1600",
            "Target product occupancy is set above 85%",
        ],
        "source": "Amazon Seller Central image guidance",
        "source_url": "https://sellercentral.amazon.com/seller-forums/discussions/t/13af96ea-6b07-4bf9-8dbe-a13292c2e3b1",
    },
    "ebay-1600": {
        "marketplace": "eBay",
        "label": "eBay Listing — 1600",
        "description": "High-resolution neutral listing profile following current eBay picture policy.",
        "verified_on": "2026-08-27",
        "rules_summary": [
            "At least 500 px on the longest side is required",
            "eBay recommends 1600×1600 for high-quality listing photos",
            "No added borders, text, artwork or watermarks",
            "Used, damaged or defective items should use photos of the actual item",
        ],
        "source": "eBay Picture Policy and Seller Center photo tips",
        "source_url": "https://www.ebay.com/help/Policy/-/Picture_policy?id=4370",
    },
    "shopify-square-2048": {
        "marketplace": "Shopify",
        "label": "Shopify Square — 2048",
        "description": "Consistent 2048×2048 square product image for ecommerce storefronts.",
        "verified_on": "2026-08-27",
        "rules_summary": [
            "Square product images commonly display best at 2048×2048",
            "Product and collection images can be up to 5000×5000 or 25 megapixels",
            "Files must be below 20 MB",
            "Consistent aspect ratios improve collection-page presentation",
        ],
        "source": "Shopify Help Center product media guidance",
        "source_url": "https://help.shopify.com/en/manual/products/product-media/product-media-types",
    },
}

AUTOMOTIVE_PRESETS = {
    "auto-white-1600": {
        "label": "Auto Parts — White Catalog",
        "description": "Clean white square for general automotive catalog use.",
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
        "profile": "generic",
    },
    "amazon-main-1600": {
        "label": "Amazon Main Image — 1600",
        "description": "Pure white automotive main-image starting profile with 88% target product occupancy.",
        "width": 1600,
        "height": 1600,
        "background": "#FFFFFF",
        "background_style": "solid",
        "product_scale": 0.88,
        "padding": 0.06,
        "output_format": "JPEG",
        "quality": 95,
        "remove_bg": True,
        "enhance_quality": True,
        "add_product_shadow": False,
        "profile": "amazon-main-1600",
    },
    "ebay-1600": {
        "label": "eBay Listing — 1600",
        "description": "High-resolution automotive listing image on a clean neutral background.",
        "width": 1600,
        "height": 1600,
        "background": "#FFFFFF",
        "background_style": "solid",
        "product_scale": 0.84,
        "padding": 0.08,
        "output_format": "JPEG",
        "quality": 94,
        "remove_bg": True,
        "enhance_quality": True,
        "add_product_shadow": False,
        "profile": "ebay-1600",
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
        "profile": "generic",
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
        "profile": "generic",
    },
    "auto-shopify-2048": {
        "label": "Shopify Square — 2048",
        "description": "2048×2048 square storefront asset with efficient WEBP export.",
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
        "profile": "shopify-square-2048",
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
    "Marketplace profiles are versioned production starting points, not permanent compliance guarantees.",
    "Marketplace rules can vary by category, region and future policy changes; operators must review the current official marketplace guidance before publishing.",
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

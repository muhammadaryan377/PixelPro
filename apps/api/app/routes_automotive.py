from __future__ import annotations

import csv
import json
import os
import zipfile
from io import BytesIO, StringIO

from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.automotive import (
    AUTO_CATEGORIES,
    AUTOMOTIVE_PRESETS,
    MARKETPLACE_NOTES,
    MARKETPLACE_PROFILES,
    output_filename,
    quality_issues,
    roi_estimate,
    sku_from_filename,
)
from app.plans import plan_for
from app.platform_store import (
    authenticate_token,
    create_job,
    get_plan_id,
    record_usage,
    update_job,
    usage_summary,
)
from app.services.image_processor import compose, hamming_distance, perceptual_hash, quality_report

router = APIRouter(prefix="/api/v1/automotive", tags=["automotive"])

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_UPLOAD_MB = int(os.getenv("PIXELPRO_MAX_UPLOAD_MB", "20"))
MAX_CATALOG_BATCH = int(os.getenv("PIXELPRO_MAX_CATALOG_BATCH", "500"))


class RoiRequest(BaseModel):
    images_per_month: int = Field(default=3000, ge=0, le=1_000_000)
    manual_minutes_per_image: float = Field(default=2.5, ge=0, le=120)
    hourly_cost_usd: float = Field(default=12.0, ge=0, le=1000)
    pixelpro_monthly_usd: float = Field(default=149.0, ge=0, le=100_000)


def _token(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Authentication required")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(status_code=401, detail="Use Authorization: Bearer <token>")
    return token.strip()


def _require_user(authorization: str | None) -> dict:
    user = authenticate_token(_token(authorization))
    if not user:
        raise HTTPException(status_code=401, detail="Session expired or invalid")
    return user


async def _read_image(file: UploadFile) -> bytes:
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail=f"Unsupported file type: {file.content_type}")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail=f"{file.filename or 'Image'} is empty")
    if len(data) > MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"{file.filename or 'Image'} exceeds {MAX_UPLOAD_MB}MB")
    return data


def _enforce_plan_limits(user: dict, image_count: int) -> tuple[dict, int]:
    account_plan = plan_for(get_plan_id(user["id"]))
    effective_batch_limit = min(MAX_CATALOG_BATCH, int(account_plan["batch_limit"]))
    if image_count > effective_batch_limit:
        raise HTTPException(
            status_code=413,
            detail=f"{account_plan['name']} plan allows up to {effective_batch_limit} images per batch",
        )

    usage = usage_summary(user["id"])
    monthly_limit = int(account_plan["images_per_month"])
    already_used = int(usage["images_processed"])
    remaining = max(0, monthly_limit - already_used)
    if image_count > remaining:
        raise HTTPException(
            status_code=429,
            detail=(
                f"Monthly image quota exceeded. {account_plan['name']} allows {monthly_limit} images/month "
                f"and {remaining} remain this month."
            ),
        )
    return account_plan, remaining


@router.get("/profile")
def automotive_profile() -> dict:
    return {
        "product": "PixelPro Automotive Catalog Studio",
        "positioning": "Batch product-image operations for automotive parts sellers, distributors, dismantlers and ecommerce teams.",
        "categories": AUTO_CATEGORIES,
        "core_workflow": [
            "Upload supplier or warehouse product photos",
            "Remove inconsistent backgrounds",
            "Center and normalize product scale",
            "Apply a catalog preset",
            "Run image quality checks",
            "Detect likely duplicate photos",
            "Export marketplace-ready images plus a CSV manifest",
        ],
        "notes": MARKETPLACE_NOTES,
    }


@router.get("/presets")
def automotive_presets() -> dict:
    return AUTOMOTIVE_PRESETS


@router.get("/marketplace-profiles")
def marketplace_profiles() -> dict:
    return {
        "verified_on": "2026-08-27",
        "profiles": MARKETPLACE_PROFILES,
        "notes": MARKETPLACE_NOTES,
    }


@router.post("/roi")
def automotive_roi(payload: RoiRequest) -> dict:
    return roi_estimate(
        payload.images_per_month,
        payload.manual_minutes_per_image,
        payload.hourly_cost_usd,
        payload.pixelpro_monthly_usd,
    )


@router.post("/audit")
async def audit_image(file: UploadFile = File(...)) -> dict:
    source = await _read_image(file)
    try:
        report = quality_report(source, deep=True)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    issues = quality_issues(report)
    score = max(0, 100 - 15 * len(issues))
    return {
        "filename": file.filename,
        "score": score,
        "status": "ready" if score >= 85 else "review" if score >= 60 else "fix",
        "issues": issues,
        "report": report,
    }


@router.post("/process-catalog")
async def process_catalog(
    files: list[UploadFile] = File(...),
    preset: str = Form("auto-white-1600"),
    vendor: str = Form(""),
    sku_prefix: str = Form("PART"),
    job_name: str = Form("Automotive catalog batch"),
    background: str = Form(""),
    product_scale: float | None = Form(default=None),
    authorization: str | None = Header(default=None),
) -> StreamingResponse:
    user = _require_user(authorization)
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")
    if preset not in AUTOMOTIVE_PRESETS:
        raise HTTPException(status_code=400, detail="Unknown automotive preset")

    account_plan, quota_remaining_before = _enforce_plan_limits(user, len(files))

    preset_definition = AUTOMOTIVE_PRESETS[preset]
    settings = preset_definition.copy()
    settings.pop("label", None)
    settings.pop("description", None)
    settings.pop("profile", None)
    if background:
        settings["background"] = background
        settings["background_style"] = "solid"
    if product_scale is not None:
        if not 0.20 <= product_scale <= 0.95:
            raise HTTPException(status_code=400, detail="Product scale must be between 0.20 and 0.95")
        settings["product_scale"] = product_scale

    job_id = create_job(user["id"], job_name, len(files), preset)
    completed = 0
    failed = 0
    rows: list[dict] = []
    hashes: list[tuple[str, str]] = []

    archive = BytesIO()
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for index, file in enumerate(files, start=1):
            sku = sku_from_filename(file.filename or "", index, sku_prefix)
            source_name = file.filename or f"image-{index}"
            row = {
                "original_filename": source_name,
                "sku": sku,
                "vendor": vendor.strip(),
                "preset": preset,
                "marketplace_profile": preset_definition.get("profile", "generic"),
                "status": "failed",
                "output_filename": "",
                "duplicate_of": "",
                "width": "",
                "height": "",
                "sharpness_score": "",
                "resolution_ok": "",
                "notes": "",
            }
            try:
                source = await _read_image(file)
                source_hash = perceptual_hash(source)
                for previous_name, previous_hash in hashes:
                    if hamming_distance(source_hash, previous_hash) <= 6:
                        row["duplicate_of"] = previous_name
                        break
                hashes.append((source_name, source_hash))

                result = compose(source, **settings)
                output_name = output_filename(sku, str(settings.get("output_format", "JPEG")))
                zf.writestr(f"images/{output_name}", result)
                report = quality_report(result, deep=False)
                issues = quality_issues(report)
                row.update(
                    {
                        "status": "ready" if not issues else "review",
                        "output_filename": output_name,
                        "width": report.get("width", ""),
                        "height": report.get("height", ""),
                        "sharpness_score": report.get("sharpness_score", ""),
                        "resolution_ok": report.get("resolution_ok", ""),
                        "notes": " | ".join(issues),
                    }
                )
                completed += 1
            except Exception as exc:  # Continue the batch and report individual failures.
                failed += 1
                row["notes"] = str(exc)[:240]
            rows.append(row)

        manifest_buffer = StringIO()
        fieldnames = list(rows[0].keys()) if rows else []
        writer = csv.DictWriter(manifest_buffer, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
        zf.writestr("catalog-manifest.csv", manifest_buffer.getvalue())

        summary = {
            "job_id": job_id,
            "company": user["company"],
            "plan": account_plan["name"],
            "preset": preset,
            "marketplace_profile": preset_definition.get("profile", "generic"),
            "vendor": vendor.strip(),
            "total": len(files),
            "completed": completed,
            "failed": failed,
            "review_required": sum(1 for row in rows if row["status"] == "review"),
            "possible_duplicates": sum(1 for row in rows if row["duplicate_of"]),
            "marketplace_note": "Versioned profile only; review current official marketplace rules and category-specific guidance before publishing.",
            "authorization_note": "Customer is responsible for ensuring they own or are authorized to edit uploaded imagery.",
        }
        zf.writestr("batch-report.json", json.dumps(summary, indent=2))

    status = "completed" if failed == 0 else "completed_with_errors" if completed else "failed"
    update_job(job_id, status=status, completed=completed, failed=failed)
    record_usage(user["id"], "automotive-catalog", completed)

    archive.seek(0)
    return StreamingResponse(
        archive,
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename=pixelpro-{job_id}.zip",
            "X-PixelPro-Job": job_id,
            "X-PixelPro-Completed": str(completed),
            "X-PixelPro-Failed": str(failed),
            "X-PixelPro-Plan": str(account_plan["id"]),
            "X-PixelPro-Quota-Remaining": str(max(0, quota_remaining_before - completed)),
        },
    )

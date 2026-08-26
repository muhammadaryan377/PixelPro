from __future__ import annotations

import json
import os
import zipfile
from io import BytesIO

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse

from app.presets import PRESETS
from app.services.image_processor import (
    analyze_reference,
    compose,
    hamming_distance,
    inpaint_cleanup,
    perceptual_hash,
    quality_report,
)

app = FastAPI(title="PixelPro API", version="0.2.0")

allowed_origins = os.getenv("PIXELPRO_CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in allowed_origins if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_UPLOAD_MB = int(os.getenv("PIXELPRO_MAX_UPLOAD_MB", "20"))
MAX_BATCH = int(os.getenv("PIXELPRO_MAX_BATCH", "50"))
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}


def parse_options(raw: str) -> dict:
    try:
        data = json.loads(raw or "{}")
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid options JSON") from exc

    preset_name = data.pop("preset", None)
    options = PRESETS.get(preset_name, {}).copy() if preset_name else {}
    options.update(data)
    if "format" in options and "output_format" not in options:
        options["output_format"] = options.pop("format")
    else:
        options.pop("format", None)
    return options


async def read_image(file: UploadFile) -> bytes:
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail=f"Unsupported file type: {file.content_type}")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(data) > MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File exceeds {MAX_UPLOAD_MB}MB limit")
    return data


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "pixelpro-api", "version": "0.2.0"}


@app.get("/api/v1/presets")
def presets() -> dict:
    return PRESETS


@app.get("/api/v1/features")
def features() -> dict:
    return {
        "free_local": [
            "background-removal",
            "product-centering",
            "smart-resize",
            "solid-and-studio-backgrounds",
            "enhancement",
            "white-balance",
            "denoise",
            "cpu-upscale",
            "shadow",
            "object-cleanup-with-mask",
            "batch-processing",
            "zip-export",
            "reference-match",
            "quality-check",
            "duplicate-detection",
            "format-conversion",
            "compression",
        ],
        "optional_local_ai": ["realesrgan-upscale", "lama-inpainting", "diffusers-background-generation"],
    }


@app.post("/api/v1/process-image")
async def process_image(file: UploadFile = File(...), options: str = Form("{}")) -> Response:
    source = await read_image(file)
    settings = parse_options(options)
    try:
        result = compose(source, **settings)
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    fmt = settings.get("output_format", "JPEG")
    media = {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp"}.get(fmt, "image/jpeg")
    return Response(content=result, media_type=media)


@app.post("/api/v1/process-batch")
async def process_batch(files: list[UploadFile] = File(...), options: str = Form("{}")) -> StreamingResponse:
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")
    if len(files) > MAX_BATCH:
        raise HTTPException(status_code=413, detail=f"Batch limit is {MAX_BATCH} images")

    settings = parse_options(options)
    archive = BytesIO()
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for index, file in enumerate(files, start=1):
            source = await read_image(file)
            try:
                result = compose(source, **settings)
            except (ValueError, TypeError) as exc:
                raise HTTPException(status_code=400, detail=f"{file.filename}: {exc}") from exc

            fmt = settings.get("output_format", "JPEG")
            ext = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}.get(fmt, "jpg")
            stem = (file.filename or f"product-{index}").rsplit(".", 1)[0]
            zf.writestr(f"{stem}-pixelpro.{ext}", result)

    archive.seek(0)
    return StreamingResponse(
        archive,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=pixelpro-batch.zip"},
    )


@app.post("/api/v1/cleanup")
async def cleanup(file: UploadFile = File(...), mask: UploadFile = File(...), radius: int = Form(5)) -> Response:
    source = await read_image(file)
    mask_bytes = await mask.read()
    if not mask_bytes:
        raise HTTPException(status_code=400, detail="Mask is empty")
    try:
        result = inpaint_cleanup(source, mask_bytes, radius=radius)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return Response(content=result, media_type="image/png")


@app.post("/api/v1/quality-check")
async def quality_check(file: UploadFile = File(...), deep: bool = Form(False)) -> dict:
    source = await read_image(file)
    try:
        return quality_report(source, deep=deep)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/v1/analyze-reference")
async def reference(file: UploadFile = File(...)) -> dict:
    source = await read_image(file)
    try:
        return analyze_reference(source)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/v1/find-duplicates")
async def find_duplicates(files: list[UploadFile] = File(...), threshold: int = Form(8)) -> dict:
    if len(files) > MAX_BATCH:
        raise HTTPException(status_code=413, detail=f"Batch limit is {MAX_BATCH} images")
    threshold = max(0, min(int(threshold), 20))
    hashes: list[tuple[str, str]] = []
    for index, file in enumerate(files):
        source = await read_image(file)
        try:
            hashes.append((file.filename or f"image-{index + 1}", perceptual_hash(source)))
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=f"{file.filename}: {exc}") from exc

    pairs = []
    for i in range(len(hashes)):
        for j in range(i + 1, len(hashes)):
            distance = hamming_distance(hashes[i][1], hashes[j][1])
            if distance <= threshold:
                pairs.append({"a": hashes[i][0], "b": hashes[j][0], "distance": distance})
    return {"threshold": threshold, "duplicates": pairs}

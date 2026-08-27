from __future__ import annotations

import base64
import json
import os
from io import BytesIO

import cv2
import httpx
import numpy as np
from PIL import Image, ImageOps


def _vision_data_url(source: bytes) -> tuple[str, int, int]:
    with Image.open(BytesIO(source)) as opened:
        image = ImageOps.exif_transpose(opened).convert("RGB")
    width, height = image.size
    image.thumbnail((1280, 1280), Image.Resampling.LANCZOS)
    output = BytesIO()
    image.save(output, "JPEG", quality=88, optimize=True)
    encoded = base64.b64encode(output.getvalue()).decode("ascii")
    return f"data:image/jpeg;base64,{encoded}", width, height


async def detect_watermark_boxes(source: bytes) -> tuple[list[dict[str, float]], int, int]:
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        raise ValueError("GROQ_API_KEY is not configured")

    data_url, width, height = _vision_data_url(source)
    model = os.getenv("GROQ_VISION_MODEL", "qwen/qwen3.6-27b")
    prompt = """Inspect this image for overlaid watermarks only: translucent text, website names,
stock-photo marks, repeated ownership marks, or logos placed over the main image. Do not mark real
product branding, labels, printed text, controls, or physical logos belonging to the photographed
object. Return JSON only as {\"watermarks\":[{\"x1\":0,\"y1\":0,\"x2\":1000,\"y2\":1000,
\"confidence\":0.0}]}. Coordinates are normalized from 0 to 1000. Return an empty array when unsure."""
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": [
            {"type": "text", "text": prompt},
            {"type": "image_url", "image_url": {"url": data_url}},
        ]}],
        "response_format": {"type": "json_object"},
        "temperature": 0.1,
        "max_completion_tokens": 800,
    }
    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}"},
            json=payload,
        )
    if response.status_code >= 400:
        detail = response.text[:300]
        raise ValueError(f"Groq watermark detection failed ({response.status_code}): {detail}")

    try:
        content = response.json()["choices"][0]["message"]["content"]
        result = json.loads(content)
    except (KeyError, IndexError, TypeError, json.JSONDecodeError) as exc:
        raise ValueError("Groq returned an invalid watermark detection result") from exc

    boxes: list[dict[str, float]] = []
    for raw in result.get("watermarks", []):
        try:
            confidence = float(raw.get("confidence", 0))
            x1, y1 = float(raw["x1"]), float(raw["y1"])
            x2, y2 = float(raw["x2"]), float(raw["y2"])
        except (KeyError, TypeError, ValueError):
            continue
        if confidence < 0.55 or x2 <= x1 or y2 <= y1:
            continue
        boxes.append({
            "x1": max(0, min(1000, x1)), "y1": max(0, min(1000, y1)),
            "x2": max(0, min(1000, x2)), "y2": max(0, min(1000, y2)),
            "confidence": confidence,
        })
    boxes = boxes[:12]
    covered_area = sum((box["x2"] - box["x1"]) * (box["y2"] - box["y1"]) for box in boxes)
    if covered_area > 350_000:
        raise ValueError("Groq detection covered too much of the image; use the manual brush for safety")
    return boxes, width, height


def remove_detected_watermarks(source: bytes, boxes: list[dict[str, float]], radius: int = 5) -> bytes:
    image = cv2.imdecode(np.frombuffer(source, np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Invalid image")
    height, width = image.shape[:2]
    mask = np.zeros((height, width), dtype=np.uint8)
    for box in boxes:
        x1 = round(box["x1"] * width / 1000)
        y1 = round(box["y1"] * height / 1000)
        x2 = round(box["x2"] * width / 1000)
        y2 = round(box["y2"] * height / 1000)
        padding = max(3, round(min(x2 - x1, y2 - y1) * 0.08))
        cv2.rectangle(mask, (max(0, x1-padding), max(0, y1-padding)),
                      (min(width-1, x2+padding), min(height-1, y2+padding)), 255, -1)
    cleaned = cv2.inpaint(image, mask, max(1, min(int(radius), 20)), cv2.INPAINT_TELEA)
    ok, encoded = cv2.imencode(".png", cleaned)
    if not ok:
        raise ValueError("Failed to encode cleaned image")
    return encoded.tobytes()

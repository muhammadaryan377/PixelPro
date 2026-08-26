from __future__ import annotations

import math
import os
from functools import lru_cache
from io import BytesIO
from typing import Literal

import cv2
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, ImageOps
from rembg import new_session, remove

Image.MAX_IMAGE_PIXELS = 50_000_000
OutputFormat = Literal["JPEG", "PNG", "WEBP"]
BackgroundStyle = Literal["solid", "transparent", "studio", "soft-gray", "warm-studio"]


def _hex_to_rgba(value: str) -> tuple[int, int, int, int]:
    value = value.strip().lstrip("#")
    if len(value) != 6:
        raise ValueError("Background color must be a 6-digit hex value")
    try:
        r, g, b = tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))
    except ValueError as exc:
        raise ValueError("Background color must be a valid hex value") from exc
    return r, g, b, 255


def _open_rgba(data: bytes) -> Image.Image:
    try:
        with Image.open(BytesIO(data)) as source:
            corrected = ImageOps.exif_transpose(source)
            if corrected.width * corrected.height > 50_000_000:
                raise ValueError("Image is too large")
            return corrected.convert("RGBA")
    except Exception as exc:
        if isinstance(exc, ValueError):
            raise
        raise ValueError("Invalid or unsupported image") from exc


@lru_cache(maxsize=3)
def _rembg_session(model_name: str):
    return new_session(model_name)


def remove_background(image: Image.Image, model_name: str | None = None) -> Image.Image:
    model = model_name or os.getenv("PIXELPRO_REMBG_MODEL", "isnet-general-use")
    session = _rembg_session(model)
    result = remove(image, session=session, post_process_mask=True)
    return result.convert("RGBA")


def trim_transparent(image: Image.Image) -> Image.Image:
    bbox = image.getchannel("A").getbbox()
    return image.crop(bbox) if bbox else image


def _cv_rgba(image: Image.Image) -> np.ndarray:
    return cv2.cvtColor(np.array(image), cv2.COLOR_RGBA2BGRA)


def _pil_rgba(image: np.ndarray) -> Image.Image:
    return Image.fromarray(cv2.cvtColor(image, cv2.COLOR_BGRA2RGBA), mode="RGBA")


def gray_world_white_balance(image: Image.Image) -> Image.Image:
    arr = np.array(image.convert("RGBA"), dtype=np.uint8)
    rgb = arr[:, :, :3].astype(np.float32)
    alpha = arr[:, :, 3:4]
    means = rgb.reshape(-1, 3).mean(axis=0)
    target = float(means.mean())
    scales = target / np.maximum(means, 1.0)
    rgb = np.clip(rgb * scales, 0, 255).astype(np.uint8)
    return Image.fromarray(np.concatenate([rgb, alpha], axis=2), "RGBA")


def denoise(image: Image.Image, strength: int = 5) -> Image.Image:
    strength = max(0, min(int(strength), 15))
    if strength == 0:
        return image
    arr = np.array(image.convert("RGBA"))
    rgb = cv2.cvtColor(arr[:, :, :3], cv2.COLOR_RGB2BGR)
    filtered = cv2.fastNlMeansDenoisingColored(rgb, None, strength, strength, 7, 21)
    out = cv2.cvtColor(filtered, cv2.COLOR_BGR2RGB)
    return Image.fromarray(np.dstack([out, arr[:, :, 3]]), "RGBA")


def enhance(
    image: Image.Image,
    *,
    sharpness: float = 1.10,
    contrast: float = 1.04,
    brightness: float = 1.0,
    saturation: float = 1.0,
    white_balance: bool = False,
    denoise_strength: int = 0,
) -> Image.Image:
    out = image.convert("RGBA")
    if white_balance:
        out = gray_world_white_balance(out)
    if denoise_strength:
        out = denoise(out, denoise_strength)
    alpha = out.getchannel("A")
    rgb = out.convert("RGB")
    rgb = ImageOps.autocontrast(rgb, cutoff=0.35)
    rgb = ImageEnhance.Brightness(rgb).enhance(max(0.5, min(brightness, 1.5)))
    rgb = ImageEnhance.Contrast(rgb).enhance(max(0.5, min(contrast, 1.8)))
    rgb = ImageEnhance.Color(rgb).enhance(max(0.0, min(saturation, 2.0)))
    rgb = ImageEnhance.Sharpness(rgb).enhance(max(0.0, min(sharpness, 3.0)))
    result = rgb.convert("RGBA")
    result.putalpha(alpha)
    return result


def smart_upscale(image: Image.Image, factor: float = 1.0) -> Image.Image:
    factor = max(1.0, min(float(factor), 4.0))
    if factor <= 1.01:
        return image
    new_size = (max(1, round(image.width * factor)), max(1, round(image.height * factor)))
    up = image.resize(new_size, Image.Resampling.LANCZOS)
    return ImageEnhance.Sharpness(up).enhance(1.12)


def fit_product(product: Image.Image, width: int, height: int, scale: float, padding: float) -> Image.Image:
    product = trim_transparent(product)
    occupancy = min(scale, max(0.1, 1 - (padding * 2)))
    usable_w = max(1, int(width * occupancy))
    usable_h = max(1, int(height * occupancy))
    ratio = min(usable_w / product.width, usable_h / product.height)
    new_size = (max(1, int(product.width * ratio)), max(1, int(product.height * ratio)))
    return product.resize(new_size, Image.Resampling.LANCZOS)


def add_shadow(product: Image.Image, opacity: int = 72, blur: int = 24) -> Image.Image:
    alpha = product.getchannel("A")
    shadow_alpha = alpha.filter(ImageFilter.GaussianBlur(max(1, blur)))
    shadow_alpha = shadow_alpha.point(lambda p: int(p * (max(0, min(opacity, 255)) / 255)))
    shadow = Image.new("RGBA", product.size, (0, 0, 0, 0))
    shadow.putalpha(shadow_alpha)
    return shadow


def _studio_background(width: int, height: int, style: BackgroundStyle, solid: str) -> Image.Image:
    if style == "transparent":
        return Image.new("RGBA", (width, height), (0, 0, 0, 0))
    if style == "solid":
        return Image.new("RGBA", (width, height), _hex_to_rgba(solid))

    if style == "warm-studio":
        top = np.array([250, 246, 238], dtype=np.float32)
        bottom = np.array([232, 218, 197], dtype=np.float32)
    elif style == "soft-gray":
        top = np.array([249, 249, 248], dtype=np.float32)
        bottom = np.array([225, 226, 224], dtype=np.float32)
    else:
        top = np.array([255, 255, 255], dtype=np.float32)
        bottom = np.array([238, 237, 233], dtype=np.float32)

    y = np.linspace(0, 1, height, dtype=np.float32)[:, None, None]
    rgb = top[None, None, :] * (1 - y) + bottom[None, None, :] * y
    rgb = np.repeat(rgb, width, axis=1).astype(np.uint8)
    alpha = np.full((height, width, 1), 255, dtype=np.uint8)
    return Image.fromarray(np.concatenate([rgb, alpha], axis=2), "RGBA")


def _encode(image: Image.Image, output_format: OutputFormat, quality: int) -> bytes:
    output = BytesIO()
    quality = max(60, min(int(quality), 100))
    if output_format == "JPEG":
        image.convert("RGB").save(output, "JPEG", quality=quality, optimize=True, progressive=True)
    elif output_format == "WEBP":
        image.save(output, "WEBP", quality=quality, method=6)
    elif output_format == "PNG":
        image.save(output, "PNG", optimize=True)
    else:
        raise ValueError("Output format must be JPEG, PNG or WEBP")
    return output.getvalue()


def compose(
    source: bytes,
    *,
    width: int = 1024,
    height: int = 1024,
    background: str = "#FFFFFF",
    background_style: BackgroundStyle = "solid",
    transparent_background: bool = False,
    product_scale: float = 0.75,
    padding: float = 0.15,
    offset_x: float = 0.0,
    offset_y: float = 0.0,
    remove_bg: bool = True,
    enhance_quality: bool = True,
    white_balance: bool = False,
    denoise_strength: int = 0,
    brightness: float = 1.0,
    contrast: float = 1.04,
    saturation: float = 1.0,
    sharpness: float = 1.10,
    upscale_factor: float = 1.0,
    add_product_shadow: bool = False,
    shadow_opacity: int = 72,
    shadow_blur: int = 24,
    output_format: OutputFormat = "JPEG",
    quality: int = 92,
) -> bytes:
    if not (256 <= int(width) <= 6000 and 256 <= int(height) <= 6000):
        raise ValueError("Width and height must be between 256 and 6000")
    if not 0.20 <= float(product_scale) <= 0.95:
        raise ValueError("Product scale must be between 0.20 and 0.95")
    if not 0 <= float(padding) <= 0.35:
        raise ValueError("Padding must be between 0 and 0.35")

    image = _open_rgba(source)
    product = remove_background(image) if remove_bg else image
    product = smart_upscale(product, upscale_factor)
    if enhance_quality:
        product = enhance(
            product,
            sharpness=sharpness,
            contrast=contrast,
            brightness=brightness,
            saturation=saturation,
            white_balance=white_balance,
            denoise_strength=denoise_strength,
        )
    product = fit_product(product, int(width), int(height), float(product_scale), float(padding))

    style: BackgroundStyle = "transparent" if transparent_background else background_style
    canvas = _studio_background(int(width), int(height), style, background)
    x = int((width - product.width) / 2 + (offset_x * width))
    y = int((height - product.height) / 2 + (offset_y * height))
    x = max(-product.width + 1, min(x, width - 1))
    y = max(-product.height + 1, min(y, height - 1))

    if add_product_shadow:
        shadow = add_shadow(product, shadow_opacity, shadow_blur)
        shadow_y = min(height - 1, y + max(8, int(height * 0.012)))
        canvas.alpha_composite(shadow, (x, shadow_y))

    canvas.alpha_composite(product, (x, y))
    return _encode(canvas, output_format, quality)


def inpaint_cleanup(source: bytes, mask: bytes, radius: int = 5) -> bytes:
    image = cv2.imdecode(np.frombuffer(source, np.uint8), cv2.IMREAD_COLOR)
    mask_img = cv2.imdecode(np.frombuffer(mask, np.uint8), cv2.IMREAD_GRAYSCALE)
    if image is None or mask_img is None:
        raise ValueError("Invalid image or mask")
    if image.shape[:2] != mask_img.shape[:2]:
        mask_img = cv2.resize(mask_img, (image.shape[1], image.shape[0]), interpolation=cv2.INTER_NEAREST)
    _, binary = cv2.threshold(mask_img, 10, 255, cv2.THRESH_BINARY)
    cleaned = cv2.inpaint(image, binary, max(1, min(int(radius), 20)), cv2.INPAINT_TELEA)
    ok, encoded = cv2.imencode(".png", cleaned)
    if not ok:
        raise ValueError("Failed to encode cleaned image")
    return encoded.tobytes()


def analyze_reference(source: bytes) -> dict[str, object]:
    image = _open_rgba(source)
    product = remove_background(image)
    alpha = np.array(product.getchannel("A"))
    ys, xs = np.where(alpha > 20)
    if len(xs) == 0:
        raise ValueError("Could not detect the product")
    left, right, top, bottom = int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())
    product_w, product_h = right - left + 1, bottom - top + 1
    occupancy = max(product_w / image.width, product_h / image.height)
    center_x = ((left + right) / 2) / image.width
    center_y = ((top + bottom) / 2) / image.height

    rgb = np.array(image.convert("RGB"))
    border = max(2, min(image.width, image.height) // 30)
    samples = np.concatenate([
        rgb[:border, :, :].reshape(-1, 3),
        rgb[-border:, :, :].reshape(-1, 3),
        rgb[:, :border, :].reshape(-1, 3),
        rgb[:, -border:, :].reshape(-1, 3),
    ])
    median = np.median(samples, axis=0).astype(int)
    bg_hex = "#{:02X}{:02X}{:02X}".format(*median.tolist())

    return {
        "width": image.width,
        "height": image.height,
        "aspect_ratio": round(image.width / image.height, 4),
        "product_scale": round(min(0.95, max(0.2, occupancy)), 3),
        "padding": round(max(0.0, min(0.35, (1 - occupancy) / 2)), 3),
        "offset_x": round(center_x - 0.5, 4),
        "offset_y": round(center_y - 0.5, 4),
        "background": bg_hex,
    }


def perceptual_hash(source: bytes) -> str:
    image = _open_rgba(source).convert("L").resize((32, 32), Image.Resampling.LANCZOS)
    pixels = np.array(image, dtype=np.float32)
    dct = cv2.dct(pixels)
    low = dct[:8, :8].flatten()
    median = np.median(low[1:])
    bits = low > median
    value = 0
    for bit in bits:
        value = (value << 1) | int(bit)
    return f"{value:016x}"


def hamming_distance(hash_a: str, hash_b: str) -> int:
    return (int(hash_a, 16) ^ int(hash_b, 16)).bit_count()


def quality_report(source: bytes, deep: bool = False) -> dict[str, object]:
    image = cv2.imdecode(np.frombuffer(source, np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Invalid image")
    height, width = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    variance = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    mean_luma = float(gray.mean())
    dark_ratio = float((gray < 20).mean())
    bright_ratio = float((gray > 245).mean())

    report: dict[str, object] = {
        "width": width,
        "height": height,
        "megapixels": round((width * height) / 1_000_000, 2),
        "sharpness_score": round(variance, 2),
        "blurry": variance < 90.0,
        "resolution_ok": width >= 1000 and height >= 1000,
        "mean_luminance": round(mean_luma, 1),
        "too_dark": mean_luma < 55 or dark_ratio > 0.45,
        "too_bright": mean_luma > 225 or bright_ratio > 0.45,
        "square": width == height,
        "aspect_ratio": round(width / height, 4),
    }

    if deep:
        rgba = _open_rgba(source)
        product = remove_background(rgba)
        alpha = np.array(product.getchannel("A"))
        ys, xs = np.where(alpha > 20)
        if len(xs):
            left, right, top, bottom = int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())
            margins = {
                "left": round(left / width, 4),
                "right": round((width - right - 1) / width, 4),
                "top": round(top / height, 4),
                "bottom": round((height - bottom - 1) / height, 4),
            }
            report["margins"] = margins
            report["touching_edge"] = min(margins.values()) < 0.01
            report["centered"] = abs(margins["left"] - margins["right"]) < 0.04
            report["product_occupancy"] = round(max((right-left+1)/width, (bottom-top+1)/height), 3)
    return report

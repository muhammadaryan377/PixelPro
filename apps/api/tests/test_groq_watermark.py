from io import BytesIO

import numpy as np
from PIL import Image

from app.services.groq_watermark import _vision_data_url, remove_detected_watermarks


def sample_image() -> bytes:
    image = Image.new("RGB", (240, 160), "white")
    pixels = np.array(image)
    pixels[60:95, 75:170] = (30, 30, 30)
    output = BytesIO()
    Image.fromarray(pixels).save(output, "PNG")
    return output.getvalue()


def test_vision_image_is_resized_and_encoded() -> None:
    data_url, width, height = _vision_data_url(sample_image())
    assert (width, height) == (240, 160)
    assert data_url.startswith("data:image/jpeg;base64,")


def test_detected_box_removal_returns_png() -> None:
    result = remove_detected_watermarks(
        sample_image(),
        [{"x1": 300, "y1": 300, "x2": 750, "y2": 700, "confidence": 0.9}],
    )
    assert result.startswith(b"\x89PNG")
    with Image.open(BytesIO(result)) as image:
        assert image.size == (240, 160)

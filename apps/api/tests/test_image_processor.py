from io import BytesIO

from PIL import Image

from app.services.image_processor import compose, quality_report


def sample_png(size=(600, 400)) -> bytes:
    image = Image.new("RGB", size, "white")
    buffer = BytesIO()
    image.save(buffer, "PNG")
    return buffer.getvalue()


def test_compose_outputs_requested_size():
    result = compose(
        sample_png(),
        width=1024,
        height=1024,
        remove_bg=False,
        enhance_quality=False,
        output_format="PNG",
    )
    image = Image.open(BytesIO(result))
    assert image.size == (1024, 1024)


def test_quality_report_has_dimensions():
    report = quality_report(sample_png((1200, 1200)))
    assert report["width"] == 1200
    assert report["height"] == 1200
    assert report["resolution_ok"] is True

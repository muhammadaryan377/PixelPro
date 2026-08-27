from app.automotive import AUTOMOTIVE_PRESETS, output_filename, quality_issues, roi_estimate, sku_from_filename


def test_automotive_presets_have_square_outputs():
    assert "auto-white-1600" in AUTOMOTIVE_PRESETS
    for preset in AUTOMOTIVE_PRESETS.values():
        assert preset["width"] == preset["height"]
        assert 0.2 <= preset["product_scale"] <= 0.95


def test_sku_comes_from_supplier_filename():
    assert sku_from_filename("8K0 615 123-A.jpg", 1) == "8K0-615-123-A"
    assert sku_from_filename(".jpg", 7, "BRAKE") == "BRAKE-0007"


def test_output_filename_is_safe():
    assert output_filename("8K0 615 123-A", "JPEG") == "8k0-615-123-a-pixelpro.jpg"


def test_quality_issues_flags_common_catalog_problems():
    issues = quality_issues({"resolution_ok": False, "blurry": True, "too_dark": False, "too_bright": False})
    assert len(issues) == 2


def test_roi_model_returns_transparent_assumptions():
    result = roi_estimate(3000, 2.5, 12, 149)
    assert result["manual_hours"] == 125.0
    assert "assumption" in result
    assert result["estimated_annual_savings_usd"] > 0

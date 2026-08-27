from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_and_automotive_profile():
    health = client.get("/health")
    assert health.status_code == 200
    assert health.json()["version"] == "0.3.0"

    profile = client.get("/api/v1/automotive/profile")
    assert profile.status_code == 200
    assert "Automotive" in profile.json()["product"]


def test_plans_and_automotive_presets_are_exposed():
    plans = client.get("/api/v1/plans")
    assert plans.status_code == 200
    assert len(plans.json()["plans"]) == 4

    presets = client.get("/api/v1/automotive/presets")
    assert presets.status_code == 200
    assert "auto-white-1600" in presets.json()
    assert "amazon-main-1600" in presets.json()
    assert "ebay-1600" in presets.json()
    assert "auto-shopify-2048" in presets.json()


def test_marketplace_profiles_are_versioned():
    response = client.get("/api/v1/automotive/marketplace-profiles")
    assert response.status_code == 200
    body = response.json()
    assert body["verified_on"] == "2026-08-27"
    assert "amazon-main-1600" in body["profiles"]
    assert "ebay-1600" in body["profiles"]
    assert "shopify-square-2048" in body["profiles"]


def test_roi_endpoint_returns_explicit_assumption():
    response = client.post(
        "/api/v1/automotive/roi",
        json={
            "images_per_month": 3000,
            "manual_minutes_per_image": 2.5,
            "hourly_cost_usd": 12,
            "pixelpro_monthly_usd": 149,
        },
    )
    assert response.status_code == 200
    assert response.json()["estimated_monthly_savings_usd"] > 0
    assert "assumption" in response.json()

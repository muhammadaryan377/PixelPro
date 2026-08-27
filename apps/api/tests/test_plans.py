from app.plans import plan_for, public_plans


def test_public_plan_order_and_limits():
    plans = public_plans()
    assert [plan["id"] for plan in plans] == ["trial", "starter", "business", "agency"]
    assert [plan["batch_limit"] for plan in plans] == [25, 100, 250, 500]
    assert [plan["images_per_month"] for plan in plans] == [250, 1000, 5000, 20000]


def test_unknown_plan_falls_back_to_trial():
    assert plan_for("does-not-exist")["id"] == "trial"

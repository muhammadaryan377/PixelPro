from app import platform_store


def test_account_session_and_usage_flow(tmp_path):
    platform_store.DB_PATH = str(tmp_path / "pixelpro-test.db")
    platform_store.init_db()

    user = platform_store.create_user("ops@example.com", "strong-pass-123", "Apex Parts")
    assert user["company"] == "Apex Parts"
    assert platform_store.get_plan_id(user["id"]) == "trial"

    platform_store.set_plan_id(user["id"], "starter")
    assert platform_store.get_plan_id(user["id"]) == "starter"

    verified = platform_store.verify_user("ops@example.com", "strong-pass-123")
    assert verified is not None
    assert verified["id"] == user["id"]
    assert platform_store.verify_user("ops@example.com", "wrong-password") is None

    token = platform_store.create_session(user["id"])
    authenticated = platform_store.authenticate_token(token)
    assert authenticated is not None
    assert authenticated["email"] == "ops@example.com"

    platform_store.record_usage(user["id"], "automotive-catalog", 12)
    summary = platform_store.usage_summary(user["id"])
    assert summary["images_processed"] == 12

    job_id = platform_store.create_job(user["id"], "Brake batch", 12, "auto-white-1600")
    platform_store.update_job(job_id, status="completed", completed=12, failed=0)
    jobs = platform_store.list_jobs(user["id"])
    assert jobs[0]["id"] == job_id
    assert jobs[0]["status"] == "completed"

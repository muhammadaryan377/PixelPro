from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, EmailStr, Field

from app.platform_store import (
    authenticate_token,
    create_session,
    create_user,
    list_jobs,
    usage_summary,
    verify_user,
)

router = APIRouter(prefix="/api/v1", tags=["platform"])

PLANS = [
    {
        "id": "trial",
        "name": "Trial",
        "price_monthly_usd": 0,
        "images_per_month": 250,
        "batch_limit": 25,
        "features": ["Automotive presets", "Quality audit", "ZIP export"],
    },
    {
        "id": "starter",
        "name": "Starter",
        "price_monthly_usd": 49,
        "images_per_month": 1000,
        "batch_limit": 100,
        "features": ["Everything in Trial", "Catalog manifests", "SKU-safe filenames"],
    },
    {
        "id": "business",
        "name": "Business",
        "price_monthly_usd": 149,
        "images_per_month": 5000,
        "batch_limit": 250,
        "features": ["Everything in Starter", "Team workflow", "Priority processing"],
    },
    {
        "id": "agency",
        "name": "Agency",
        "price_monthly_usd": 399,
        "images_per_month": 20000,
        "batch_limit": 500,
        "features": ["Everything in Business", "API access", "White-label ready"],
    },
]


class SignUpRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    company: str = Field(min_length=2, max_length=120)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


def _bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Authentication required")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(status_code=401, detail="Use Authorization: Bearer <token>")
    return token.strip()


def require_user(authorization: str | None) -> dict:
    user = authenticate_token(_bearer_token(authorization))
    if not user:
        raise HTTPException(status_code=401, detail="Session expired or invalid")
    return user


@router.get("/plans")
def get_plans() -> dict:
    return {
        "currency": "USD",
        "plans": PLANS,
        "note": "Commercial pricing is configurable before launch; payment collection is intentionally not hard-wired into the MVP.",
    }


@router.post("/account/signup")
def signup(payload: SignUpRequest) -> dict:
    try:
        user = create_user(str(payload.email), payload.password, payload.company)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    token = create_session(user["id"])
    return {"token": token, "user": user, "plan": PLANS[0]}


@router.post("/account/login")
def login(payload: LoginRequest) -> dict:
    user = verify_user(str(payload.email), payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_session(user["id"])
    return {"token": token, "user": user, "plan": PLANS[0]}


@router.get("/account/me")
def me(authorization: str | None = Header(default=None)) -> dict:
    user = require_user(authorization)
    return {"user": user, "plan": PLANS[0], "usage": usage_summary(user["id"])}


@router.get("/account/usage")
def usage(authorization: str | None = Header(default=None)) -> dict:
    user = require_user(authorization)
    return usage_summary(user["id"])


@router.get("/jobs")
def jobs(authorization: str | None = Header(default=None), limit: int = 20) -> dict:
    user = require_user(authorization)
    return {"jobs": list_jobs(user["id"], limit=limit)}

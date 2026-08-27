from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from app.plans import plan_for, public_plans
from app.platform_store import (
    authenticate_token,
    create_session,
    create_user,
    get_plan_id,
    list_jobs,
    usage_summary,
    verify_user,
)

router = APIRouter(prefix="/api/v1", tags=["platform"])


class SignUpRequest(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=8, max_length=128)
    company: str = Field(min_length=2, max_length=120)


class LoginRequest(BaseModel):
    email: str = Field(min_length=5, max_length=254)
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


def _account_payload(user: dict) -> dict:
    return {
        "user": user,
        "plan": plan_for(get_plan_id(user["id"])),
        "usage": usage_summary(user["id"]),
    }


@router.get("/plans")
def get_plans() -> dict:
    return {
        "currency": "USD",
        "plans": public_plans(),
        "note": "Commercial pricing is configurable before launch; payment collection is intentionally not hard-wired into the MVP.",
    }


@router.post("/account/signup")
def signup(payload: SignUpRequest) -> dict:
    try:
        user = create_user(payload.email, payload.password, payload.company)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    token = create_session(user["id"])
    result = _account_payload(user)
    return {"token": token, **result}


@router.post("/account/login")
def login(payload: LoginRequest) -> dict:
    user = verify_user(payload.email, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_session(user["id"])
    result = _account_payload(user)
    return {"token": token, **result}


@router.get("/account/me")
def me(authorization: str | None = Header(default=None)) -> dict:
    user = require_user(authorization)
    return _account_payload(user)


@router.get("/account/usage")
def usage(authorization: str | None = Header(default=None)) -> dict:
    user = require_user(authorization)
    return usage_summary(user["id"])


@router.get("/jobs")
def jobs(authorization: str | None = Header(default=None), limit: int = 20) -> dict:
    user = require_user(authorization)
    return {"jobs": list_jobs(user["id"], limit=limit)}

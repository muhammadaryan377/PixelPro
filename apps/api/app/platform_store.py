from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

DB_PATH = os.getenv("PIXELPRO_DB_PATH", "/tmp/pixelpro.db")
SESSION_DAYS = int(os.getenv("PIXELPRO_SESSION_DAYS", "30"))


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value: datetime | None = None) -> str:
    return (value or _utcnow()).isoformat()


def _connect() -> sqlite3.Connection:
    path = Path(DB_PATH)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with _connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL UNIQUE,
                company TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS usage_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                operation TEXT NOT NULL,
                images INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS jobs (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                status TEXT NOT NULL,
                total INTEGER NOT NULL,
                completed INTEGER NOT NULL DEFAULT 0,
                failed INTEGER NOT NULL DEFAULT 0,
                preset TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id)
            );
            """
        )


def _password_hash(password: str, salt_hex: str) -> str:
    salt = bytes.fromhex(salt_hex)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 210_000)
    return digest.hex()


def _public_user(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "email": row["email"],
        "company": row["company"],
        "created_at": row["created_at"],
    }


def create_user(email: str, password: str, company: str) -> dict[str, Any]:
    normalized = email.strip().lower()
    if not normalized or "@" not in normalized:
        raise ValueError("A valid email is required")
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters")
    company = company.strip()
    if len(company) < 2:
        raise ValueError("Company name is required")

    user_id = f"usr_{secrets.token_hex(10)}"
    salt = secrets.token_hex(16)
    password_hash = _password_hash(password, salt)
    created_at = _iso()
    try:
        with _connect() as conn:
            conn.execute(
                "INSERT INTO users (id, email, company, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                (user_id, normalized, company, password_hash, salt, created_at),
            )
    except sqlite3.IntegrityError as exc:
        raise ValueError("An account with this email already exists") from exc

    return {"id": user_id, "email": normalized, "company": company, "created_at": created_at}


def verify_user(email: str, password: str) -> dict[str, Any] | None:
    normalized = email.strip().lower()
    with _connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (normalized,)).fetchone()
    if not row:
        return None
    candidate = _password_hash(password, row["salt"])
    if not hmac.compare_digest(candidate, row["password_hash"]):
        return None
    return _public_user(row)


def create_session(user_id: str) -> str:
    token = secrets.token_urlsafe(36)
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    created_at = _utcnow()
    expires_at = created_at + timedelta(days=SESSION_DAYS)
    with _connect() as conn:
        conn.execute(
            "INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
            (token_hash, user_id, _iso(expires_at), _iso(created_at)),
        )
    return token


def authenticate_token(token: str) -> dict[str, Any] | None:
    token = token.strip()
    if not token:
        return None
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    now = _iso()
    with _connect() as conn:
        row = conn.execute(
            """
            SELECT u.* FROM sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.token_hash = ? AND s.expires_at > ?
            """,
            (token_hash, now),
        ).fetchone()
    return _public_user(row) if row else None


def record_usage(user_id: str, operation: str, images: int) -> None:
    with _connect() as conn:
        conn.execute(
            "INSERT INTO usage_events (user_id, operation, images, created_at) VALUES (?, ?, ?, ?)",
            (user_id, operation, max(0, int(images)), _iso()),
        )


def usage_summary(user_id: str) -> dict[str, Any]:
    month = _utcnow().strftime("%Y-%m")
    with _connect() as conn:
        row = conn.execute(
            "SELECT COALESCE(SUM(images), 0) AS images FROM usage_events WHERE user_id = ? AND substr(created_at, 1, 7) = ?",
            (user_id, month),
        ).fetchone()
        by_operation = conn.execute(
            """
            SELECT operation, COALESCE(SUM(images), 0) AS images
            FROM usage_events
            WHERE user_id = ? AND substr(created_at, 1, 7) = ?
            GROUP BY operation ORDER BY images DESC
            """,
            (user_id, month),
        ).fetchall()
    return {
        "month": month,
        "images_processed": int(row["images"] if row else 0),
        "by_operation": [{"operation": r["operation"], "images": int(r["images"])} for r in by_operation],
    }


def create_job(user_id: str, name: str, total: int, preset: str) -> str:
    job_id = f"job_{secrets.token_hex(10)}"
    now = _iso()
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO jobs (id, user_id, name, status, total, completed, failed, preset, created_at, updated_at)
            VALUES (?, ?, ?, 'processing', ?, 0, 0, ?, ?, ?)
            """,
            (job_id, user_id, name.strip() or "Automotive catalog batch", int(total), preset, now, now),
        )
    return job_id


def update_job(job_id: str, *, status: str, completed: int, failed: int) -> None:
    with _connect() as conn:
        conn.execute(
            "UPDATE jobs SET status = ?, completed = ?, failed = ?, updated_at = ? WHERE id = ?",
            (status, int(completed), int(failed), _iso(), job_id),
        )


def list_jobs(user_id: str, limit: int = 20) -> list[dict[str, Any]]:
    limit = max(1, min(int(limit), 100))
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT id, name, status, total, completed, failed, preset, created_at, updated_at
            FROM jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?
            """,
            (user_id, limit),
        ).fetchall()
    return [dict(row) for row in rows]

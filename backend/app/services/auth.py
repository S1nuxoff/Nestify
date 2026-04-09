import base64
import hashlib
import hmac
import json
import os
import time
from typing import Any

from fastapi import HTTPException, status

from app.core.config import settings

PASSWORD_SCHEME = "pbkdf2_sha256"
PASSWORD_ITERATIONS = 310_000


def _b64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(f"{value}{padding}")


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, PASSWORD_ITERATIONS
    )
    return (
        f"{PASSWORD_SCHEME}${PASSWORD_ITERATIONS}$"
        f"{_b64url_encode(salt)}${_b64url_encode(digest)}"
    )


def verify_password(password: str, encoded_password: str) -> bool:
    try:
        scheme, iterations_raw, salt_raw, digest_raw = encoded_password.split("$", 3)
        if scheme != PASSWORD_SCHEME:
            return False
        iterations = int(iterations_raw)
        salt = _b64url_decode(salt_raw)
        expected_digest = _b64url_decode(digest_raw)
    except (TypeError, ValueError):
        return False

    calculated = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, iterations
    )
    return hmac.compare_digest(calculated, expected_digest)


def create_access_token(account_id: int) -> str:
    payload = {
        "sub": str(account_id),
        "exp": int(time.time()) + settings.AUTH_TOKEN_TTL_SECONDS,
    }
    payload_bytes = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    payload_encoded = _b64url_encode(payload_bytes)
    signature = hmac.new(
        settings.AUTH_SECRET_KEY.encode("utf-8"),
        payload_encoded.encode("utf-8"),
        hashlib.sha256,
    ).digest()
    return f"{payload_encoded}.{_b64url_encode(signature)}"


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        payload_encoded, signature_encoded = token.split(".", 1)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token",
        ) from exc

    expected_signature = hmac.new(
        settings.AUTH_SECRET_KEY.encode("utf-8"),
        payload_encoded.encode("utf-8"),
        hashlib.sha256,
    ).digest()

    if not hmac.compare_digest(_b64url_encode(expected_signature), signature_encoded):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token",
        )

    try:
        payload = json.loads(_b64url_decode(payload_encoded).decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token",
        ) from exc

    if int(payload.get("exp", 0)) <= int(time.time()):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Access token expired",
        )

    return payload

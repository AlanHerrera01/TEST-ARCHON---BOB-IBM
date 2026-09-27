"""
app/auth/jwt_handler.py

JWT verification and token utilities.
Demo module for TEST-ARCHON — Auth Refactor preset.
"""
from __future__ import annotations

import time
import hmac
import hashlib
import base64
import json
from typing import Any

SECRET = "demo-secret-key-change-in-production"


class AuthError(Exception):
    """Raised when token verification fails."""


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _sign(payload_b64: str, header_b64: str) -> str:
    msg = f"{header_b64}.{payload_b64}".encode()
    sig = hmac.new(SECRET.encode(), msg, hashlib.sha256).digest()
    return _b64(sig)


def create_token(subject: str, role: str = "user", ttl: int = 3600) -> str:
    """Create a signed JWT-like token."""
    header = _b64(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    payload = _b64(json.dumps({
        "sub": subject,
        "role": role,
        "iat": int(time.time()),
        "exp": int(time.time()) + ttl,
    }).encode())
    sig = _sign(payload, header)
    return f"{header}.{payload}.{sig}"


def decode_token(token: str) -> dict[str, Any]:
    """Decode token payload without verification (use verify_token for safe decode)."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            raise AuthError("Malformed token")
        padded = parts[1] + "=" * (4 - len(parts[1]) % 4)
        return json.loads(base64.urlsafe_b64decode(padded))
    except Exception as exc:
        raise AuthError(f"Token decode error: {exc}") from exc


def verify_token(token: str, strict: bool = True) -> dict[str, Any]:
    """Verify JWT signature and expiry; raises AuthError on failure."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            raise AuthError("Malformed token structure")

        header_b64, payload_b64, provided_sig = parts
        expected_sig = _sign(payload_b64, header_b64)

        if not hmac.compare_digest(expected_sig, provided_sig):
            raise AuthError("Invalid signature")

        payload = decode_token(token)

        if strict and payload.get("exp", 0) < time.time():
            raise AuthError("Token expired")

        return payload

    except AuthError:
        raise
    except Exception as exc:
        raise AuthError(f"Token verification failed: {exc}") from exc


def refresh_token(token: str, ttl: int = 3600) -> str:
    """Verify and reissue a token with a fresh expiry."""
    payload = verify_token(token, strict=False)
    return create_token(payload["sub"], role=payload.get("role", "user"), ttl=ttl)

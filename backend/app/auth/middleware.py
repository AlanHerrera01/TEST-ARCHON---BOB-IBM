"""
app/auth/middleware.py

Request authentication decorators and role enforcement.
Demo module for TEST-ARCHON — Auth Refactor preset.
"""
from __future__ import annotations

from functools import wraps
from typing import Callable, Optional

from app.auth.jwt_handler import AuthError, verify_token


class Request:
    """Minimal request stub used by the middleware decorators."""
    def __init__(self, headers: dict, body: dict | None = None):
        self.headers = headers
        self.body = body or {}


class PermissionError(Exception):
    """Raised when a user lacks the required role."""


def auth_required(f: Callable = None, roles: Optional[list[str]] = None) -> Callable:
    """
    Decorator — verifies the Authorization header and optionally restricts
    access to specific roles.

    Usage::

        @auth_required
        def my_view(request): ...

        @auth_required(roles=["admin"])
        def admin_view(request): ...
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(request: Request, *args, **kwargs):
            raw = request.headers.get("Authorization", "")
            token = raw.removeprefix("Bearer ").strip()
            if not token:
                raise AuthError("Missing Authorization header")

            payload = verify_token(token, strict=True)

            if roles and payload.get("role") not in roles:
                raise PermissionError(
                    f"Role '{payload.get('role')}' is not in allowed roles {roles}"
                )

            request.user = payload
            return func(request, *args, **kwargs)
        return wrapper

    # Support both @auth_required and @auth_required(roles=[...])
    if f is not None:
        return decorator(f)
    return decorator


def optional_auth(f: Callable) -> Callable:
    """
    Like auth_required but does NOT raise if the header is absent.
    Sets request.user = None when no token is provided.
    """
    @wraps(f)
    def wrapper(request: Request, *args, **kwargs):
        raw = request.headers.get("Authorization", "")
        token = raw.removeprefix("Bearer ").strip()
        try:
            request.user = verify_token(token) if token else None
        except AuthError:
            request.user = None
        return f(request, *args, **kwargs)
    return wrapper

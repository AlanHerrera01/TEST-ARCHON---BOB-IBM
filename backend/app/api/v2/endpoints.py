"""
app/api/v2/endpoints.py

User management REST endpoints (v2).
Demo module for TEST-ARCHON — Self-Healing preset (breaking API change).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional
import uuid


class HTTPException(Exception):
    def __init__(self, status_code: int, detail: str = ""):
        self.status_code = status_code
        self.detail = detail
        super().__init__(f"HTTP {status_code}: {detail}")


# ---------------------------------------------------------------------------
# Fake DB (in-memory for demo)
# ---------------------------------------------------------------------------

@dataclass
class User:
    id: str
    name: str
    email: str
    role: str = "user"
    active: bool = True

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "role": self.role,
            "active": self.active,
        }


_DB: dict[str, User] = {
    "usr_alice": User(id="usr_alice", name="Alice", email="alice@example.com", role="admin"),
    "usr_bob":   User(id="usr_bob",   name="Bob",   email="bob@example.com",   role="user"),
    "usr_carol": User(id="usr_carol", name="Carol", email="carol@example.com", role="user"),
}


# ---------------------------------------------------------------------------
# v2 Endpoints — breaking change: user_id is now str (was int in v1)
# ---------------------------------------------------------------------------

def get_user(user_id: str) -> dict:
    """Return a single user by string ID.

    Breaking change from v1: accepts ``str`` instead of ``int``.
    """
    if not isinstance(user_id, str):
        raise HTTPException(status_code=400, detail="user_id must be a string")

    user = _DB.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail=f"User '{user_id}' not found")

    return user.to_dict()


def list_users(page: int = 1, limit: int = 20) -> dict:
    """Return a paginated list of users.

    Breaking change from v1: now paginated (was full list).
    """
    if page < 1:
        raise HTTPException(status_code=400, detail="page must be >= 1")
    if limit < 1 or limit > 100:
        raise HTTPException(status_code=400, detail="limit must be between 1 and 100")

    all_users = list(_DB.values())
    start = (page - 1) * limit
    end   = start + limit
    page_users = all_users[start:end]

    return {
        "users": [u.to_dict() for u in page_users],
        "page": page,
        "limit": limit,
        "total": len(all_users),
        "has_next": end < len(all_users),
    }


def create_user(name: str, email: str, role: str = "user") -> dict:
    """Create a new user and return the created record."""
    if not name or not email:
        raise HTTPException(status_code=400, detail="name and email are required")
    if "@" not in email:
        raise HTTPException(status_code=400, detail="Invalid email format")

    user_id = f"usr_{uuid.uuid4().hex[:8]}"
    user = User(id=user_id, name=name, email=email, role=role)
    _DB[user_id] = user
    return user.to_dict()


def delete_user(user_id: str) -> bool:
    """Delete a user by ID. Returns True if deleted, raises 404 if not found."""
    if user_id not in _DB:
        raise HTTPException(status_code=404, detail=f"User '{user_id}' not found")
    del _DB[user_id]
    return True

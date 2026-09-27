"""
app/payments/models.py

Payment domain models.
Demo module for TEST-ARCHON — Coverage Gap preset.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Optional
import uuid


class TransactionStatus(str, Enum):
    PENDING   = "pending"
    COMPLETED = "completed"
    FAILED    = "failed"
    REFUNDED  = "refunded"


class PlanInterval(str, Enum):
    MONTHLY = "monthly"
    YEARLY  = "yearly"


@dataclass
class Transaction:
    """Represents a single payment charge or refund."""
    id: str
    amount: float          # in cents
    currency: str
    status: TransactionStatus
    customer_id: str
    description: str = ""
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def is_successful(self) -> bool:
        return self.status == TransactionStatus.COMPLETED

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "amount": self.amount,
            "currency": self.currency,
            "status": self.status.value,
            "customer_id": self.customer_id,
            "description": self.description,
            "created_at": self.created_at.isoformat(),
        }


@dataclass
class Subscription:
    """Represents a recurring billing subscription."""
    id: str
    customer_id: str
    plan_id: str
    interval: PlanInterval
    amount: float
    active: bool = True
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    cancelled_at: Optional[datetime] = None

    def cancel(self) -> None:
        self.active = False
        self.cancelled_at = datetime.now(timezone.utc)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "customer_id": self.customer_id,
            "plan_id": self.plan_id,
            "interval": self.interval.value,
            "amount": self.amount,
            "active": self.active,
            "created_at": self.created_at.isoformat(),
            "cancelled_at": self.cancelled_at.isoformat() if self.cancelled_at else None,
        }


def new_transaction_id() -> str:
    return f"txn_{uuid.uuid4().hex[:16]}"


def new_subscription_id() -> str:
    return f"sub_{uuid.uuid4().hex[:16]}"

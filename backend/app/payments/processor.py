"""
app/payments/processor.py

Payment processing logic: charge, refund, subscribe.
Demo module for TEST-ARCHON — Coverage Gap preset.
"""
from __future__ import annotations

from typing import Optional

from app.payments.models import (
    PlanInterval,
    Subscription,
    Transaction,
    TransactionStatus,
    new_subscription_id,
    new_transaction_id,
)


class PaymentError(Exception):
    """Raised when a payment operation fails."""


class PaymentProcessor:
    """
    Handles charge, refund and subscription operations.

    In production this would call a payment gateway (Stripe, Braintree, etc.).
    For the demo it maintains an in-memory ledger.
    """

    def __init__(self) -> None:
        self._transactions: dict[str, Transaction] = {}
        self._subscriptions: dict[str, Subscription] = {}

    # ------------------------------------------------------------------
    # Charges
    # ------------------------------------------------------------------

    def charge(
        self,
        amount: float,
        currency: str,
        customer_id: str,
        card_token: str,
        description: str = "",
    ) -> Transaction:
        """Create and record a new charge transaction."""
        if amount <= 0:
            raise PaymentError(f"Amount must be positive, got {amount}")
        if not card_token:
            raise PaymentError("card_token is required")

        # Simulate a gateway call: token starting with "fail_" always declines
        status = (
            TransactionStatus.FAILED
            if card_token.startswith("fail_")
            else TransactionStatus.COMPLETED
        )

        txn = Transaction(
            id=new_transaction_id(),
            amount=amount,
            currency=currency,
            status=status,
            customer_id=customer_id,
            description=description,
        )
        self._transactions[txn.id] = txn

        if status == TransactionStatus.FAILED:
            raise PaymentError(f"Card declined for token {card_token!r}")

        return txn

    # ------------------------------------------------------------------
    # Refunds
    # ------------------------------------------------------------------

    def refund(self, transaction_id: str) -> bool:
        """Mark a completed transaction as refunded."""
        txn = self._transactions.get(transaction_id)
        if txn is None:
            raise PaymentError(f"Transaction {transaction_id!r} not found")
        if txn.status != TransactionStatus.COMPLETED:
            raise PaymentError(
                f"Cannot refund transaction with status {txn.status.value!r}"
            )
        txn.status = TransactionStatus.REFUNDED
        return True

    def get_transaction(self, transaction_id: str) -> Optional[Transaction]:
        return self._transactions.get(transaction_id)

    # ------------------------------------------------------------------
    # Subscriptions
    # ------------------------------------------------------------------

    def subscribe(
        self,
        plan_id: str,
        customer_id: str,
        interval: PlanInterval = PlanInterval.MONTHLY,
        amount: float = 0.0,
    ) -> Subscription:
        """Create a new subscription for a customer."""
        if not plan_id:
            raise PaymentError("plan_id is required")

        sub = Subscription(
            id=new_subscription_id(),
            customer_id=customer_id,
            plan_id=plan_id,
            interval=interval,
            amount=amount,
        )
        self._subscriptions[sub.id] = sub
        return sub

    def cancel_subscription(self, subscription_id: str) -> bool:
        """Cancel an active subscription."""
        sub = self._subscriptions.get(subscription_id)
        if sub is None:
            raise PaymentError(f"Subscription {subscription_id!r} not found")
        sub.cancel()
        return True

    def get_subscription(self, subscription_id: str) -> Optional[Subscription]:
        return self._subscriptions.get(subscription_id)

    def list_transactions(self, customer_id: str) -> list[Transaction]:
        return [t for t in self._transactions.values() if t.customer_id == customer_id]

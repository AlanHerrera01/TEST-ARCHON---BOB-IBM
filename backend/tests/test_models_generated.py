import pytest
from app.payments.models import (
    Transaction,
    TransactionStatus,
    PlanInterval,
    Subscription,
)

@pytest.fixture
def transaction():
    return Transaction(
        id="123",
        amount=100,
        currency="USD",
        status=TransactionStatus.PENDING,
        customer_id="customer-1",
    )

@pytest.fixture
def subscription():
    return Subscription(
        id="123",
        customer_id="customer-1",
        plan_id="plan-1",
        interval=PlanInterval.MONTHLY,
        amount=100,
    )

def test_transaction_is_successful(transaction):
    transaction.status = TransactionStatus.COMPLETED
    assert transaction.is_successful()
    transaction.status = TransactionStatus.FAILED
    assert not transaction.is_successful()

def test_transaction_to_dict(transaction):
    expected = {
        "id": "123",
        "amount": 100,
        "currency": "USD",
        "status": TransactionStatus.PENDING.value,
        "customer_id": "customer-1",
        "description": "",
        "created_at": transaction.created_at.isoformat(),
    }
    assert transaction.to_dict() == expected

def test_subscription_cancel(subscription):
    subscription.cancel()
    assert not subscription.active
    assert subscription.cancelled_at is not None

def test_subscription_to_dict(subscription):
    expected = {
        "id": "123",
        "customer_id": "customer-1",
        "plan_id": "plan-1",
        "interval": PlanInterval.MONTHLY.value,
        "amount": 100,
        "active": True,
        "created_at": subscription.created_at.isoformat(),
        "cancelled_at": None,
    }
    assert subscription.to_dict() == expected

def test_transaction_to_dict_edge_case():
    transaction = Transaction(
        id="123",
        amount=100,
        currency="USD",
        status=TransactionStatus.COMPLETED,
        customer_id="customer-1",
        description=None,
    )
    expected = {
        "id": "123",
        "amount": 100,
        "currency": "USD",
        "status": TransactionStatus.COMPLETED.value,
        "customer_id": "customer-1",
        "description": None,
        "created_at": transaction.created_at.isoformat(),
    }
    assert transaction.to_dict() == expected

def test_subscription_cancel_edge_case():
    subscription = Subscription(
        id="123",
        customer_id="customer-1",
        plan_id="plan-1",
        interval=PlanInterval.MONTHLY,
        amount=100,
        active=False,
    )
    subscription.cancel()
    assert not subscription.active
    assert subscription.cancelled_at is not None
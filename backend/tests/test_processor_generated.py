import pytest
from app.payments.processor import PaymentProcessor, PaymentError, TransactionStatus
from app.payments.models import new_transaction_id, Transaction


@pytest.fixture
def processor():
    return PaymentProcessor()


def test_charge_happy_path(processor):
    amount = 10.0
    currency = "USD"
    customer_id = "customer_1"
    card_token = "success_token"
    description = "Test charge"

    transaction = processor.charge(amount, currency, customer_id, card_token, description)
    assert transaction.amount == amount
    assert transaction.currency == currency
    assert transaction.customer_id == customer_id
    assert transaction.description == description
    assert transaction.status == TransactionStatus.COMPLETED


def test_charge_negative_amount(processor):
    amount = -10.0
    currency = "USD"
    customer_id = "customer_1"
    card_token = "success_token"
    description = "Test charge"

    with pytest.raises(PaymentError):
        processor.charge(amount, currency, customer_id, card_token, description)


def test_charge_empty_card_token(processor):
    amount = 10.0
    currency = "USD"
    customer_id = "customer_1"
    card_token = ""
    description = "Test charge"

    with pytest.raises(PaymentError):
        processor.charge(amount, currency, customer_id, card_token, description)


def test_charge_failed_card_token(processor):
    amount = 10.0
    currency = "USD"
    customer_id = "customer_1"
    card_token = "fail_token"
    description = "Test charge"

    with pytest.raises(PaymentError):
        processor.charge(amount, currency, customer_id, card_token, description)


def test_charge_unique_transaction_id(processor):
    amount = 10.0
    currency = "USD"
    customer_id = "customer_1"
    card_token = "success_token"
    description = "Test charge"

    transaction1 = processor.charge(amount, currency, customer_id, card_token, description)
    transaction2 = processor.charge(amount, currency, customer_id, card_token, description)

    assert transaction1.id != transaction2.id
``````python
import pytest
from app.payments.processor import PaymentProcessor, PaymentError, TransactionStatus
from app.payments.models import new_transaction_id, Transaction


@pytest.fixture
def processor():
    return PaymentProcessor()


def test_charge_happy_path(processor):
    amount = 10.0
    currency = "USD"
    customer_id = "customer_1"
    card_token = "success_token"
    description = "Test charge"

    transaction = processor.charge(amount, currency, customer_id, card_token, description)
    assert transaction.amount == amount
    assert transaction.currency == currency
    assert transaction.customer_id == customer_id
    assert transaction.description == description
    assert transaction.status == TransactionStatus.COMPLETED


def test_charge_negative_amount(processor):
    amount = -10.0
    currency = "USD"
    customer_id = "customer_1"
    card_token = "success_token"
    description = "Test charge"

    with pytest.raises(PaymentError):
        processor.charge(amount, currency, customer_id, card_token, description)


def test_charge_empty_card_token(processor):
    amount = 10.0
    currency = "USD"
    customer_id = "customer_1"
    card_token = ""
    description = "Test charge"

    with pytest.raises(PaymentError):
        processor.charge(amount, currency, customer_id, card_token, description)


def test_charge_failed_card_token(processor):
    amount = 10.0
    currency = "USD"
    customer_id = "customer_1"
    card_token = "fail_token"
    description = "Test charge"

    with pytest.raises(PaymentError):
        processor.charge(amount, currency, customer_id, card_token, description)


def test_charge_unique_transaction_id(processor):
    amount = 10.0
    currency = "USD"
    customer_id = "customer_1"
    card_token = "success_token"
    description = "Test charge"

    transaction1 = processor.charge(amount, currency, customer_id, card_token, description)
    transaction2 = processor.charge(amount, currency, customer_id, card_token, description)

    assert transaction1.id != transaction2.id
``````python
import pytest
from app.payments.processor import PaymentProcessor, PaymentError, TransactionStatus
from app.payments.models import new_transaction_id, Transaction


@pytest.fixture
def processor():
    return PaymentProcessor()


def test_charge_happy_path(processor):
    amount = 10.0
    currency = "USD"
    customer_id = "customer_1"
    card_token = "success_token"
    description = "Test charge"

    transaction = processor.charge(amount, currency, customer_id, card_token, description)
    assert transaction.amount == amount
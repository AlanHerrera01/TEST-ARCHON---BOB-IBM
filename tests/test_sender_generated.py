import pytest
from backend.app.notifications import sender


@pytest.fixture
def valid_email():
    return "user@example.com"


@pytest.fixture
def valid_phone():
    return "+1234567890"


@pytest.fixture
def valid_device_id():
    return "device-token-123"


def test_send_email_happy_path(valid_email):
    result = sender.send_email(valid_email, "Test subject", "Test body")
    assert result["status"] == "sent"
    assert result["channel"] == "email"
    assert result["recipient"] == valid_email


def test_send_email_invalid_address():
    with pytest.raises(sender.NotificationError):
        sender.send_email("invalid-email", "Test subject", "Test body")


def test_send_sms_happy_path(valid_phone):
    result = sender.send_sms(valid_phone, "Test message")
    assert result["status"] == "sent"
    assert result["channel"] == "sms"
    assert result["recipient"] == valid_phone


def test_send_sms_invalid_phone_number():
    with pytest.raises(sender.NotificationError):
        sender.send_sms("1234567890", "Test message")


def test_send_push_happy_path(valid_device_id):
    result = sender.send_push(valid_device_id, "Test title", "Test body")
    assert result["status"] == "sent"
    assert result["channel"] == "push"
    assert "recipient" in result


def test_send_push_invalid_device_id():
    with pytest.raises(sender.NotificationError):
        sender.send_push("", "Test title", "Test body")

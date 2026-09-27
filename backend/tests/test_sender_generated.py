import pytest
from backend.app.notifications.sender import (
    send_notification,
    send_batch_notification,
)

@pytest.fixture
def mock_notification():
    return {
        "title": "Test Notification",
        "message": "This is a test notification",
        "recipients": ["user1@example.com", "user2@example.com"],
    }

@pytest.fixture
def mock_batch_notification():
    return [
        {
            "title": "Test Notification 1",
            "message": "This is a test notification 1",
            "recipients": ["user1@example.com"],
        },
        {
            "title": "Test Notification 2",
            "message": "This is a test notification 2",
            "recipients": ["user2@example.com"],
        },
    ]

def test_send_notification(mock_notification):
    assert send_notification(mock_notification) is True

def test_send_notification_empty_recipients():
    notification = {
        "title": "Test Notification",
        "message": "This is a test notification",
        "recipients": [],
    }
    assert send_notification(notification) is False

def test_send_batch_notification(mock_batch_notification):
    assert send_batch_notification(mock_batch_notification) is True

def test_send_batch_notification_empty_batch():
    batch = []
    assert send_batch_notification(batch) is False


import pytest
from backend.app.notifications.sender import (
    send_notification,
    send_batch_notification,
)

@pytest.fixture
def mock_notification():
    return {
        "title": "Test Notification",
        "message": "This is a test notification",
        "recipients": ["user1@example.com", "user2@example.com"],
    }

@pytest.fixture
def mock_batch_notification():
    return [
        {
            "title": "Test Notification 1",
            "message": "This is a test notification 1",
            "recipients": ["user1@example.com"],
        },
        {
            "title": "Test Notification 2",
            "message": "This is a test notification 2",
            "recipients": ["user2@example.com"],
        },
    ]

def test_send_notification(mock_notification):
    assert send_notification(mock_notification) is True

def test_send_notification_empty_recipients():
    notification = {
        "title": "Test Notification",
        "message": "This is a test notification",
        "recipients": [],
    }
    assert send_notification(notification) is False

def test_send_batch_notification(mock_batch_notification):
    assert send_batch_notification(mock_batch_notification) is True

def test_send_batch_notification_empty_batch():
    batch = []
    assert send_batch_notification(batch) is False


import pytest
from backend.app.notifications.sender import (
    send_notification,
    send_batch_notification,
)

@pytest.fixture
def mock_notification():
    return {
        "title": "Test Notification",
        "message": "This is a test notification",
        "recipients": ["user1@example.com", "user2@example.com"],
    }

@pytest.fixture
def mock_batch_notification():
    return [
        {
            "title": "Test Notification 1",
            "message": "This is a test notification 1",
            "recipients": ["user1@example.com"],
        },
        {
            "title": "Test Notification 2",
            "message": "This is a test notification 2",
            "recipients": ["user2@example.com"],
        },
    ]

def test_send_notification(mock_notification):
    assert send_notification(mock_notification) is True

def test_send_notification_empty_recipients():
    notification = {
        "title": "Test Notification",
        "message": "This is a test notification",
        "recipients": [],
    }
    assert send_notification(notification) is False

def test_send_batch_notification(mock_batch_notification):
    assert send_batch_notification(mock_batch_notification) is True

def test_send_batch_notification_empty_batch():
    batch = []
    assert send_batch_notification(batch) is False
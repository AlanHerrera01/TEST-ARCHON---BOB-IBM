import pytest
from backend.app.notifications import (
    create_notification,
    delete_notification,
    get_notification,
    get_notifications,
    update_notification,
)

@pytest.fixture
def notification_id():
    return "12345"

@pytest.fixture
def notification_data():
    return {"title": "Test Notification", "message": "This is a test notification"}

def test_create_notification(notification_data):
    notification = create_notification(notification_data)
    assert notification["id"] is not None
    assert notification["title"] == notification_data["title"]
    assert notification["message"] == notification_data["message"]

def test_get_notification(notification_id):
    notification = get_notification(notification_id)
    assert notification["id"] == notification_id

def test_get_notifications():
    notifications = get_notifications()
    assert isinstance(notifications, list)

def test_update_notification(notification_id, notification_data):
    updated_notification = update_notification(notification_id, notification_data)
    assert updated_notification["id"] == notification_id
    assert updated_notification["title"] == notification_data["title"]
    assert updated_notification["message"] == notification_data["message"]

def test_delete_notification(notification_id):
    delete_notification(notification_id)
    with pytest.raises(Exception):
        get_notification(notification_id)

def test_create_notification_edge_case_empty_data():
    with pytest.raises(Exception):
        create_notification({})

def test_get_notification_edge_case_invalid_id():
    with pytest.raises(Exception):
        get_notification("invalid-id")

def test_update_notification_edge_case_empty_data(notification_id):
    with pytest.raises(Exception):
        update_notification(notification_id, {})

def test_update_notification_edge_case_invalid_id(notification_data):
    with pytest.raises(Exception):
        update_notification("invalid-id", notification_data)
"""Notification sender — email, SMS and push.

Este módulo acaba de mergearse. No tiene tests todavía.
"""

from __future__ import annotations


class NotificationError(ValueError):
    """Raised when a notification cannot be delivered due to invalid input."""


# ---------------------------------------------------------------------------
# Email
# ---------------------------------------------------------------------------

def send_email(to: str, subject: str, body: str) -> dict:
    """Send an email notification.

    Args:
        to: Recipient address (must contain '@').
        subject: Email subject (must not be empty).
        body: Plain-text body.

    Returns:
        A dict with keys ``status`` and ``recipient``.

    Raises:
        NotificationError: If *to* has no '@' or *subject* is blank.
    """
    if "@" not in to:
        raise NotificationError(f"Invalid email address: {to!r}")
    if not subject.strip():
        raise NotificationError("Email subject must not be empty")

    # TODO: integrate real SMTP / SES client
    return {"status": "sent", "channel": "email", "recipient": to}


# ---------------------------------------------------------------------------
# SMS
# ---------------------------------------------------------------------------

def send_sms(phone: str, message: str) -> dict:
    """Send an SMS notification.

    Args:
        phone: E.164 phone number (must start with '+').
        message: Text content (max 160 characters).

    Returns:
        A dict with keys ``status`` and ``recipient``.

    Raises:
        NotificationError: If *phone* lacks the '+' prefix or *message*
            exceeds 160 characters.
    """
    if not phone.startswith("+"):
        raise NotificationError(
            f"Phone number must start with '+': {phone!r}"
        )
    if len(message) > 160:
        raise NotificationError(
            f"SMS message too long ({len(message)} chars, max 160)"
        )

    # TODO: integrate Twilio / SNS client
    return {"status": "sent", "channel": "sms", "recipient": phone}


# ---------------------------------------------------------------------------
# Push
# ---------------------------------------------------------------------------

def send_push(device_id: str, title: str, body: str) -> dict:
    """Send a push notification to a mobile device.

    Args:
        device_id: Unique device token (must not be empty).
        title: Notification title.
        body: Notification body text.

    Returns:
        A dict with keys ``status`` and ``device_id``.

    Raises:
        NotificationError: If *device_id* is blank.
    """
    if not device_id.strip():
        raise NotificationError("device_id must not be empty")

    # TODO: integrate FCM / APNs client
    return {"status": "sent", "channel": "push", "device_id": device_id}

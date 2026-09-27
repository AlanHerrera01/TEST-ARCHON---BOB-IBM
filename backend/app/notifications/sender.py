"""
app/notifications/sender.py

Módulo de envío de notificaciones — añadido en feature/notifications.
Cubre tres canales: email, SMS y push notification.

Demo module for TEST-ARCHON — Escenario B (Coverage Gap: módulo nuevo sin tests).
"""
from __future__ import annotations


class NotificationError(Exception):
    """Raised when a notification cannot be sent."""


def send_email(to: str, subject: str, body: str) -> bool:
    """Envía un email.

    Raises:
        NotificationError: si el destinatario es inválido o el asunto está vacío.
    """
    if not to or "@" not in to:
        raise NotificationError(f"Email inválido: {to!r}")
    if not subject:
        raise NotificationError("El asunto no puede estar vacío")
    print(f"[EMAIL] -> {to} | {subject} | {len(body)} chars")
    return True


def send_sms(phone: str, message: str) -> bool:
    """Envía un SMS.

    Raises:
        NotificationError: si el teléfono no tiene prefijo internacional o el
        mensaje supera los 160 caracteres.
    """
    if not phone.startswith("+"):
        raise NotificationError(
            "El teléfono debe incluir prefijo internacional (+XX)"
        )
    if len(message) > 160:
        raise NotificationError(
            f"SMS demasiado largo: {len(message)} chars (máx 160)"
        )
    print(f"[SMS] -> {phone} | {message[:30]}...")
    return True


def send_push(device_id: str, title: str, payload: dict | None = None) -> bool:
    """Envía una push notification a un dispositivo.

    Raises:
        NotificationError: si device_id está vacío.
    """
    if not device_id:
        raise NotificationError("device_id es obligatorio")
    print(f"[PUSH] -> {device_id} | {title}")
    return True

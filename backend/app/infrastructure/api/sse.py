"""
SSE (Server-Sent Events) helpers for TEST-ARCHON.

Provides a thread-safe EventBus that the Orchestrator publishes to,
and a generator that the FastAPI streaming endpoint consumes.
"""
from __future__ import annotations

import json
import queue
import threading
from contextlib import contextmanager
from dataclasses import asdict
from typing import Generator

from app.domain.models import OrchestratorEvent


def format_sse(event: OrchestratorEvent) -> str:
    """Serialise an OrchestratorEvent to an SSE data frame."""
    payload = {
        "session_id": event.session_id,
        "event_type": event.event_type.value,
        "agent": event.agent,
        "payload": event.payload,
        "timestamp": event.timestamp.isoformat(),
    }
    return f"data: {json.dumps(payload)}\n\n"


class EventBus:
    """
    Simple pub-sub bus for OrchestratorEvent objects.

    Multiple SSE clients can subscribe simultaneously; each gets its own queue.
    Thread-safe via a lock on the subscriber list.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._subscribers: list[queue.Queue] = []

    def publish(self, event: OrchestratorEvent) -> None:
        """Publish *event* to all active subscribers (called by the orchestrator)."""
        with self._lock:
            for q in self._subscribers:
                q.put(event)

    @contextmanager
    def subscribe(self) -> Generator[queue.Queue, None, None]:
        """Context-manager that yields a queue and auto-deregisters on exit."""
        q: queue.Queue = queue.Queue()
        with self._lock:
            self._subscribers.append(q)
        try:
            yield q
        finally:
            with self._lock:
                self._subscribers.remove(q)
            q.put(None)  # sentinel to unblock the consumer

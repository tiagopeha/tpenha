from __future__ import annotations

import threading

from aiobs._types import AIEvent


class InMemoryBackend:
    def __init__(self) -> None:
        self._events: list[AIEvent] = []
        self._lock = threading.Lock()

    def record(self, event: AIEvent) -> None:
        with self._lock:
            self._events.append(event)

    def query(
        self,
        *,
        provider: str | None = None,
        model: str | None = None,
        status: str | None = None,
        since: str | None = None,
        until: str | None = None,
        project: str | None = None,
        limit: int = 100,
    ) -> list[AIEvent]:
        results: list[AIEvent] = []
        with self._lock:
            for event in reversed(self._events):
                if provider and event.provider != provider:
                    continue
                if model and event.model != model:
                    continue
                if status and event.status.value != status:
                    continue
                if project and event.project != project:
                    continue
                if since and event.timestamp < since:
                    continue
                if until and event.timestamp > until:
                    continue
                results.append(event)
                if len(results) >= limit:
                    break
        return results

    def flush(self) -> None:
        pass

    @property
    def events(self) -> list[AIEvent]:
        with self._lock:
            return list(self._events)

    def clear(self) -> None:
        with self._lock:
            self._events.clear()

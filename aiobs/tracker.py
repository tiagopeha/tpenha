from __future__ import annotations

import time
from contextlib import contextmanager
from typing import Any, Sequence

import httpx

from aiobs._types import AIEvent, CostEstimate, EventStatus, TokenUsage
from aiobs.backends.base import ObsBackend
from aiobs.pricing import estimate_cost


class AITracker:
    def __init__(
        self,
        backends: Sequence[ObsBackend] | None = None,
        project: str = "",
        default_extra: dict[str, Any] | None = None,
    ):
        self._backends: list[ObsBackend] = list(backends or [])
        self._project = project
        self._default_extra = default_extra or {}

    def add_backend(self, backend: ObsBackend) -> None:
        self._backends.append(backend)

    @contextmanager
    def track(
        self,
        *,
        provider: str,
        model: str,
        operation: str,
        caller: str = "",
        command: str = "",
        endpoint: str = "",
        attempt: int = 1,
        max_attempts: int = 1,
        **extra: Any,
    ):
        event = AIEvent(
            provider=provider,
            model=model,
            operation=operation,
            endpoint=endpoint,
            project=self._project,
            caller=caller,
            command=command,
            attempt=attempt,
            max_attempts=max_attempts,
            extra={**self._default_extra, **extra},
        )
        ctx = _TrackContext(event)
        start = time.perf_counter()
        try:
            yield ctx
            event.latency_ms = (time.perf_counter() - start) * 1000
            event.status = ctx._status or EventStatus.SUCCESS
        except Exception as exc:
            event.latency_ms = (time.perf_counter() - start) * 1000
            event.status = _classify_error(exc)
            event.error_type = type(exc).__name__
            event.error_message = str(exc)[:500]
            raise
        finally:
            if ctx._tokens:
                event.tokens = ctx._tokens
                event.cost = estimate_cost(model, ctx._tokens)
            if ctx._http_status:
                event.http_status = ctx._http_status
            self._emit(event)

    def record_event(self, event: AIEvent) -> None:
        self._emit(event)

    def _emit(self, event: AIEvent) -> None:
        for backend in self._backends:
            try:
                backend.record(event)
            except Exception:
                pass

    def flush(self) -> None:
        for backend in self._backends:
            try:
                backend.flush()
            except Exception:
                pass


class _TrackContext:
    def __init__(self, event: AIEvent):
        self._event = event
        self._tokens: TokenUsage | None = None
        self._http_status: int = 0
        self._status: EventStatus | None = None

    def set_response(self, response: Any, *, tokens: TokenUsage | None = None) -> None:
        if hasattr(response, "status_code"):
            self._http_status = response.status_code
        if tokens:
            self._tokens = tokens

    def set_tokens(self, input_tokens: int, output_tokens: int) -> None:
        self._tokens = TokenUsage(
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=input_tokens + output_tokens,
        )

    def set_status(self, status: EventStatus) -> None:
        self._status = status

    def set_fallback(self, original_model: str) -> None:
        self._event.fallback_from_model = original_model
        self._status = EventStatus.FALLBACK


def _classify_error(exc: Exception) -> EventStatus:
    if isinstance(exc, httpx.TimeoutException):
        return EventStatus.TIMEOUT
    if isinstance(exc, httpx.HTTPStatusError):
        if exc.response.status_code == 429:
            return EventStatus.RATE_LIMITED
        return EventStatus.ERROR
    return EventStatus.ERROR

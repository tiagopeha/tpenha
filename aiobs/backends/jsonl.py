from __future__ import annotations

import json
import threading
from pathlib import Path

from aiobs._types import AIEvent, CostEstimate, EventStatus, TokenUsage

_DEFAULT_PATH = Path.home() / ".aiobs" / "events.jsonl"


class JSONLBackend:
    def __init__(self, path: str | Path | None = None):
        self._path = Path(path) if path else _DEFAULT_PATH
        self._lock = threading.Lock()
        self._path.parent.mkdir(parents=True, exist_ok=True)

    def record(self, event: AIEvent) -> None:
        line = json.dumps(event.to_dict(), ensure_ascii=False) + "\n"
        with self._lock:
            with self._path.open("a", encoding="utf-8") as f:
                f.write(line)

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
        if not self._path.exists():
            return []

        results: list[AIEvent] = []
        with self._path.open("r", encoding="utf-8") as f:
            lines = f.readlines()

        for line in reversed(lines):
            line = line.strip()
            if not line:
                continue
            try:
                d = json.loads(line)
            except json.JSONDecodeError:
                continue

            if provider and d.get("provider") != provider:
                continue
            if model and d.get("model") != model:
                continue
            if status and d.get("status") != status:
                continue
            if project and d.get("project") != project:
                continue
            if since and d.get("timestamp", "") < since:
                continue
            if until and d.get("timestamp", "") > until:
                continue

            results.append(_dict_to_event(d))
            if len(results) >= limit:
                break

        return results

    def flush(self) -> None:
        pass


def _dict_to_event(d: dict) -> AIEvent:
    tokens_d = d.pop("tokens", None)
    cost_d = d.pop("cost", None)

    tokens = TokenUsage(**tokens_d) if tokens_d else None
    cost = CostEstimate(**cost_d) if cost_d else None

    status_val = d.pop("status", "success")
    try:
        status = EventStatus(status_val)
    except ValueError:
        status = EventStatus.SUCCESS

    return AIEvent(
        **{k: v for k, v in d.items() if k in _EVENT_FIELDS},
        tokens=tokens,
        cost=cost,
        status=status,
    )


_EVENT_FIELDS = {
    "event_id",
    "timestamp",
    "provider",
    "model",
    "operation",
    "endpoint",
    "project",
    "caller",
    "command",
    "latency_ms",
    "error_type",
    "error_message",
    "attempt",
    "max_attempts",
    "fallback_from_model",
    "http_status",
    "request_size_bytes",
    "response_size_bytes",
    "extra",
}

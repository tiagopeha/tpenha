from __future__ import annotations

from typing import Protocol

from aiobs._types import AIEvent


class ObsBackend(Protocol):
    def record(self, event: AIEvent) -> None: ...

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
    ) -> list[AIEvent]: ...

    def flush(self) -> None: ...

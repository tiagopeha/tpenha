from __future__ import annotations

from typing import Sequence

from aiobs._types import AIEvent, CostEstimate, EventStatus, TokenUsage
from aiobs.backends.base import ObsBackend
from aiobs.tracker import AITracker

__all__ = [
    "AIEvent",
    "AITracker",
    "CostEstimate",
    "EventStatus",
    "TokenUsage",
    "get_tracker",
    "init_tracker",
]

_tracker: AITracker | None = None


def init_tracker(
    project: str = "",
    backends: Sequence[ObsBackend] | None = None,
) -> AITracker:
    global _tracker
    _tracker = AITracker(backends=backends, project=project)
    return _tracker


def get_tracker() -> AITracker:
    global _tracker
    if _tracker is None:
        _tracker = AITracker(backends=[], project="")
    return _tracker

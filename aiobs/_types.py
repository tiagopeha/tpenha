from __future__ import annotations

import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any


class EventStatus(str, Enum):
    SUCCESS = "success"
    ERROR = "error"
    TIMEOUT = "timeout"
    RATE_LIMITED = "rate_limited"
    FALLBACK = "fallback"


@dataclass(frozen=True, slots=True)
class TokenUsage:
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0


@dataclass(frozen=True, slots=True)
class CostEstimate:
    input_cost_usd: float = 0.0
    output_cost_usd: float = 0.0
    total_cost_usd: float = 0.0


@dataclass(slots=True)
class AIEvent:
    event_id: str = field(default_factory=lambda: uuid.uuid4().hex[:16])
    timestamp: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    provider: str = ""
    model: str = ""
    operation: str = ""
    endpoint: str = ""

    project: str = ""
    caller: str = ""
    command: str = ""

    latency_ms: float = 0.0

    tokens: TokenUsage | None = None
    cost: CostEstimate | None = None

    status: EventStatus = EventStatus.SUCCESS
    error_type: str = ""
    error_message: str = ""

    attempt: int = 1
    max_attempts: int = 1
    fallback_from_model: str = ""

    http_status: int = 0
    request_size_bytes: int = 0
    response_size_bytes: int = 0

    extra: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        d = {}
        for k, v in asdict(self).items():
            if v is None or v == "" or v == 0 or v == 0.0 or v == {}:
                continue
            if isinstance(v, EventStatus):
                d[k] = v.value
            else:
                d[k] = v
        return d

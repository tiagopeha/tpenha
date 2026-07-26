import json

from aiobs._types import AIEvent, EventStatus, TokenUsage
from aiobs.backends.jsonl import JSONLBackend
from aiobs.pricing import estimate_cost


def test_record_creates_jsonl_file(tmp_path):
    path = tmp_path / "events.jsonl"
    backend = JSONLBackend(path=path)

    event = AIEvent(
        provider="anthropic",
        model="claude-opus-4-7",
        operation="chat",
        latency_ms=1234.0,
    )
    backend.record(event)

    assert path.exists()
    lines = path.read_text().strip().split("\n")
    assert len(lines) == 1
    d = json.loads(lines[0])
    assert d["provider"] == "anthropic"
    assert d["model"] == "claude-opus-4-7"


def test_record_appends_multiple_events(tmp_path):
    path = tmp_path / "events.jsonl"
    backend = JSONLBackend(path=path)

    for i in range(5):
        event = AIEvent(provider="openai", model="whisper-1", latency_ms=float(i))
        backend.record(event)

    lines = path.read_text().strip().split("\n")
    assert len(lines) == 5


def test_query_returns_newest_first(tmp_path):
    path = tmp_path / "events.jsonl"
    backend = JSONLBackend(path=path)

    for i in range(3):
        event = AIEvent(
            provider="anthropic",
            model="claude-opus-4-7",
            latency_ms=float(i * 100),
        )
        backend.record(event)

    results = backend.query(limit=10)
    assert len(results) == 3
    assert results[0].latency_ms == 200.0
    assert results[2].latency_ms == 0.0


def test_query_filters_by_provider(tmp_path):
    path = tmp_path / "events.jsonl"
    backend = JSONLBackend(path=path)

    backend.record(AIEvent(provider="anthropic", model="claude-opus-4-7", latency_ms=1.0))
    backend.record(AIEvent(provider="openai", model="whisper-1", latency_ms=2.0))
    backend.record(AIEvent(provider="anthropic", model="claude-sonnet-4-6", latency_ms=3.0))

    results = backend.query(provider="anthropic")
    assert len(results) == 2
    assert all(e.provider == "anthropic" for e in results)


def test_query_filters_by_model(tmp_path):
    path = tmp_path / "events.jsonl"
    backend = JSONLBackend(path=path)

    backend.record(AIEvent(provider="anthropic", model="claude-opus-4-7", latency_ms=1.0))
    backend.record(AIEvent(provider="anthropic", model="claude-sonnet-4-6", latency_ms=2.0))

    results = backend.query(model="claude-opus-4-7")
    assert len(results) == 1
    assert results[0].model == "claude-opus-4-7"


def test_query_filters_by_status(tmp_path):
    path = tmp_path / "events.jsonl"
    backend = JSONLBackend(path=path)

    backend.record(AIEvent(provider="anthropic", model="m", latency_ms=1.0, status=EventStatus.SUCCESS))
    backend.record(AIEvent(provider="anthropic", model="m", latency_ms=2.0, status=EventStatus.TIMEOUT))

    results = backend.query(status="timeout")
    assert len(results) == 1
    assert results[0].status == EventStatus.TIMEOUT


def test_query_respects_limit(tmp_path):
    path = tmp_path / "events.jsonl"
    backend = JSONLBackend(path=path)

    for i in range(10):
        backend.record(AIEvent(provider="anthropic", model="m", latency_ms=float(i)))

    results = backend.query(limit=3)
    assert len(results) == 3


def test_query_empty_file(tmp_path):
    path = tmp_path / "events.jsonl"
    backend = JSONLBackend(path=path)
    results = backend.query()
    assert results == []


def test_roundtrip_with_tokens(tmp_path):
    path = tmp_path / "events.jsonl"
    backend = JSONLBackend(path=path)

    tokens = TokenUsage(input_tokens=100, output_tokens=50, total_tokens=150)
    cost = estimate_cost("claude-opus-4-7", tokens)
    event = AIEvent(
        provider="anthropic",
        model="claude-opus-4-7",
        tokens=tokens,
        cost=cost,
        latency_ms=500.0,
    )
    backend.record(event)

    results = backend.query()
    assert len(results) == 1
    r = results[0]
    assert r.tokens.input_tokens == 100
    assert r.tokens.output_tokens == 50
    assert r.cost.total_cost_usd == cost.total_cost_usd

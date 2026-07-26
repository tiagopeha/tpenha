import json

import pytest

from aiobs._types import AIEvent, CostEstimate, EventStatus, TokenUsage
from aiobs.backends.jsonl import JSONLBackend


@pytest.fixture()
def backend_with_data(tmp_path):
    path = tmp_path / "events.jsonl"
    backend = JSONLBackend(path=path)

    events = [
        AIEvent(
            provider="anthropic",
            model="claude-opus-4-7",
            operation="chat",
            project="test-project",
            command="ignicao",
            latency_ms=2000.0,
            status=EventStatus.SUCCESS,
            tokens=TokenUsage(input_tokens=1000, output_tokens=500, total_tokens=1500),
            cost=CostEstimate(input_cost_usd=0.015, output_cost_usd=0.0375, total_cost_usd=0.0525),
        ),
        AIEvent(
            provider="openai",
            model="whisper-1",
            operation="transcription",
            project="test-project",
            command="ignicao",
            latency_ms=4000.0,
            status=EventStatus.SUCCESS,
        ),
        AIEvent(
            provider="anthropic",
            model="claude-opus-4-7",
            operation="chat",
            project="test-project",
            command="destrava",
            latency_ms=3000.0,
            status=EventStatus.TIMEOUT,
            error_type="TimeoutException",
            error_message="Read timed out",
        ),
    ]

    for ev in events:
        backend.record(ev)

    return backend


def test_get_ai_events(backend_with_data):
    from aiobs_mcp.server import _backend, get_ai_events

    import aiobs_mcp.server as srv
    original = srv._backend
    srv._backend = backend_with_data
    try:
        result = get_ai_events()
        assert len(result) == 3

        result_filtered = get_ai_events(provider="anthropic")
        assert len(result_filtered) == 2

        result_cmd = get_ai_events(command="ignicao")
        assert len(result_cmd) == 2
    finally:
        srv._backend = original


def test_get_cost_summary(backend_with_data):
    import aiobs_mcp.server as srv
    original = srv._backend
    srv._backend = backend_with_data
    try:
        from aiobs_mcp.server import get_cost_summary

        result = get_cost_summary()
        assert result["total_events"] == 3
        assert result["total_cost_usd"] > 0
        assert len(result["breakdown"]) >= 1
    finally:
        srv._backend = original


def test_get_error_summary(backend_with_data):
    import aiobs_mcp.server as srv
    original = srv._backend
    srv._backend = backend_with_data
    try:
        from aiobs_mcp.server import get_error_summary

        result = get_error_summary()
        assert result["total_events"] == 3
        assert result["total_errors"] == 1
        assert result["error_rate_pct"] > 0
        assert "timeout" in result["by_status"]
    finally:
        srv._backend = original


def test_get_latency_stats(backend_with_data):
    import aiobs_mcp.server as srv
    original = srv._backend
    srv._backend = backend_with_data
    try:
        from aiobs_mcp.server import get_latency_stats

        result = get_latency_stats()
        assert "claude-opus-4-7" in result["models"]
        assert "whisper-1" in result["models"]
        assert result["models"]["whisper-1"]["avg_ms"] == 4000.0
    finally:
        srv._backend = original


def test_list_ai_projects(backend_with_data):
    import aiobs_mcp.server as srv
    original = srv._backend
    srv._backend = backend_with_data
    try:
        from aiobs_mcp.server import list_ai_projects

        result = list_ai_projects()
        assert len(result) == 1
        assert result[0]["project"] == "test-project"
        assert result[0]["total_events"] == 3
    finally:
        srv._backend = original

import json

from aiobs._types import AIEvent, CostEstimate, EventStatus, TokenUsage


def test_to_dict_omits_empty_fields():
    event = AIEvent(provider="anthropic", model="claude-opus-4-7")
    d = event.to_dict()
    assert "error_type" not in d
    assert "error_message" not in d
    assert "fallback_from_model" not in d
    assert "extra" not in d
    assert d["provider"] == "anthropic"
    assert d["model"] == "claude-opus-4-7"


def test_to_dict_includes_tokens_and_cost():
    event = AIEvent(
        provider="anthropic",
        model="claude-opus-4-7",
        tokens=TokenUsage(input_tokens=100, output_tokens=50, total_tokens=150),
        cost=CostEstimate(
            input_cost_usd=0.0015, output_cost_usd=0.00375, total_cost_usd=0.00525
        ),
    )
    d = event.to_dict()
    assert d["tokens"]["input_tokens"] == 100
    assert d["tokens"]["output_tokens"] == 50
    assert d["cost"]["total_cost_usd"] == 0.00525


def test_to_dict_serializes_to_valid_json():
    event = AIEvent(
        provider="openai",
        model="whisper-1",
        status=EventStatus.SUCCESS,
        latency_ms=1234.56,
    )
    d = event.to_dict()
    serialized = json.dumps(d)
    parsed = json.loads(serialized)
    assert parsed["provider"] == "openai"
    assert parsed["latency_ms"] == 1234.56


def test_to_dict_error_event():
    event = AIEvent(
        provider="anthropic",
        model="claude-opus-4-7",
        status=EventStatus.TIMEOUT,
        error_type="TimeoutException",
        error_message="Read timed out",
    )
    d = event.to_dict()
    assert d["status"] == "timeout"
    assert d["error_type"] == "TimeoutException"


def test_event_id_and_timestamp_auto_generated():
    e1 = AIEvent()
    e2 = AIEvent()
    assert e1.event_id != e2.event_id
    assert len(e1.event_id) == 16
    assert "T" in e1.timestamp

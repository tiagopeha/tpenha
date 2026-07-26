import pytest

from aiobs._types import EventStatus
from aiobs.backends.memory import InMemoryBackend
from aiobs.tracker import AITracker


def test_track_success():
    backend = InMemoryBackend()
    tracker = AITracker(backends=[backend], project="test-project")

    with tracker.track(
        provider="anthropic", model="claude-opus-4-7", operation="chat"
    ) as ctx:
        ctx.set_tokens(input_tokens=100, output_tokens=50)

    assert len(backend.events) == 1
    event = backend.events[0]
    assert event.provider == "anthropic"
    assert event.model == "claude-opus-4-7"
    assert event.status == EventStatus.SUCCESS
    assert event.latency_ms > 0
    assert event.tokens.input_tokens == 100
    assert event.tokens.output_tokens == 50
    assert event.project == "test-project"


def test_track_exception():
    backend = InMemoryBackend()
    tracker = AITracker(backends=[backend])

    with pytest.raises(ValueError, match="test error"):
        with tracker.track(
            provider="openai", model="whisper-1", operation="transcription"
        ):
            raise ValueError("test error")

    assert len(backend.events) == 1
    event = backend.events[0]
    assert event.status == EventStatus.ERROR
    assert event.error_type == "ValueError"
    assert event.error_message == "test error"
    assert event.latency_ms > 0


def test_track_records_latency():
    import time

    backend = InMemoryBackend()
    tracker = AITracker(backends=[backend])

    with tracker.track(
        provider="anthropic", model="claude-opus-4-7", operation="chat"
    ):
        time.sleep(0.05)

    event = backend.events[0]
    assert event.latency_ms >= 40


def test_noop_tracker_does_not_break():
    tracker = AITracker(backends=[])

    with tracker.track(
        provider="anthropic", model="claude-opus-4-7", operation="chat"
    ) as ctx:
        ctx.set_tokens(input_tokens=10, output_tokens=5)


def test_track_with_command_and_caller():
    backend = InMemoryBackend()
    tracker = AITracker(backends=[backend])

    with tracker.track(
        provider="anthropic",
        model="claude-opus-4-7",
        operation="chat",
        caller="process._chamar_claude",
        command="ignicao",
        attempt=2,
        max_attempts=3,
    ):
        pass

    event = backend.events[0]
    assert event.caller == "process._chamar_claude"
    assert event.command == "ignicao"
    assert event.attempt == 2
    assert event.max_attempts == 3


def test_track_cost_estimated():
    backend = InMemoryBackend()
    tracker = AITracker(backends=[backend])

    with tracker.track(
        provider="anthropic", model="claude-opus-4-7", operation="chat"
    ) as ctx:
        ctx.set_tokens(input_tokens=1000, output_tokens=500)

    event = backend.events[0]
    assert event.cost is not None
    assert event.cost.total_cost_usd > 0


def test_record_event_directly():
    from aiobs._types import AIEvent

    backend = InMemoryBackend()
    tracker = AITracker(backends=[backend])

    event = AIEvent(
        provider="anthropic",
        model="claude-opus-4-7",
        status=EventStatus.FALLBACK,
        fallback_from_model="claude-opus-4-7",
    )
    tracker.record_event(event)

    assert len(backend.events) == 1
    assert backend.events[0].status == EventStatus.FALLBACK


def test_set_fallback():
    backend = InMemoryBackend()
    tracker = AITracker(backends=[backend])

    with tracker.track(
        provider="anthropic", model="claude-sonnet-4-6", operation="chat"
    ) as ctx:
        ctx.set_fallback("claude-opus-4-7")

    event = backend.events[0]
    assert event.status == EventStatus.FALLBACK
    assert event.fallback_from_model == "claude-opus-4-7"

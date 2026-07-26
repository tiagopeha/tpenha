from __future__ import annotations

import statistics
from collections import defaultdict

from fastmcp import FastMCP

from aiobs.backends.jsonl import JSONLBackend

mcp = FastMCP("AI Observability")
_backend = JSONLBackend()


@mcp.tool()
def get_ai_events(
    provider: str = "",
    model: str = "",
    status: str = "",
    since: str = "",
    until: str = "",
    project: str = "",
    command: str = "",
    limit: int = 50,
) -> list[dict]:
    """Query AI API call events with optional filters. Returns individual call records sorted newest first."""
    events = _backend.query(
        provider=provider or None,
        model=model or None,
        status=status or None,
        since=since or None,
        until=until or None,
        project=project or None,
        limit=limit,
    )
    if command:
        events = [e for e in events if e.command == command]
    return [e.to_dict() for e in events]


@mcp.tool()
def get_cost_summary(
    since: str = "",
    until: str = "",
    project: str = "",
    group_by: str = "model",
) -> dict:
    """Get aggregated cost summary across AI API calls, grouped by model, provider, command, or day."""
    events = _backend.query(
        since=since or None,
        until=until or None,
        project=project or None,
        limit=10000,
    )

    total_cost = 0.0
    groups: dict[str, dict] = defaultdict(
        lambda: {"events": 0, "cost_usd": 0.0, "total_tokens": 0, "latency_sum": 0.0}
    )

    for ev in events:
        cost = ev.cost.total_cost_usd if ev.cost else 0.0
        total_cost += cost
        tokens = ev.tokens.total_tokens if ev.tokens else 0

        if group_by == "model":
            key = ev.model
        elif group_by == "provider":
            key = ev.provider
        elif group_by == "command":
            key = ev.command
        elif group_by == "day":
            key = ev.timestamp[:10]
        else:
            key = ev.model

        g = groups[key]
        g["events"] += 1
        g["cost_usd"] += cost
        g["total_tokens"] += tokens
        g["latency_sum"] += ev.latency_ms

    breakdown = []
    for key, g in sorted(groups.items(), key=lambda x: -x[1]["cost_usd"]):
        avg_latency = g["latency_sum"] / g["events"] if g["events"] else 0
        breakdown.append({
            group_by: key,
            "events": g["events"],
            "cost_usd": round(g["cost_usd"], 8),
            "total_tokens": g["total_tokens"],
            "avg_latency_ms": round(avg_latency, 2),
        })

    return {
        "total_cost_usd": round(total_cost, 8),
        "total_events": len(events),
        "breakdown": breakdown,
    }


@mcp.tool()
def get_error_summary(
    since: str = "",
    project: str = "",
) -> dict:
    """Get summary of AI API errors, timeouts, and rate limits."""
    all_events = _backend.query(
        since=since or None,
        project=project or None,
        limit=10000,
    )

    total = len(all_events)
    errors = [e for e in all_events if e.status.value != "success"]
    by_type: dict[str, int] = defaultdict(int)
    for e in errors:
        by_type[e.status.value] += 1

    recent_errors = []
    for e in errors[:10]:
        recent_errors.append({
            "timestamp": e.timestamp,
            "provider": e.provider,
            "model": e.model,
            "status": e.status.value,
            "error_type": e.error_type,
            "error_message": e.error_message,
        })

    return {
        "total_events": total,
        "total_errors": len(errors),
        "error_rate_pct": round(len(errors) / total * 100, 2) if total else 0,
        "by_status": dict(by_type),
        "recent_errors": recent_errors,
    }


@mcp.tool()
def get_latency_stats(
    provider: str = "",
    model: str = "",
    since: str = "",
    project: str = "",
) -> dict:
    """Get latency statistics (p50, p90, p99, avg, min, max) for AI API calls."""
    events = _backend.query(
        provider=provider or None,
        model=model or None,
        since=since or None,
        project=project or None,
        limit=10000,
    )

    by_model: dict[str, list[float]] = defaultdict(list)
    for e in events:
        if e.latency_ms > 0:
            by_model[e.model].append(e.latency_ms)

    stats = {}
    for model_name, latencies in sorted(by_model.items()):
        latencies.sort()
        n = len(latencies)
        stats[model_name] = {
            "count": n,
            "avg_ms": round(statistics.mean(latencies), 2),
            "min_ms": round(latencies[0], 2),
            "max_ms": round(latencies[-1], 2),
            "p50_ms": round(latencies[n // 2], 2),
            "p90_ms": round(latencies[int(n * 0.9)], 2) if n >= 10 else None,
            "p99_ms": round(latencies[int(n * 0.99)], 2) if n >= 100 else None,
        }

    return {"models": stats}


@mcp.tool()
def list_ai_projects() -> list[dict]:
    """List all projects that have recorded AI observability events."""
    events = _backend.query(limit=10000)
    projects: dict[str, dict] = {}

    for e in events:
        name = e.project or "(unknown)"
        if name not in projects:
            projects[name] = {
                "project": name,
                "first_seen": e.timestamp,
                "last_seen": e.timestamp,
                "total_events": 0,
            }
        p = projects[name]
        p["total_events"] += 1
        if e.timestamp < p["first_seen"]:
            p["first_seen"] = e.timestamp
        if e.timestamp > p["last_seen"]:
            p["last_seen"] = e.timestamp

    return sorted(projects.values(), key=lambda x: x["last_seen"], reverse=True)


def main():
    mcp.run()


if __name__ == "__main__":
    main()

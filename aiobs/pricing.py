from __future__ import annotations

from aiobs._types import CostEstimate, TokenUsage

_PRICING: dict[str, tuple[float, float]] = {
    "claude-opus-4-7": (15.00, 75.00),
    "claude-opus-4-6": (15.00, 75.00),
    "claude-sonnet-4-6": (3.00, 15.00),
    "claude-sonnet-4-5": (3.00, 15.00),
    "claude-haiku-3-5": (0.80, 4.00),
    "whisper-1": (0.006, 0.0),
}


def register_model_pricing(
    model: str, input_per_1m: float, output_per_1m: float
) -> None:
    _PRICING[model] = (input_per_1m, output_per_1m)


def estimate_cost(model: str, tokens: TokenUsage) -> CostEstimate:
    prices = _PRICING.get(model)
    if not prices:
        return CostEstimate()
    input_cost = (tokens.input_tokens / 1_000_000) * prices[0]
    output_cost = (tokens.output_tokens / 1_000_000) * prices[1]
    return CostEstimate(
        input_cost_usd=round(input_cost, 8),
        output_cost_usd=round(output_cost, 8),
        total_cost_usd=round(input_cost + output_cost, 8),
    )

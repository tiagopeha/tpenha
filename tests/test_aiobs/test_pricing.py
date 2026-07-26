from aiobs._types import TokenUsage
from aiobs.pricing import estimate_cost, register_model_pricing


def test_claude_opus_cost():
    tokens = TokenUsage(input_tokens=1000, output_tokens=500, total_tokens=1500)
    cost = estimate_cost("claude-opus-4-7", tokens)
    assert cost.input_cost_usd == round((1000 / 1_000_000) * 15.00, 8)
    assert cost.output_cost_usd == round((500 / 1_000_000) * 75.00, 8)
    assert cost.total_cost_usd == round(cost.input_cost_usd + cost.output_cost_usd, 8)


def test_claude_sonnet_cost():
    tokens = TokenUsage(input_tokens=2000, output_tokens=1000, total_tokens=3000)
    cost = estimate_cost("claude-sonnet-4-6", tokens)
    assert cost.input_cost_usd == round((2000 / 1_000_000) * 3.00, 8)
    assert cost.output_cost_usd == round((1000 / 1_000_000) * 15.00, 8)


def test_unknown_model_returns_zero():
    tokens = TokenUsage(input_tokens=100, output_tokens=50, total_tokens=150)
    cost = estimate_cost("unknown-model-v9", tokens)
    assert cost.input_cost_usd == 0.0
    assert cost.output_cost_usd == 0.0
    assert cost.total_cost_usd == 0.0


def test_register_custom_model():
    register_model_pricing("my-custom-model", 10.0, 50.0)
    tokens = TokenUsage(input_tokens=1_000_000, output_tokens=1_000_000, total_tokens=2_000_000)
    cost = estimate_cost("my-custom-model", tokens)
    assert cost.input_cost_usd == 10.0
    assert cost.output_cost_usd == 50.0

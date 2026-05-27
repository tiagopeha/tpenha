"""
Cálculos calóricos e recomendações de treino.
"""
from __future__ import annotations

from typing import Any


def calcular_bmr(weight_kg: float, height_cm: float, age: int, sex: str) -> float:
    """
    Equação de Mifflin-St Jeor.
    Homens: (10 × weight) + (6.25 × height) - (5 × age) + 5
    Mulheres: (10 × weight) + (6.25 × height) - (5 × age) - 161
    """
    base = (10 * weight_kg) + (6.25 * height_cm) - (5 * age)
    if sex.lower() == "m":
        return base + 5
    return base - 161


def calcular_tdee(bmr: float, activity_level: str) -> float:
    """
    Total Daily Energy Expenditure baseado no nível de atividade.
    """
    multipliers = {
        "sedentary": 1.2,
        "light": 1.375,
        "moderate": 1.55,
        "active": 1.725,
        "very_active": 1.9,
    }
    mult = multipliers.get(activity_level, 1.55)
    return round(bmr * mult, 1)


def calcular_calorias_passos(passos: int, weight_kg: float) -> float:
    """
    Estima calorias queimadas pelos passos.
    ~0.04 kcal por passo, ajustado pelo peso (referência: 70 kg).
    """
    if not passos or not weight_kg:
        return 0.0
    return round((weight_kg / 70) * 0.04 * passos, 1)


def calcular_deficit_dia(
    tdee: float,
    calorias_exercicio: float,
    calorias_passos: float,
    calorias_consumidas: float,
) -> float:
    """
    Calcula o déficit do dia.
    Positivo = déficit (queimou mais do que consumiu).
    Negativo = superávit (consumiu mais do que queimou).
    """
    total_burn = tdee + calorias_exercicio + calorias_passos
    deficit = total_burn - calorias_consumidas
    return round(deficit, 1)


def recomendar_treino(
    dados_samsung: dict[str, Any] | None,
    historico_7_dias: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    Analisa dados de saúde e histórico para recomendar treino do dia.

    Returns:
        {
            "rest_day": bool,
            "cardio": bool,
            "cardio_minutes": int,
            "reason": str,
        }
    """
    if dados_samsung is None:
        return {
            "rest_day": False,
            "cardio": False,
            "cardio_minutes": 0,
            "reason": "Dados Samsung Health não disponíveis. Faça um treino moderado.",
        }

    sono_horas = dados_samsung.get("sono_horas")
    passos = dados_samsung.get("passos") or 0
    exercicios = dados_samsung.get("exercicios") or []

    # Regra 1: Sono insuficiente
    if sono_horas is not None and sono_horas < 6:
        return {
            "rest_day": True,
            "cardio": True,
            "cardio_minutes": 20,
            "reason": (
                f"Você dormiu apenas {sono_horas:.1f}h. "
                "Priorize recuperação. Faça apenas uma caminhada leve se quiser."
            ),
        }

    # Regra 2: 3+ dias consecutivos de treino
    dias_treino_consecutivos = 0
    for dia in reversed(historico_7_dias[-3:]):
        if dia.get("treinou"):
            dias_treino_consecutivos += 1
        else:
            break

    if dias_treino_consecutivos >= 3:
        return {
            "rest_day": True,
            "cardio": False,
            "cardio_minutes": 0,
            "reason": (
                f"Você treinou {dias_treino_consecutivos} dias consecutivos. "
                "Hoje é dia de descanso ativo para recuperação muscular."
            ),
        }

    # Regra 3: Poucos passos e sem exercício
    if passos < 5000 and not exercicios:
        return {
            "rest_day": False,
            "cardio": True,
            "cardio_minutes": 30,
            "reason": (
                f"Você fez apenas {passos:,} passos hoje. "
                "Faça pelo menos 30 minutos de cardio para atingir sua meta."
            ),
        }

    # Treino normal
    return {
        "rest_day": False,
        "cardio": False,
        "cardio_minutes": 0,
        "reason": "Boa recuperação! Você está pronto para um treino completo hoje.",
    }

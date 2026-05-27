"""
Modelos Pydantic para validação e serialização.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


# ── User Profile ──────────────────────────────────────────────────────────────

class UserProfile(BaseModel):
    id: Optional[int] = None
    name: str = "Usuário"
    weight_kg: float = 70.0
    height_cm: float = 170.0
    age: int = 30
    sex: str = "m"  # 'm' | 'f'
    goal: str = "deficit"  # 'deficit' | 'maintain' | 'surplus'
    target_deficit_kcal: int = 500
    activity_level: str = "moderate"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    age: Optional[int] = None
    sex: Optional[str] = None
    goal: Optional[str] = None
    target_deficit_kcal: Optional[int] = None
    activity_level: Optional[str] = None


# ── Meals ─────────────────────────────────────────────────────────────────────

class MealCreate(BaseModel):
    date: str  # YYYY-MM-DD
    meal_type: str  # 'cafe' | 'almoco' | 'jantar' | 'lanche'
    description: str
    image_base64: Optional[str] = None
    # Optional manual override (skips AI analysis)
    calories: Optional[float] = None
    protein_g: Optional[float] = None
    carbs_g: Optional[float] = None
    fat_g: Optional[float] = None


class MealResponse(BaseModel):
    id: int
    date: str
    meal_type: str
    description: str
    image_base64: Optional[str] = None
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    analyzed_by_ai: bool
    created_at: Optional[datetime] = None


class DailyMacros(BaseModel):
    total_calories: float
    total_protein: float
    total_carbs: float
    total_fat: float
    meals: list[MealResponse]


# ── Samsung Health ────────────────────────────────────────────────────────────

class SamsungHealthData(BaseModel):
    passos: Optional[int] = None
    distancia_km: Optional[float] = None
    calorias_passos: Optional[float] = None
    sono_horas: Optional[float] = None
    sono_qualidade: Optional[str] = None
    sono_fases: Optional[dict[str, Any]] = None
    fc_media: Optional[int] = None
    fc_min: Optional[int] = None
    fc_max: Optional[int] = None
    exercicios: Optional[list[dict[str, Any]]] = None


# ── Dashboard ─────────────────────────────────────────────────────────────────

class DashboardData(BaseModel):
    date: str
    profile: Optional[UserProfile] = None
    samsung_health: Optional[SamsungHealthData] = None
    daily_macros: Optional[DailyMacros] = None
    tdee: Optional[float] = None
    bmr: Optional[float] = None
    calories_burned_exercise: Optional[float] = None
    deficit_today: Optional[float] = None
    target_deficit: Optional[int] = None
    recommendation: Optional[str] = None
    rest_day: bool = False
    cardio_suggestion: Optional[str] = None

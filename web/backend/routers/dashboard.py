"""
Rota do dashboard — consolida todos os dados em uma única resposta.
"""
from __future__ import annotations

from datetime import date as date_type, timedelta

from fastapi import APIRouter, Query

from database import get_db
from models import (
    DashboardData,
    DailyMacros,
    MealResponse,
    SamsungHealthData,
    UserProfile,
)
from services.calculator import (
    calcular_bmr,
    calcular_tdee,
    calcular_calorias_passos,
    calcular_deficit_dia,
    recomendar_treino,
)
from services.samsung_health_service import get_daily_data

router = APIRouter()


@router.get("/dashboard", response_model=DashboardData)
async def get_dashboard(date: str = Query(default=None)):
    """Retorna todos os dados do dashboard para a data especificada."""
    # Determina a data alvo
    if date:
        try:
            target_date = date_type.fromisoformat(date)
        except ValueError:
            target_date = date_type.today()
    else:
        target_date = date_type.today()

    date_str = target_date.isoformat()

    # ── 1. Perfil ──────────────────────────────────────────────────────────────
    profile: UserProfile | None = None
    async with await get_db() as db:
        cursor = await db.execute(
            "SELECT * FROM user_profile ORDER BY id ASC LIMIT 1"
        )
        row = await cursor.fetchone()
        if row:
            profile = UserProfile(**dict(row))
        else:
            # Cria perfil padrão
            await db.execute("""
                INSERT INTO user_profile (name, weight_kg, height_cm, age, sex, goal,
                    target_deficit_kcal, activity_level)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, ("Usuário", 70.0, 170.0, 30, "m", "deficit", 500, "moderate"))
            await db.commit()
            cursor = await db.execute(
                "SELECT * FROM user_profile ORDER BY id ASC LIMIT 1"
            )
            row = await cursor.fetchone()
            profile = UserProfile(**dict(row))

    # ── 2. Refeições do dia ────────────────────────────────────────────────────
    daily_macros: DailyMacros | None = None
    async with await get_db() as db:
        cursor = await db.execute(
            "SELECT * FROM meals WHERE date = ? ORDER BY created_at ASC",
            (date_str,),
        )
        rows = await cursor.fetchall()
        meals = [MealResponse(**dict(r)) for r in rows]

        total_calories = sum(m.calories for m in meals)
        total_protein = sum(m.protein_g for m in meals)
        total_carbs = sum(m.carbs_g for m in meals)
        total_fat = sum(m.fat_g for m in meals)

        daily_macros = DailyMacros(
            total_calories=round(total_calories, 1),
            total_protein=round(total_protein, 1),
            total_carbs=round(total_carbs, 1),
            total_fat=round(total_fat, 1),
            meals=meals,
        )

    # ── 3. Samsung Health ──────────────────────────────────────────────────────
    samsung_raw = await get_daily_data(target_date)
    samsung_health = SamsungHealthData(**samsung_raw)

    # ── 4. Cálculos ────────────────────────────────────────────────────────────
    bmr: float | None = None
    tdee: float | None = None
    calories_burned_exercise: float | None = None
    deficit_today: float | None = None

    if profile:
        bmr = calcular_bmr(
            profile.weight_kg,
            profile.height_cm,
            profile.age,
            profile.sex,
        )
        tdee = calcular_tdee(bmr, profile.activity_level)

        # Calorias dos exercícios (soma das sessões Samsung)
        exercicios = samsung_health.exercicios or []
        calories_burned_exercise = float(
            sum(ex.get("calorias", 0) for ex in exercicios)
        )

        # Calorias pelos passos
        passos = samsung_health.passos or 0
        cals_passos = calcular_calorias_passos(passos, profile.weight_kg)

        # Déficit
        deficit_today = calcular_deficit_dia(
            tdee=tdee,
            calorias_exercicio=calories_burned_exercise,
            calorias_passos=cals_passos,
            calorias_consumidas=daily_macros.total_calories if daily_macros else 0.0,
        )

    # ── 5. Histórico 7 dias para recomendação ─────────────────────────────────
    historico_7_dias: list[dict] = []
    async with await get_db() as db:
        for i in range(1, 8):
            dia = target_date - timedelta(days=i)
            cursor = await db.execute(
                "SELECT COUNT(*) as cnt FROM meals WHERE date = ?",
                (dia.isoformat(),),
            )
            row = await cursor.fetchone()
            # Considera "treinou" se tem refeições (proxy simples)
            # Em uma implementação completa, usaria dados Samsung
            historico_7_dias.append({
                "date": dia.isoformat(),
                "treinou": False,  # Sem dados Samsung históricos disponíveis aqui
            })

    # ── 6. Recomendação ────────────────────────────────────────────────────────
    samsung_dict = samsung_raw if any(v is not None for v in samsung_raw.values()) else None
    rec = recomendar_treino(samsung_dict, historico_7_dias)

    return DashboardData(
        date=date_str,
        profile=profile,
        samsung_health=samsung_health,
        daily_macros=daily_macros,
        tdee=tdee,
        bmr=bmr,
        calories_burned_exercise=calories_burned_exercise,
        deficit_today=deficit_today,
        target_deficit=profile.target_deficit_kcal if profile else None,
        recommendation=rec["reason"],
        rest_day=rec["rest_day"],
        cardio_suggestion=(
            f"{rec['cardio_minutes']} minutos de cardio" if rec.get("cardio") else None
        ),
    )

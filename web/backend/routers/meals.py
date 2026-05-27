"""
Rotas de refeições.
"""
from __future__ import annotations

import os
from datetime import date

from fastapi import APIRouter, HTTPException, Query

from database import get_db
from models import MealCreate, MealResponse
from services.claude_meals import analisar_refeicao

router = APIRouter()


@router.get("/meals", response_model=list[MealResponse])
async def list_meals(date: str = Query(default=None)):
    """Lista refeições de um dia específico."""
    if date is None:
        date = str(date.today())

    async with await get_db() as db:
        cursor = await db.execute(
            "SELECT * FROM meals WHERE date = ? ORDER BY created_at ASC",
            (date,),
        )
        rows = await cursor.fetchall()
        return [MealResponse(**dict(row)) for row in rows]


@router.post("/meals", response_model=MealResponse)
async def create_meal(data: MealCreate):
    """Cria uma refeição. Se tiver descrição e sem calorias manuais, analisa com Claude."""
    calories = data.calories
    protein_g = data.protein_g
    carbs_g = data.carbs_g
    fat_g = data.fat_g
    analyzed_by_ai = False

    # Analisa com IA se não foram fornecidas calorias manualmente
    if calories is None and data.description:
        api_key = os.environ.get("ANTHROPIC_API_KEY", "")
        if api_key:
            try:
                resultado = await analisar_refeicao(
                    description=data.description,
                    image_base64=data.image_base64,
                    api_key=api_key,
                )
                calories = resultado["calories"]
                protein_g = resultado["protein_g"]
                carbs_g = resultado["carbs_g"]
                fat_g = resultado["fat_g"]
                analyzed_by_ai = True
            except Exception as e:
                # Continua sem análise de IA se falhar
                calories = 0.0
                protein_g = 0.0
                carbs_g = 0.0
                fat_g = 0.0
        else:
            calories = 0.0
            protein_g = 0.0
            carbs_g = 0.0
            fat_g = 0.0

    async with await get_db() as db:
        cursor = await db.execute("""
            INSERT INTO meals
                (date, meal_type, description, image_base64, calories,
                 protein_g, carbs_g, fat_g, analyzed_by_ai)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            data.date,
            data.meal_type,
            data.description,
            data.image_base64,
            calories or 0.0,
            protein_g or 0.0,
            carbs_g or 0.0,
            fat_g or 0.0,
            1 if analyzed_by_ai else 0,
        ))
        await db.commit()

        meal_id = cursor.lastrowid
        cursor = await db.execute("SELECT * FROM meals WHERE id = ?", (meal_id,))
        row = await cursor.fetchone()
        return MealResponse(**dict(row))


@router.delete("/meals/{meal_id}")
async def delete_meal(meal_id: int):
    """Remove uma refeição pelo ID."""
    async with await get_db() as db:
        cursor = await db.execute(
            "SELECT id FROM meals WHERE id = ?", (meal_id,)
        )
        existing = await cursor.fetchone()

        if not existing:
            raise HTTPException(status_code=404, detail="Refeição não encontrada")

        await db.execute("DELETE FROM meals WHERE id = ?", (meal_id,))
        await db.commit()

    return {"message": "Refeição removida com sucesso"}

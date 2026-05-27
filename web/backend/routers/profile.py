"""
Rotas de perfil do usuário.
"""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, HTTPException

from database import get_db
from models import UserProfile, UserProfileUpdate

router = APIRouter()


@router.get("/profile", response_model=UserProfile)
async def get_profile():
    """Retorna o perfil do usuário."""
    async with await get_db() as db:
        cursor = await db.execute(
            "SELECT * FROM user_profile ORDER BY id ASC LIMIT 1"
        )
        row = await cursor.fetchone()

        if row is None:
            # Cria perfil padrão se não existir
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

        return UserProfile(**dict(row))


@router.put("/profile", response_model=UserProfile)
async def update_profile(data: UserProfileUpdate):
    """Atualiza ou cria o perfil do usuário."""
    async with await get_db() as db:
        cursor = await db.execute(
            "SELECT id FROM user_profile ORDER BY id ASC LIMIT 1"
        )
        existing = await cursor.fetchone()

        now = datetime.utcnow().isoformat()

        if existing:
            # Atualiza campos fornecidos
            updates = data.model_dump(exclude_none=True)
            if not updates:
                raise HTTPException(status_code=400, detail="Nenhum campo para atualizar")

            updates["updated_at"] = now
            set_clause = ", ".join(f"{k} = ?" for k in updates)
            values = list(updates.values()) + [existing["id"]]

            await db.execute(
                f"UPDATE user_profile SET {set_clause} WHERE id = ?",
                values,
            )
        else:
            # Cria novo perfil
            defaults = UserProfile()
            merged = defaults.model_dump(exclude={"id", "created_at", "updated_at"})
            updates = data.model_dump(exclude_none=True)
            merged.update(updates)
            merged["updated_at"] = now

            await db.execute("""
                INSERT INTO user_profile
                    (name, weight_kg, height_cm, age, sex, goal,
                     target_deficit_kcal, activity_level, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                merged["name"], merged["weight_kg"], merged["height_cm"],
                merged["age"], merged["sex"], merged["goal"],
                merged["target_deficit_kcal"], merged["activity_level"],
                merged["updated_at"],
            ))

        await db.commit()

        cursor = await db.execute(
            "SELECT * FROM user_profile ORDER BY id ASC LIMIT 1"
        )
        row = await cursor.fetchone()
        return UserProfile(**dict(row))

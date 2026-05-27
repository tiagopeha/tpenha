"""
Banco de dados SQLite com aiosqlite.
"""
from __future__ import annotations

import aiosqlite
from pathlib import Path

DB_PATH = Path(__file__).parent / "fitness.db"


async def get_db() -> aiosqlite.Connection:
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    return db


async def init_db() -> None:
    """Cria as tabelas se não existirem."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("""
            CREATE TABLE IF NOT EXISTS user_profile (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL DEFAULT 'Usuário',
                weight_kg REAL NOT NULL DEFAULT 70.0,
                height_cm REAL NOT NULL DEFAULT 170.0,
                age INTEGER NOT NULL DEFAULT 30,
                sex TEXT NOT NULL DEFAULT 'm' CHECK(sex IN ('m', 'f')),
                goal TEXT NOT NULL DEFAULT 'deficit' CHECK(goal IN ('deficit', 'maintain', 'surplus')),
                target_deficit_kcal INTEGER NOT NULL DEFAULT 500,
                activity_level TEXT NOT NULL DEFAULT 'moderate'
                    CHECK(activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS meals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                meal_type TEXT NOT NULL CHECK(meal_type IN ('cafe', 'almoco', 'jantar', 'lanche')),
                description TEXT NOT NULL,
                image_base64 TEXT,
                calories REAL NOT NULL DEFAULT 0.0,
                protein_g REAL NOT NULL DEFAULT 0.0,
                carbs_g REAL NOT NULL DEFAULT 0.0,
                fat_g REAL NOT NULL DEFAULT 0.0,
                analyzed_by_ai BOOLEAN NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await db.commit()

import * as SQLite from 'expo-sqlite'
import type { UserProfile, Meal } from './types'

let db: SQLite.SQLiteDatabase | null = null

export async function getDB(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('fitia.db')
  }
  return db
}

export async function initDB(): Promise<void> {
  const database = await getDB()
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS user_profile (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL DEFAULT 'Usuário',
      weight_kg REAL NOT NULL DEFAULT 70,
      height_cm REAL NOT NULL DEFAULT 170,
      age INTEGER NOT NULL DEFAULT 30,
      sex TEXT NOT NULL DEFAULT 'm',
      goal TEXT NOT NULL DEFAULT 'deficit',
      target_deficit_kcal INTEGER NOT NULL DEFAULT 500,
      activity_level TEXT NOT NULL DEFAULT 'moderate',
      anthropic_api_key TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS meals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      meal_type TEXT NOT NULL,
      description TEXT NOT NULL,
      image_uri TEXT,
      calories REAL NOT NULL DEFAULT 0,
      protein_g REAL NOT NULL DEFAULT 0,
      carbs_g REAL NOT NULL DEFAULT 0,
      fat_g REAL NOT NULL DEFAULT 0,
      analyzed_by_ai INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_meals_date ON meals(date);
  `)
}

// ── Profile ──────────────────────────────────────────────────────────────────

export async function getProfile(): Promise<UserProfile | null> {
  const database = await getDB()
  const row = await database.getFirstAsync<UserProfile>('SELECT * FROM user_profile LIMIT 1')
  return row ?? null
}

export async function upsertProfile(profile: Partial<UserProfile>): Promise<void> {
  const database = await getDB()
  const existing = await getProfile()

  if (existing) {
    const fields = Object.keys(profile)
      .map((k) => `${k} = ?`)
      .join(', ')
    const values = [...Object.values(profile), existing.id]
    await database.runAsync(`UPDATE user_profile SET ${fields} WHERE id = ?`, values)
  } else {
    const defaults: UserProfile = {
      name: 'Usuário',
      weight_kg: 70,
      height_cm: 170,
      age: 30,
      sex: 'm',
      goal: 'deficit',
      target_deficit_kcal: 500,
      activity_level: 'moderate',
      anthropic_api_key: '',
      ...profile,
    }
    await database.runAsync(
      `INSERT INTO user_profile (name, weight_kg, height_cm, age, sex, goal, target_deficit_kcal, activity_level, anthropic_api_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        defaults.name,
        defaults.weight_kg,
        defaults.height_cm,
        defaults.age,
        defaults.sex,
        defaults.goal,
        defaults.target_deficit_kcal,
        defaults.activity_level,
        defaults.anthropic_api_key,
      ]
    )
  }
}

// ── Meals ─────────────────────────────────────────────────────────────────────

export async function getMealsForDate(date: string): Promise<Meal[]> {
  const database = await getDB()
  const rows = await database.getAllAsync<any>(
    'SELECT * FROM meals WHERE date = ? ORDER BY created_at ASC',
    [date]
  )
  return rows.map((r) => ({
    ...r,
    analyzed_by_ai: r.analyzed_by_ai === 1,
  })) as Meal[]
}

export async function insertMeal(meal: Omit<Meal, 'id' | 'created_at'>): Promise<number> {
  const database = await getDB()
  const result = await database.runAsync(
    `INSERT INTO meals (date, meal_type, description, image_uri, calories, protein_g, carbs_g, fat_g, analyzed_by_ai)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      meal.date,
      meal.meal_type,
      meal.description,
      meal.image_uri ?? null,
      meal.calories,
      meal.protein_g,
      meal.carbs_g,
      meal.fat_g,
      meal.analyzed_by_ai ? 1 : 0,
    ]
  )
  return result.lastInsertRowId
}

export async function deleteMeal(id: number): Promise<void> {
  const database = await getDB()
  await database.runAsync('DELETE FROM meals WHERE id = ?', [id])
}

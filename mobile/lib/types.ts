export type Sex = 'm' | 'f'
export type Goal = 'deficit' | 'maintain' | 'surplus'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
export type MealType = 'cafe' | 'almoco' | 'jantar' | 'lanche'

export interface UserProfile {
  id?: number
  name: string
  weight_kg: number
  height_cm: number
  age: number
  sex: Sex
  goal: Goal
  target_deficit_kcal: number
  activity_level: ActivityLevel
  anthropic_api_key: string
}

export interface Meal {
  id?: number
  date: string
  meal_type: MealType
  description: string
  image_uri?: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  analyzed_by_ai: boolean
  created_at?: string
}

export interface ClaudeNutrition {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  notes: string
}

export interface HealthData {
  steps: number | null
  distance_km: number | null
  sleep_hours: number | null
  sleep_quality: string | null
  sleep_phases: { leve: number; profundo: number; rem: number; acordado: number } | null
  hr_avg: number | null
  hr_min: number | null
  hr_max: number | null
  exercises: Exercise[]
  calories_burned: number
}

export interface Exercise {
  type: string
  duration_min: number
  calories: number
  distance_km: number
}

export interface DashboardData {
  profile: UserProfile | null
  meals: Meal[]
  health: HealthData
  bmr: number
  tdee: number
  total_consumed: number
  calories_burned: number
  deficit_today: number
  target_deficit: number
  recommendation: string
  rest_day: boolean
}

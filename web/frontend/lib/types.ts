// TypeScript types matching backend Pydantic models

export interface UserProfile {
  id?: number
  name: string
  weight_kg: number
  height_cm: number
  age: number
  sex: 'm' | 'f'
  goal: 'deficit' | 'maintain' | 'surplus'
  target_deficit_kcal: number
  activity_level: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
  created_at?: string
  updated_at?: string
}

export interface MealCreate {
  date: string
  meal_type: 'cafe' | 'almoco' | 'jantar' | 'lanche'
  description: string
  image_base64?: string
  calories?: number
  protein_g?: number
  carbs_g?: number
  fat_g?: number
}

export interface MealResponse {
  id: number
  date: string
  meal_type: 'cafe' | 'almoco' | 'jantar' | 'lanche'
  description: string
  image_base64?: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  analyzed_by_ai: boolean
  created_at?: string
}

export interface DailyMacros {
  total_calories: number
  total_protein: number
  total_carbs: number
  total_fat: number
  meals: MealResponse[]
}

export interface ExerciseData {
  tipo: string
  duracao_min: number
  calorias: number
  distancia_km: number
}

export interface SleepFases {
  leve?: number
  profundo?: number
  rem?: number
  acordado?: number
}

export interface SamsungHealthData {
  passos?: number
  distancia_km?: number
  calorias_passos?: number
  sono_horas?: number
  sono_qualidade?: string
  sono_fases?: SleepFases
  fc_media?: number
  fc_min?: number
  fc_max?: number
  exercicios?: ExerciseData[]
}

export interface DashboardData {
  date: string
  profile?: UserProfile
  samsung_health?: SamsungHealthData
  daily_macros?: DailyMacros
  tdee?: number
  bmr?: number
  calories_burned_exercise?: number
  deficit_today?: number
  target_deficit?: number
  recommendation?: string
  rest_day: boolean
  cardio_suggestion?: string
}

export interface AuthStatus {
  authenticated: boolean
  message: string
}

import type { UserProfile, HealthData, ActivityLevel } from './types'

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
}

export function calcBMR(p: UserProfile): number {
  // Mifflin-St Jeor
  const base = 10 * p.weight_kg + 6.25 * p.height_cm - 5 * p.age
  return p.sex === 'm' ? base + 5 : base - 161
}

export function calcTDEE(p: UserProfile): number {
  return calcBMR(p) * ACTIVITY_MULTIPLIERS[p.activity_level]
}

export function calcStepCalories(steps: number, weightKg: number): number {
  return steps * (weightKg / 70) * 0.04
}

export function calcDeficit(
  tdee: number,
  exerciseCalories: number,
  stepCalories: number,
  consumed: number
): number {
  return tdee + exerciseCalories + stepCalories - consumed
}

export function getRecommendation(health: HealthData): {
  text: string
  restDay: boolean
} {
  const sleep = health.sleep_hours ?? 7
  const steps = health.steps ?? 0
  const hasExercise = health.exercises.length > 0

  if (sleep < 6) {
    return {
      text: `\u{1F634} Sono insuficiente (${sleep.toFixed(1)}h). Priorize descanso hoje — treino intenso vai prejudicar a recuperação.`,
      restDay: true,
    }
  }

  if (!hasExercise && steps < 5000) {
    return {
      text: `\u{1F6B6} Baixa atividade hoje. Que tal 30 minutos de caminhada ou cardio leve para ativar o metabolismo?`,
      restDay: false,
    }
  }

  if (sleep >= 7.5 && steps >= 8000) {
    return {
      text: `\u{1F4AA} Corpo bem recuperado e ativo! Ótimo dia para um treino de alta intensidade.`,
      restDay: false,
    }
  }

  return {
    text: `\u{2705} Recuperação adequada. Siga seu treino planejado com intensidade moderada.`,
    restDay: false,
  }
}

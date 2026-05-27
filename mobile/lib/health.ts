import {
  initialize,
  requestPermission,
  readRecords,
  getSdkStatus,
  SdkAvailabilityStatus,
} from 'react-native-health-connect'
import type { HealthData, Exercise } from './types'

const EXERCISE_TYPE_MAP: Record<number, string> = {
  2: 'Badminton',
  3: 'Baseball',
  4: 'Ciclismo',
  35: 'Corrida',
  56: 'Musculação',
  64: 'Futebol',
  74: 'Natação',
  76: 'Squash',
  79: 'Tênis',
  80: 'Caminhada',
  82: 'Yoga',
}

export async function isHealthConnectAvailable(): Promise<boolean> {
  try {
    const status = await getSdkStatus()
    return status === SdkAvailabilityStatus.SDK_AVAILABLE
  } catch {
    return false
  }
}

export async function requestHealthPermissions(): Promise<boolean> {
  try {
    await initialize()
    const granted = await requestPermission([
      { accessType: 'read', recordType: 'Steps' },
      { accessType: 'read', recordType: 'SleepSession' },
      { accessType: 'read', recordType: 'HeartRate' },
      { accessType: 'read', recordType: 'ExerciseSession' },
      { accessType: 'read', recordType: 'Distance' },
    ])
    return granted.length > 0
  } catch {
    return false
  }
}

export async function fetchHealthData(date: Date): Promise<HealthData> {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const end = new Date(date)
  end.setHours(23, 59, 59, 999)

  const timeRange = {
    operator: 'between' as const,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
  }

  const result: HealthData = {
    steps: null,
    distance_km: null,
    sleep_hours: null,
    sleep_quality: null,
    sleep_phases: null,
    hr_avg: null,
    hr_min: null,
    hr_max: null,
    exercises: [],
    calories_burned: 0,
  }

  try {
    await initialize()

    // Steps
    const { records: stepRecords } = await readRecords('Steps', { timeRangeFilter: timeRange })
    if (stepRecords.length > 0) {
      result.steps = stepRecords.reduce((sum, r) => sum + (r as any).count, 0)
    }

    // Distance
    const { records: distRecords } = await readRecords('Distance', { timeRangeFilter: timeRange })
    if (distRecords.length > 0) {
      const totalMeters = distRecords.reduce(
        (sum, r) => sum + ((r as any).distance?.inMeters ?? 0),
        0
      )
      result.distance_km = Math.round(totalMeters / 100) / 10
    }

    // Sleep (previous night: yesterday 18:00 to today 12:00)
    const sleepStart = new Date(date)
    sleepStart.setDate(sleepStart.getDate() - 1)
    sleepStart.setHours(18, 0, 0, 0)
    const sleepEnd = new Date(date)
    sleepEnd.setHours(12, 0, 0, 0)

    const { records: sleepRecords } = await readRecords('SleepSession', {
      timeRangeFilter: {
        operator: 'between',
        startTime: sleepStart.toISOString(),
        endTime: sleepEnd.toISOString(),
      },
    })

    if (sleepRecords.length > 0) {
      const latest = sleepRecords[sleepRecords.length - 1] as any
      const durationMs =
        new Date(latest.endTime).getTime() - new Date(latest.startTime).getTime()
      result.sleep_hours = Math.round(durationMs / 360000) / 10

      // Parse sleep stages if available
      if (latest.stages && latest.stages.length > 0) {
        const phases = { leve: 0, profundo: 0, rem: 0, acordado: 0 }
        for (const stage of latest.stages) {
          const mins =
            (new Date(stage.endTime).getTime() - new Date(stage.startTime).getTime()) / 60000
          if (stage.stage === 4) phases.rem += mins
          else if (stage.stage === 5) phases.profundo += mins
          else if (stage.stage === 3) phases.leve += mins
          else if (stage.stage === 1) phases.acordado += mins
        }
        result.sleep_phases = {
          leve: Math.round(phases.leve),
          profundo: Math.round(phases.profundo),
          rem: Math.round(phases.rem),
          acordado: Math.round(phases.acordado),
        }
      }

      // Estimate sleep quality
      const h = result.sleep_hours
      result.sleep_quality = h >= 8 ? 'boa' : h >= 6 ? 'regular' : 'ruim'
    }

    // Heart rate
    const { records: hrRecords } = await readRecords('HeartRate', { timeRangeFilter: timeRange })
    const allBpm = (hrRecords as any[]).flatMap((r) =>
      (r.samples ?? []).map((s: any) => s.beatsPerMinute)
    )
    if (allBpm.length > 0) {
      result.hr_avg = Math.round(allBpm.reduce((a, b) => a + b, 0) / allBpm.length)
      result.hr_min = Math.min(...allBpm)
      result.hr_max = Math.max(...allBpm)
    }

    // Exercise sessions
    const { records: exerciseRecords } = await readRecords('ExerciseSession', {
      timeRangeFilter: timeRange,
    })
    let totalCalories = 0
    for (const ex of exerciseRecords as any[]) {
      const durationMs = new Date(ex.endTime).getTime() - new Date(ex.startTime).getTime()
      const durationMin = Math.round(durationMs / 60000)
      const typeName =
        EXERCISE_TYPE_MAP[ex.exerciseType] ?? `Exercício (${ex.exerciseType})`
      const calories =
        ex.energy?.inKilocalories ?? estimateCalories(durationMin, ex.exerciseType)

      const exercise: Exercise = {
        type: typeName,
        duration_min: durationMin,
        calories: Math.round(calories),
        distance_km: 0,
      }
      result.exercises.push(exercise)
      totalCalories += calories
    }
    result.calories_burned = Math.round(totalCalories)
  } catch (err) {
    console.warn('Health Connect read error:', err)
  }

  return result
}

function estimateCalories(durationMin: number, exerciseType: number): number {
  // MET-based rough estimate (assuming ~70kg)
  const metMap: Record<number, number> = {
    35: 9.8, // Running
    80: 3.5, // Walking
    4: 7.5, // Cycling
    74: 7.0, // Swimming
    56: 5.0, // Weight training
    82: 3.0, // Yoga
  }
  const met = metMap[exerciseType] ?? 5
  return (met * 70 * durationMin) / 60
}

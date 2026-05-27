import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
} from 'react-native'
import { format, subDays, isToday, isSameDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { colors, spacing, radius } from '@/constants/theme'
import { RecommendationCard } from '@/components/RecommendationCard'
import {
  fetchHealthData,
  requestHealthPermissions,
  isHealthConnectAvailable,
} from '@/lib/health'
import { getRecommendation } from '@/lib/calculator'
import { getProfile } from '@/lib/database'
import type { HealthData, Exercise } from '@/lib/types'

const EMPTY_HEALTH: HealthData = {
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

function getHrZone(bpm: number | null): { label: string; color: string } {
  if (!bpm) return { label: '—', color: colors.muted }
  if (bpm < 60) return { label: 'Repouso', color: colors.blue }
  if (bpm < 100) return { label: 'Leve', color: colors.success }
  if (bpm < 140) return { label: 'Moderado', color: colors.warning }
  if (bpm < 170) return { label: 'Intenso', color: colors.orange }
  return { label: 'Máximo', color: colors.danger }
}

function getSleepColor(hours: number | null): string {
  if (!hours) return colors.muted
  if (hours >= 7.5) return colors.success
  if (hours >= 6) return colors.warning
  return colors.danger
}

export default function TreinosScreen() {
  const [date, setDate] = useState(new Date())
  const [health, setHealth] = useState<HealthData>(EMPTY_HEALTH)
  const [weekData, setWeekData] = useState<Array<{ date: Date; hasExercise: boolean }>>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [healthAvailable, setHealthAvailable] = useState(true)

  const load = useCallback(async () => {
    try {
      const available = await isHealthConnectAvailable()
      setHealthAvailable(available)

      if (available) {
        await requestHealthPermissions()
        const h = await fetchHealthData(date)
        setHealth(h)

        // Load last 7 days for activity strip
        const week: Array<{ date: Date; hasExercise: boolean }> = []
        for (let i = 6; i >= 0; i--) {
          const d = subDays(new Date(), i)
          const dayData = await fetchHealthData(d)
          week.push({ date: d, hasExercise: dayData.exercises.length > 0 })
        }
        setWeekData(week)
      }
    } catch (err) {
      console.error('Treinos load error:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [date]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  const onRefresh = () => {
    setRefreshing(true)
    load()
  }

  const rec = getRecommendation(health)
  const hrZone = getHrZone(health.hr_avg)
  const sleepColor = getSleepColor(health.sleep_hours)

  const totalDurationMin = health.exercises.reduce((s, e) => s + e.duration_min, 0)
  const stepCal =
    health.steps && health.steps > 0
      ? Math.round(health.steps * 0.04)
      : 0

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Title */}
        <View style={styles.titleRow}>
          <Text style={styles.title}>Atividade Física</Text>
          <Text style={styles.subtitle}>
            {isToday(date)
              ? 'Hoje'
              : format(date, "d MMM", { locale: ptBR })}
          </Text>
        </View>

        {!healthAvailable ? (
          <View style={styles.unavailableCard}>
            <Text style={styles.unavailableIcon}>📱</Text>
            <Text style={styles.unavailableTitle}>Health Connect não disponível</Text>
            <Text style={styles.unavailableText}>
              O Health Connect não está instalado ou não está disponível neste dispositivo.
              Instale o Health Connect pela Play Store e conecte o Samsung Health para
              visualizar seus dados de atividade.
            </Text>
            <Text style={styles.unavailableHint}>
              Samsung Health → Configurações → Conectar com outros apps → Health Connect
            </Text>
          </View>
        ) : (
          <>
            {/* 7-day activity strip */}
            {weekData.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Últimos 7 dias</Text>
                <View style={styles.weekStrip}>
                  {weekData.map((day, idx) => {
                    const isSelected = isSameDay(day.date, date)
                    const dayName = format(day.date, 'EEE', { locale: ptBR })
                      .substring(0, 3)
                    const dayNum = format(day.date, 'd')
                    return (
                      <TouchableOpacity
                        key={idx}
                        style={styles.weekDay}
                        onPress={() => setDate(day.date)}
                      >
                        <Text style={styles.weekDayName}>{dayName}</Text>
                        <View
                          style={[
                            styles.weekDayDot,
                            {
                              backgroundColor: day.hasExercise
                                ? colors.success
                                : colors.border,
                              borderColor: isSelected ? colors.primary : 'transparent',
                              borderWidth: isSelected ? 2 : 0,
                            },
                          ]}
                        >
                          <Text style={[styles.weekDayNum, { color: isSelected ? colors.primary : colors.text }]}>
                            {dayNum}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </View>
            )}

            {/* Recommendation */}
            <RecommendationCard text={rec.text} restDay={rec.restDay} />

            {/* Stats row */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statIcon}>🦶</Text>
                <Text style={styles.statValue}>
                  {health.steps?.toLocaleString('pt-BR') ?? '—'}
                </Text>
                <Text style={styles.statLabel}>Passos</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statIcon}>🔥</Text>
                <Text style={styles.statValue}>
                  {health.calories_burned + stepCal > 0
                    ? health.calories_burned + stepCal
                    : '—'}
                </Text>
                <Text style={styles.statLabel}>kcal queimadas</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statIcon}>🏃</Text>
                <Text style={styles.statValue}>{health.exercises.length}</Text>
                <Text style={styles.statLabel}>exercícios</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statIcon}>⏱️</Text>
                <Text style={styles.statValue}>
                  {totalDurationMin > 0 ? `${totalDurationMin}m` : '—'}
                </Text>
                <Text style={styles.statLabel}>tempo total</Text>
              </View>
            </View>

            {/* Exercise sessions */}
            {health.exercises.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Sessões de treino</Text>
                <View style={{ gap: 10 }}>
                  {health.exercises.map((ex, idx) => (
                    <ExerciseCard key={idx} exercise={ex} />
                  ))}
                </View>
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>🏋️</Text>
                <Text style={styles.emptyTitle}>Nenhum treino registrado</Text>
                <Text style={styles.emptyText}>
                  Seus treinos do Samsung Health aparecerão aqui automaticamente após
                  sincronização com o Health Connect.
                </Text>
              </View>
            )}

            {/* Sleep card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Sono</Text>
              {health.sleep_hours !== null ? (
                <View style={{ gap: 12 }}>
                  {/* Sleep duration bar */}
                  <View style={styles.sleepDurationRow}>
                    <View style={{ flex: 1, gap: 6 }}>
                      <View style={styles.sleepLabelRow}>
                        <Text style={styles.sleepHours}>
                          {health.sleep_hours?.toFixed(1)}h
                        </Text>
                        <Text
                          style={[styles.sleepQuality, { color: sleepColor }]}
                        >
                          {health.sleep_quality === 'boa'
                            ? 'Sono bom'
                            : health.sleep_quality === 'regular'
                            ? 'Sono regular'
                            : 'Sono insuficiente'}
                        </Text>
                      </View>
                      <View style={styles.sleepTrack}>
                        <View
                          style={[
                            styles.sleepFill,
                            {
                              width: `${Math.min(((health.sleep_hours ?? 0) / 9) * 100, 100)}%`,
                              backgroundColor: sleepColor,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.sleepTarget}>Meta: 8h</Text>
                    </View>
                  </View>

                  {/* Sleep phases */}
                  {health.sleep_phases && (
                    <View style={{ gap: 8 }}>
                      <Text style={styles.phasesTitle}>Fases do sono</Text>
                      <View style={styles.phasesRow}>
                        <PhaseChip
                          label="Leve"
                          minutes={health.sleep_phases.leve}
                          color={colors.blue}
                        />
                        <PhaseChip
                          label="Profundo"
                          minutes={health.sleep_phases.profundo}
                          color={colors.primary}
                        />
                        <PhaseChip
                          label="REM"
                          minutes={health.sleep_phases.rem}
                          color={colors.success}
                        />
                        <PhaseChip
                          label="Acordado"
                          minutes={health.sleep_phases.acordado}
                          color={colors.muted}
                        />
                      </View>
                    </View>
                  )}
                </View>
              ) : (
                <Text style={styles.noDataText}>
                  Dados de sono não disponíveis para este dia
                </Text>
              )}
            </View>

            {/* Heart rate card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Frequência Cardíaca</Text>
              {health.hr_avg !== null ? (
                <View style={{ gap: 12 }}>
                  <View style={styles.hrMain}>
                    <View>
                      <Text style={styles.hrAvg}>{health.hr_avg}</Text>
                      <Text style={styles.hrAvgLabel}>bpm médio</Text>
                    </View>
                    <View style={[styles.hrZoneBadge, { backgroundColor: hrZone.color + '20', borderColor: hrZone.color + '60' }]}>
                      <Text style={[styles.hrZoneText, { color: hrZone.color }]}>
                        Zona: {hrZone.label}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.hrRange}>
                    <View style={styles.hrRangeItem}>
                      <Text style={[styles.hrRangeValue, { color: colors.blue }]}>
                        {health.hr_min}
                      </Text>
                      <Text style={styles.hrRangeLabel}>mínimo</Text>
                    </View>
                    <View style={styles.hrRangeDivider} />
                    <View style={styles.hrRangeItem}>
                      <Text style={[styles.hrRangeValue, { color: colors.danger }]}>
                        {health.hr_max}
                      </Text>
                      <Text style={styles.hrRangeLabel}>máximo</Text>
                    </View>
                  </View>
                </View>
              ) : (
                <Text style={styles.noDataText}>
                  Dados de frequência cardíaca não disponíveis
                </Text>
              )}
            </View>
          </>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

function ExerciseCard({ exercise }: { exercise: Exercise }) {
  const EXERCISE_EMOJIS: Record<string, string> = {
    Corrida: '🏃',
    Caminhada: '🚶',
    Ciclismo: '🚴',
    Musculação: '🏋️',
    Natação: '🏊',
    Yoga: '🧘',
    Futebol: '⚽',
    Tênis: '🎾',
    Badminton: '🏸',
    Squash: '🎾',
  }
  const emoji = EXERCISE_EMOJIS[exercise.type] ?? '🏃'

  return (
    <View style={exStyles.card}>
      <Text style={exStyles.emoji}>{emoji}</Text>
      <View style={exStyles.info}>
        <Text style={exStyles.type}>{exercise.type}</Text>
        <View style={exStyles.details}>
          <Text style={exStyles.detail}>⏱ {exercise.duration_min} min</Text>
          {exercise.calories > 0 && (
            <Text style={exStyles.detail}>🔥 {exercise.calories} kcal</Text>
          )}
          {exercise.distance_km > 0 && (
            <Text style={exStyles.detail}>📍 {exercise.distance_km} km</Text>
          )}
        </View>
      </View>
    </View>
  )
}

const exStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emoji: { fontSize: 28 },
  info: { flex: 1, gap: 4 },
  type: { color: colors.text, fontSize: 15, fontWeight: '600' },
  details: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  detail: { color: colors.muted, fontSize: 13 },
})

function PhaseChip({
  label,
  minutes,
  color,
}: {
  label: string
  minutes: number
  color: string
}) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const timeStr = h > 0 ? `${h}h${m > 0 ? m + 'm' : ''}` : `${m}m`

  return (
    <View style={[phaseStyles.chip, { borderColor: color + '40' }]}>
      <Text style={[phaseStyles.value, { color }]}>{timeStr}</Text>
      <Text style={phaseStyles.label}>{label}</Text>
    </View>
  )
}

const phaseStyles = StyleSheet.create({
  chip: {
    flex: 1,
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: colors.bg,
  },
  value: { fontSize: 14, fontWeight: '700' },
  label: { color: colors.muted, fontSize: 11, marginTop: 2 },
})

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: spacing.md, gap: spacing.md },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  title: { color: colors.text, fontSize: 22, fontWeight: '700' },
  subtitle: { color: colors.muted, fontSize: 14 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 14,
  },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  weekStrip: { flexDirection: 'row', justifyContent: 'space-between' },
  weekDay: { alignItems: 'center', gap: 6 },
  weekDayName: { color: colors.muted, fontSize: 10, textTransform: 'uppercase' },
  weekDayDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDayNum: { fontSize: 13, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 8 },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    alignItems: 'center',
    gap: 2,
  },
  statIcon: { fontSize: 18 },
  statValue: { color: colors.text, fontSize: 15, fontWeight: '700' },
  statLabel: { color: colors.muted, fontSize: 10, textAlign: 'center' },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  sleepDurationRow: { flexDirection: 'row', gap: 16 },
  sleepLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sleepHours: { color: colors.text, fontSize: 24, fontWeight: '700' },
  sleepQuality: { fontSize: 13, fontWeight: '600' },
  sleepTrack: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  sleepFill: { height: '100%', borderRadius: 4 },
  sleepTarget: { color: colors.muted, fontSize: 11 },
  phasesTitle: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  phasesRow: { flexDirection: 'row', gap: 8 },
  hrMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hrAvg: { color: colors.text, fontSize: 36, fontWeight: '700' },
  hrAvgLabel: { color: colors.muted, fontSize: 12 },
  hrZoneBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  hrZoneText: { fontSize: 13, fontWeight: '600' },
  hrRange: { flexDirection: 'row', alignItems: 'center', gap: 24 },
  hrRangeItem: { alignItems: 'center', gap: 2 },
  hrRangeValue: { fontSize: 20, fontWeight: '700' },
  hrRangeLabel: { color: colors.muted, fontSize: 12 },
  hrRangeDivider: { flex: 1, height: 1, backgroundColor: colors.border },
  noDataText: { color: colors.muted, fontSize: 14, textAlign: 'center', paddingVertical: 8 },
  unavailableCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
    gap: 12,
  },
  unavailableIcon: { fontSize: 48 },
  unavailableTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  unavailableText: {
    color: colors.muted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  unavailableHint: {
    color: colors.primary,
    fontSize: 13,
    textAlign: 'center',
    fontStyle: 'italic',
  },
})

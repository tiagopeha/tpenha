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
import { format, addDays, subDays, isToday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { colors, spacing, radius } from '@/constants/theme'
import { DeficitGauge } from '@/components/DeficitGauge'
import { MacrosBar } from '@/components/MacrosBar'
import { SamsungCard } from '@/components/SamsungCard'
import { RecommendationCard } from '@/components/RecommendationCard'
import { MealCard } from '@/components/MealCard'
import { MealForm } from '@/components/MealForm'
import { getProfile, getMealsForDate, insertMeal, deleteMeal } from '@/lib/database'
import {
  fetchHealthData,
  requestHealthPermissions,
  isHealthConnectAvailable,
} from '@/lib/health'
import {
  calcBMR,
  calcTDEE,
  calcDeficit,
  calcStepCalories,
  getRecommendation,
} from '@/lib/calculator'
import type { UserProfile, Meal, HealthData } from '@/lib/types'

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

export default function DashboardScreen() {
  const [date, setDate] = useState(new Date())
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [meals, setMeals] = useState<Meal[]>([])
  const [health, setHealth] = useState<HealthData>(EMPTY_HEALTH)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showMealForm, setShowMealForm] = useState(false)

  const dateStr = format(date, 'yyyy-MM-dd')

  const load = useCallback(async () => {
    try {
      const [p, m] = await Promise.all([getProfile(), getMealsForDate(dateStr)])
      setProfile(p)
      setMeals(m)

      const available = await isHealthConnectAvailable()
      if (available) {
        await requestHealthPermissions()
        const h = await fetchHealthData(date)
        setHealth(h)
      }
    } catch (err) {
      console.error('Dashboard load error:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [dateStr]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  const onRefresh = () => {
    setRefreshing(true)
    load()
  }

  const handleSaveMeal = async (meal: Omit<Meal, 'id' | 'created_at'>) => {
    await insertMeal(meal)
    const updated = await getMealsForDate(dateStr)
    setMeals(updated)
  }

  const handleDeleteMeal = async (id: number) => {
    await deleteMeal(id)
    const updated = await getMealsForDate(dateStr)
    setMeals(updated)
  }

  // Calculations
  const bmr = profile ? calcBMR(profile) : 1800
  const tdee = profile ? calcTDEE(profile) : 2200
  const stepCal = health.steps ? calcStepCalories(health.steps, profile?.weight_kg ?? 70) : 0
  const consumed = meals.reduce((s, m) => s + m.calories, 0)
  const deficit = calcDeficit(tdee, health.calories_burned, stepCal, consumed)
  const rec = getRecommendation(health)

  const proteinTarget = (profile?.weight_kg ?? 70) * 2.2
  const carbsTarget = (tdee * 0.45) / 4
  const fatTarget = (tdee * 0.3) / 9

  const totalProtein = meals.reduce((s, m) => s + m.protein_g, 0)
  const totalCarbs = meals.reduce((s, m) => s + m.carbs_g, 0)
  const totalFat = meals.reduce((s, m) => s + m.fat_g, 0)

  const dateLabel = isToday(date)
    ? 'Hoje'
    : format(date, "d 'de' MMM", { locale: ptBR })

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
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>Olá, {profile?.name ?? 'Usuário'}! 👋</Text>
            <Text style={styles.subtitle}>Aqui está seu balanço calórico</Text>
          </View>
          {/* Date nav */}
          <View style={styles.dateNav}>
            <TouchableOpacity
              onPress={() => setDate(subDays(date, 1))}
              style={styles.navBtn}
            >
              <Text style={styles.navArrow}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.dateLabel}>{dateLabel}</Text>
            <TouchableOpacity
              onPress={() => setDate(addDays(date, 1))}
              style={styles.navBtn}
              disabled={isToday(date)}
            >
              <Text style={[styles.navArrow, isToday(date) && { opacity: 0.3 }]}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Deficit gauge */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Balanço Calórico</Text>
          <DeficitGauge
            consumed={consumed}
            tdee={tdee}
            caloriesBurned={health.calories_burned + stepCal}
            targetDeficit={profile?.target_deficit_kcal ?? 500}
          />
          {/* BMR / TDEE info row */}
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={styles.infoValue}>{Math.round(bmr)}</Text>
              <Text style={styles.infoLabel}>BMR (kcal)</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoItem}>
              <Text style={styles.infoValue}>{Math.round(tdee)}</Text>
              <Text style={styles.infoLabel}>TDEE (kcal)</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoItem}>
              <Text
                style={[
                  styles.infoValue,
                  {
                    color:
                      deficit >= (profile?.target_deficit_kcal ?? 500) * 0.8
                        ? colors.success
                        : deficit >= 0
                        ? colors.warning
                        : colors.danger,
                  },
                ]}
              >
                {Math.round(deficit)}
              </Text>
              <Text style={styles.infoLabel}>Déficit atual</Text>
            </View>
          </View>
        </View>

        {/* Macros */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Macronutrientes</Text>
          <View style={{ gap: 14 }}>
            <MacrosBar
              label="Proteína"
              value={totalProtein}
              target={proteinTarget}
              color={colors.orange}
            />
            <MacrosBar
              label="Carboidratos"
              value={totalCarbs}
              target={carbsTarget}
              color={colors.blue}
            />
            <MacrosBar
              label="Gorduras"
              value={totalFat}
              target={fatTarget}
              color={colors.yellow}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total consumido</Text>
            <Text style={styles.totalValue}>
              {Math.round(consumed)} / {Math.round(tdee)} kcal
            </Text>
          </View>
        </View>

        {/* Samsung Health */}
        <Text style={styles.sectionTitle}>Samsung Health</Text>
        <View style={styles.cardRow}>
          <SamsungCard
            icon="🦶"
            label="Passos"
            value={health.steps?.toLocaleString('pt-BR')}
            subtitle={health.distance_km ? `${health.distance_km} km` : undefined}
            progress={health.steps ? (health.steps / 10000) * 100 : 0}
            unavailable={health.steps === null}
          />
          <SamsungCard
            icon="😴"
            label="Sono"
            value={health.sleep_hours?.toFixed(1)}
            unit="h"
            subtitle={health.sleep_quality ?? undefined}
            unavailable={health.sleep_hours === null}
          />
        </View>
        <View style={styles.cardRow}>
          <SamsungCard
            icon="❤️"
            label="Freq. Cardíaca"
            value={health.hr_avg}
            unit="bpm"
            subtitle={
              health.hr_min && health.hr_max
                ? `${health.hr_min}-${health.hr_max} bpm`
                : undefined
            }
            unavailable={health.hr_avg === null}
          />
          <SamsungCard
            icon="🏋️"
            label="Último treino"
            value={health.exercises[0]?.type}
            subtitle={
              health.exercises[0]
                ? `${health.exercises[0].duration_min}min · ${health.exercises[0].calories}kcal`
                : undefined
            }
            unavailable={health.exercises.length === 0}
          />
        </View>

        {/* Recommendation */}
        <RecommendationCard text={rec.text} restDay={rec.restDay} />

        {/* Meals */}
        <View style={styles.mealsHeader}>
          <Text style={styles.sectionTitle}>Refeições ({meals.length})</Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setShowMealForm(true)}
          >
            <Text style={styles.addBtnText}>+ Adicionar</Text>
          </TouchableOpacity>
        </View>

        {meals.length === 0 ? (
          <TouchableOpacity
            style={styles.emptyMeals}
            onPress={() => setShowMealForm(true)}
          >
            <Text style={styles.emptyText}>
              Nenhuma refeição registrada. Toque para adicionar.
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={{ gap: 8 }}>
            {meals.slice(0, 5).map((m) => (
              <MealCard key={m.id} meal={m} onDelete={handleDeleteMeal} />
            ))}
            {meals.length > 5 && (
              <Text style={styles.moreText}>
                + {meals.length - 5} refeição(ões) — veja em Refeições
              </Text>
            )}
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      <MealForm
        date={dateStr}
        visible={showMealForm}
        onClose={() => setShowMealForm(false)}
        onSave={handleSaveMeal}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: spacing.md, gap: spacing.md },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greeting: { color: colors.text, fontSize: 20, fontWeight: '700' },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: 2 },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  navBtn: { paddingHorizontal: 8 },
  navArrow: { color: colors.text, fontSize: 20, lineHeight: 22 },
  dateLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    minWidth: 60,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 16,
  },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  cardRow: { flexDirection: 'row', gap: 10 },
  divider: { height: 1, backgroundColor: colors.border },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { color: colors.muted, fontSize: 13 },
  totalValue: { color: colors.text, fontSize: 13, fontWeight: '600' },
  mealsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.md,
  },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  emptyMeals: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: { color: colors.muted, fontSize: 14 },
  moreText: { color: colors.muted, fontSize: 13, textAlign: 'center', paddingVertical: 4 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  infoItem: { alignItems: 'center', gap: 2 },
  infoValue: { color: colors.text, fontSize: 16, fontWeight: '700' },
  infoLabel: { color: colors.muted, fontSize: 11 },
  infoDivider: { width: 1, backgroundColor: colors.border },
})

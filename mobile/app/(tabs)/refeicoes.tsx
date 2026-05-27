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
import { MealCard } from '@/components/MealCard'
import { MealForm } from '@/components/MealForm'
import { getProfile, getMealsForDate, insertMeal, deleteMeal } from '@/lib/database'
import type { Meal, MealType, UserProfile } from '@/lib/types'

const MEAL_ORDER: MealType[] = ['cafe', 'lanche', 'almoco', 'jantar']

const MEAL_LABELS: Record<MealType, string> = {
  cafe: 'Café da Manhã',
  lanche: 'Lanche',
  almoco: 'Almoço',
  jantar: 'Jantar',
}

const MEAL_EMOJIS: Record<MealType, string> = {
  cafe: '☕',
  almoco: '\u{1F37D}️',
  jantar: '\u{1F319}',
  lanche: '\u{1F34E}',
}

export default function RefeicoesScreen() {
  const [date, setDate] = useState(new Date())
  const [meals, setMeals] = useState<Meal[]>([])
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showMealForm, setShowMealForm] = useState(false)
  const [defaultMealType, setDefaultMealType] = useState<MealType>('almoco')

  const dateStr = format(date, 'yyyy-MM-dd')

  const load = useCallback(async () => {
    try {
      const [p, m] = await Promise.all([getProfile(), getMealsForDate(dateStr)])
      setProfile(p)
      setMeals(m)
    } catch (err) {
      console.error('Refeicoes load error:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [dateStr])

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

  const openFormForType = (type: MealType) => {
    setDefaultMealType(type)
    setShowMealForm(true)
  }

  // Group meals by type
  const mealsByType = MEAL_ORDER.reduce<Record<MealType, Meal[]>>(
    (acc, type) => {
      acc[type] = meals.filter((m) => m.meal_type === type)
      return acc
    },
    { cafe: [], lanche: [], almoco: [], jantar: [] }
  )

  // Daily totals
  const totalCalories = meals.reduce((s, m) => s + m.calories, 0)
  const totalProtein = meals.reduce((s, m) => s + m.protein_g, 0)
  const totalCarbs = meals.reduce((s, m) => s + m.carbs_g, 0)
  const totalFat = meals.reduce((s, m) => s + m.fat_g, 0)

  const dateLabel = isToday(date)
    ? 'Hoje'
    : format(date, "EEEE, d 'de' MMMM", { locale: ptBR })

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Fixed header with date nav */}
      <View style={styles.topBar}>
        <View style={styles.dateNav}>
          <TouchableOpacity onPress={() => setDate(subDays(date, 1))} style={styles.navBtn}>
            <Text style={styles.navArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.dateLabel} numberOfLines={1}>
            {dateLabel}
          </Text>
          <TouchableOpacity
            onPress={() => setDate(addDays(date, 1))}
            style={styles.navBtn}
            disabled={isToday(date)}
          >
            <Text style={[styles.navArrow, isToday(date) && { opacity: 0.3 }]}>›</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowMealForm(true)}>
          <Text style={styles.addBtnText}>+ Nova</Text>
        </TouchableOpacity>
      </View>

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
        {/* Daily totals card */}
        {meals.length > 0 && (
          <View style={styles.totalsCard}>
            <Text style={styles.totalsTitle}>Totais do dia</Text>
            <View style={styles.totalsRow}>
              <TotalChip label="Calorias" value={`${Math.round(totalCalories)} kcal`} color={colors.primary} />
              <TotalChip label="Proteína" value={`${Math.round(totalProtein)}g`} color={colors.orange} />
              <TotalChip label="Carbs" value={`${Math.round(totalCarbs)}g`} color={colors.blue} />
              <TotalChip label="Gordura" value={`${Math.round(totalFat)}g`} color={colors.yellow} />
            </View>
          </View>
        )}

        {/* Meal groups */}
        {MEAL_ORDER.map((type) => {
          const typeMeals = mealsByType[type]
          const typeCalories = typeMeals.reduce((s, m) => s + m.calories, 0)

          return (
            <View key={type} style={styles.mealGroup}>
              <View style={styles.mealGroupHeader}>
                <View style={styles.mealGroupLeft}>
                  <Text style={styles.mealGroupEmoji}>{MEAL_EMOJIS[type]}</Text>
                  <Text style={styles.mealGroupLabel}>{MEAL_LABELS[type]}</Text>
                  {typeMeals.length > 0 && (
                    <Text style={styles.mealGroupCalories}>
                      {Math.round(typeCalories)} kcal
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.addTypeBtn}
                  onPress={() => openFormForType(type)}
                >
                  <Text style={styles.addTypeBtnText}>+</Text>
                </TouchableOpacity>
              </View>

              {typeMeals.length > 0 ? (
                <View style={{ gap: 8 }}>
                  {typeMeals.map((m) => (
                    <MealCard key={m.id} meal={m} onDelete={handleDeleteMeal} />
                  ))}
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.emptyGroup}
                  onPress={() => openFormForType(type)}
                >
                  <Text style={styles.emptyGroupText}>
                    Toque para adicionar {MEAL_LABELS[type].toLowerCase()}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )
        })}

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

function TotalChip({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color: string
}) {
  return (
    <View style={chipStyles.chip}>
      <Text style={[chipStyles.value, { color }]}>{value}</Text>
      <Text style={chipStyles.label}>{label}</Text>
    </View>
  )
}

const chipStyles = StyleSheet.create({
  chip: { flex: 1, alignItems: 'center' },
  value: { fontSize: 14, fontWeight: '700' },
  label: { color: colors.muted, fontSize: 11, marginTop: 2 },
})

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { justifyContent: 'center', alignItems: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    paddingBottom: spacing.sm,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dateNav: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  navBtn: { paddingHorizontal: 6 },
  navArrow: { color: colors.text, fontSize: 22, lineHeight: 24 },
  dateLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  addBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  addBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  scroll: { padding: spacing.md, gap: spacing.md },
  totalsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 12,
  },
  totalsTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
  totalsRow: { flexDirection: 'row', gap: 8 },
  mealGroup: { gap: 10 },
  mealGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mealGroupLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mealGroupEmoji: { fontSize: 18 },
  mealGroupLabel: { color: colors.text, fontSize: 14, fontWeight: '600' },
  mealGroupCalories: {
    color: colors.muted,
    fontSize: 12,
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addTypeBtn: {
    width: 28,
    height: 28,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTypeBtnText: { color: colors.primary, fontSize: 18, lineHeight: 22 },
  emptyGroup: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    alignItems: 'center',
  },
  emptyGroupText: { color: colors.muted, fontSize: 13 },
})

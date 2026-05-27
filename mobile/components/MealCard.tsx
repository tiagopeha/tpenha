import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { colors, radius } from '@/constants/theme'
import type { Meal, MealType } from '@/lib/types'

const MEAL_EMOJIS: Record<MealType, string> = {
  cafe: '☕',
  almoco: '\u{1F37D}️',
  jantar: '\u{1F319}',
  lanche: '\u{1F34E}',
}

interface Props {
  meal: Meal
  onDelete: (id: number) => void
}

export function MealCard({ meal, onDelete }: Props) {
  const handleDelete = () => {
    Alert.alert('Remover refeição', meal.description, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: () => onDelete(meal.id!),
      },
    ])
  }

  return (
    <View style={styles.card}>
      <Text style={styles.emoji}>{MEAL_EMOJIS[meal.meal_type as MealType]}</Text>
      <View style={styles.info}>
        <Text style={styles.description} numberOfLines={2}>
          {meal.description}
        </Text>
        <View style={styles.macros}>
          <Text style={styles.calories}>{Math.round(meal.calories)} kcal</Text>
          <Text style={styles.macro}>P {Math.round(meal.protein_g)}g</Text>
          <Text style={styles.macro}>C {Math.round(meal.carbs_g)}g</Text>
          <Text style={styles.macro}>G {Math.round(meal.fat_g)}g</Text>
          {meal.analyzed_by_ai && <Text style={styles.aiTag}>IA</Text>}
        </View>
      </View>
      <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn} hitSlop={8}>
        <Text style={styles.deleteIcon}>✕</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 10,
  },
  emoji: { fontSize: 28, width: 36, textAlign: 'center' },
  info: { flex: 1, gap: 4 },
  description: { color: colors.text, fontSize: 14, fontWeight: '500' },
  macros: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  calories: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  macro: { color: colors.muted, fontSize: 12 },
  aiTag: {
    backgroundColor: colors.primaryDim,
    color: colors.primary,
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  deleteBtn: { padding: 4 },
  deleteIcon: { color: colors.muted, fontSize: 16 },
})

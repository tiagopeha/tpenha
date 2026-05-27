import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { colors, radius } from '@/constants/theme'

interface Props {
  text: string
  restDay: boolean
}

export function RecommendationCard({ text, restDay }: Props) {
  const bgColor = restDay ? '#1c1917' : '#0f1f0f'
  const borderColor = restDay ? '#78716c' : colors.success

  return (
    <View style={[styles.card, { backgroundColor: bgColor, borderColor }]}>
      <Text style={styles.title}>Recomendação do dia</Text>
      <Text style={styles.text}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 16,
    gap: 6,
  },
  title: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  text: { color: colors.text, fontSize: 14, lineHeight: 20 },
})

import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { colors, radius } from '@/constants/theme'

interface Props {
  icon: string
  label: string
  value?: string | number | null
  unit?: string
  subtitle?: string
  progress?: number
  unavailable?: boolean
}

export function SamsungCard({
  icon,
  label,
  value,
  unit,
  subtitle,
  progress,
  unavailable,
}: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.label}>{label}</Text>

      {unavailable || value === null || value === undefined ? (
        <Text style={styles.noData}>—</Text>
      ) : (
        <>
          <Text style={styles.value}>
            {value}
            {unit && <Text style={styles.unit}> {unit}</Text>}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </>
      )}

      {progress !== undefined && !unavailable && (
        <View style={styles.progressTrack}>
          <View
            style={[styles.progressFill, { width: `${Math.min(progress, 100)}%` }]}
          />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 2,
    minHeight: 100,
  },
  icon: { fontSize: 22 },
  label: { color: colors.muted, fontSize: 11, marginTop: 4 },
  value: { color: colors.text, fontSize: 20, fontWeight: '700', marginTop: 2 },
  unit: { fontSize: 13, fontWeight: '400', color: colors.muted },
  subtitle: { color: colors.muted, fontSize: 11, marginTop: 1 },
  noData: { color: colors.border, fontSize: 22, fontWeight: '300', marginTop: 2 },
  progressTrack: {
    height: 3,
    backgroundColor: colors.border,
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
})

import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { colors } from '@/constants/theme'

interface Props {
  label: string
  value: number
  target: number
  color: string
  unit?: string
}

export function MacrosBar({ label, value, target, color, unit = 'g' }: Props) {
  const pct = Math.min(target > 0 ? (value / target) * 100 : 0, 100)
  const over = value > target

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.value, over && { color: colors.warning }]}>
          {Math.round(value)}{unit}
          <Text style={styles.target}> / {Math.round(target)}{unit}</Text>
        </Text>
      </View>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${pct}%`, backgroundColor: over ? colors.warning : color },
          ]}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: { color: colors.muted, fontSize: 13 },
  value: { color: colors.text, fontSize: 13, fontWeight: '600' },
  target: { color: colors.muted, fontWeight: '400' },
  track: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 3 },
})

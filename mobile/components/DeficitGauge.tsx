import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Svg, { Circle, Text as SvgText } from 'react-native-svg'
import { colors } from '@/constants/theme'

interface Props {
  consumed: number
  tdee: number
  caloriesBurned: number
  targetDeficit: number
}

export function DeficitGauge({ consumed, tdee, caloriesBurned, targetDeficit }: Props) {
  const totalBurn = tdee + caloriesBurned
  const deficit = totalBurn - consumed
  const progress = Math.min(Math.max(consumed / totalBurn, 0), 1)

  const size = 200
  const radius = 82
  const strokeWidth = 14
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference * (1 - progress)

  const gaugeColor =
    deficit >= targetDeficit * 0.8
      ? colors.success
      : deficit >= 0
      ? colors.warning
      : colors.danger

  const label = deficit >= 0 ? 'déficit' : 'superávit'

  return (
    <View style={styles.container}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.border}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Progress */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={gaugeColor}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        {/* Center value */}
        <SvgText
          x={size / 2}
          y={size / 2 - 8}
          textAnchor="middle"
          fill={colors.text}
          fontSize="32"
          fontWeight="bold"
        >
          {Math.abs(Math.round(deficit))}
        </SvgText>
        <SvgText
          x={size / 2}
          y={size / 2 + 16}
          textAnchor="middle"
          fill={colors.muted}
          fontSize="13"
        >
          kcal {label}
        </SvgText>
      </Svg>

      {/* Bottom stats */}
      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{Math.round(consumed)}</Text>
          <Text style={styles.statLabel}>consumido</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: gaugeColor }]} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{Math.round(totalBurn)}</Text>
          <Text style={styles.statLabel}>meta</Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  stats: { flexDirection: 'row', alignItems: 'center', gap: 24, marginTop: 8 },
  stat: { alignItems: 'center' },
  statValue: { color: colors.text, fontSize: 20, fontWeight: '700' },
  statLabel: { color: colors.muted, fontSize: 12, marginTop: 2 },
  statDivider: { width: 1, height: 32, opacity: 0.5 },
})

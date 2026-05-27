'use client'

import { RadialBarChart, RadialBar, ResponsiveContainer } from 'recharts'

interface DeficitGaugeProps {
  consumed: number
  tdee: number
  deficitToday?: number
  targetDeficit?: number
}

export function DeficitGauge({
  consumed,
  tdee,
  deficitToday,
  targetDeficit = 500,
}: DeficitGaugeProps) {
  // Percentage of TDEE consumed
  const percentage = tdee > 0 ? Math.min((consumed / tdee) * 100, 150) : 0

  // Determine color based on deficit status
  const getColor = () => {
    if (deficitToday === undefined || tdee === 0) return '#6366f1'
    if (deficitToday >= targetDeficit) return '#10b981' // green - goal achieved
    if (deficitToday >= 0) return '#f59e0b' // amber - on track
    return '#ef4444' // red - surplus
  }

  const getStatusText = () => {
    if (deficitToday === undefined) return 'Sem dados'
    if (deficitToday > 0) return `Déficit: ${Math.round(deficitToday)} kcal`
    return `Superávit: ${Math.round(Math.abs(deficitToday))} kcal`
  }

  const getStatusColor = () => {
    if (deficitToday === undefined) return 'text-gray-400'
    if (deficitToday >= targetDeficit) return 'text-success-400'
    if (deficitToday >= 0) return 'text-warning-400'
    return 'text-danger-400'
  }

  const color = getColor()
  const remaining = Math.max(0, tdee - consumed)
  const chartData = [
    {
      name: 'consumed',
      value: Math.min(percentage, 100),
      fill: color,
    },
  ]

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-48 h-48">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="65%"
            outerRadius="85%"
            startAngle={225}
            endAngle={-45}
            data={chartData}
          >
            {/* Background track */}
            <RadialBar
              dataKey="value"
              cornerRadius={10}
              background={{ fill: '#1f2937' }}
              data={[{ value: 100, fill: '#1f2937' }]}
            />
            <RadialBar
              dataKey="value"
              cornerRadius={10}
              data={chartData}
            />
          </RadialBarChart>
        </ResponsiveContainer>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-white">
            {Math.round(consumed)}
          </span>
          <span className="text-xs text-gray-400">kcal consumidas</span>
          <span className="text-xs text-gray-500 mt-0.5">
            de {Math.round(tdee)} kcal
          </span>
        </div>
      </div>

      {/* Status */}
      <div className="mt-2 text-center">
        <p className={`text-lg font-semibold ${getStatusColor()}`}>
          {getStatusText()}
        </p>
        {remaining > 0 && (
          <p className="text-sm text-gray-400 mt-1">
            Ainda pode consumir {Math.round(remaining)} kcal
          </p>
        )}
        {deficitToday !== undefined && deficitToday >= targetDeficit && (
          <p className="text-xs text-success-400 mt-1">
            Meta de déficit atingida!
          </p>
        )}
      </div>

      {/* Mini stats */}
      <div className="mt-4 flex gap-6 text-center">
        <div>
          <p className="text-xs text-gray-400">Queimadas</p>
          <p className="text-sm font-semibold text-white">{Math.round(tdee)}</p>
        </div>
        <div className="w-px bg-gray-700" />
        <div>
          <p className="text-xs text-gray-400">Meta déficit</p>
          <p className="text-sm font-semibold text-white">{targetDeficit}</p>
        </div>
        <div className="w-px bg-gray-700" />
        <div>
          <p className="text-xs text-gray-400">Resultado</p>
          <p className={`text-sm font-semibold ${getStatusColor()}`}>
            {deficitToday !== undefined ? Math.round(deficitToday) : '--'}
          </p>
        </div>
      </div>
    </div>
  )
}

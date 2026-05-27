'use client'

interface MacrosBarProps {
  label: string
  value: number
  target: number
  unit?: string
  color: string
}

export function MacrosBar({
  label,
  value,
  target,
  unit = 'g',
  color,
}: MacrosBarProps) {
  const percentage = target > 0 ? Math.min((value / target) * 100, 100) : 0
  const isOver = value > target

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-300 font-medium">{label}</span>
        <div className="flex items-center gap-2">
          <span className={`font-semibold ${isOver ? 'text-danger-400' : 'text-white'}`}>
            {Math.round(value)}{unit}
          </span>
          <span className="text-gray-500">/ {Math.round(target)}{unit}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
            isOver
              ? 'bg-danger-900/50 text-danger-400'
              : 'bg-gray-800 text-gray-400'
          }`}>
            {Math.round(percentage)}%
          </span>
        </div>
      </div>

      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color} ${isOver ? 'opacity-80' : ''}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

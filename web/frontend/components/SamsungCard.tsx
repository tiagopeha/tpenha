'use client'

import { type LucideIcon } from 'lucide-react'

interface SamsungCardProps {
  icon: LucideIcon
  label: string
  value: string | number | null | undefined
  subtitle?: string
  unit?: string
  progress?: number // 0-100
  iconColor?: string
  unavailable?: boolean
}

export function SamsungCard({
  icon: Icon,
  label,
  value,
  subtitle,
  unit,
  progress,
  iconColor = 'text-primary-400',
  unavailable = false,
}: SamsungCardProps) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 hover:border-gray-600 transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg bg-gray-700 ${iconColor}`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-xs text-gray-500">{label}</span>
      </div>

      {unavailable || value === null || value === undefined ? (
        <div>
          <p className="text-lg font-bold text-gray-500">--</p>
          <p className="text-xs text-gray-600 mt-0.5">Sem dados</p>
        </div>
      ) : (
        <div>
          <div className="flex items-baseline gap-1">
            <p className="text-xl font-bold text-white">{value}</p>
            {unit && <span className="text-sm text-gray-400">{unit}</span>}
          </div>
          {subtitle && (
            <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
          )}
        </div>
      )}

      {progress !== undefined && !unavailable && value !== null && value !== undefined && (
        <div className="mt-3">
          <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                progress >= 100
                  ? 'bg-success-500'
                  : progress >= 60
                  ? 'bg-primary-500'
                  : 'bg-warning-500'
              }`}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">{Math.round(progress)}% da meta</p>
        </div>
      )}
    </div>
  )
}

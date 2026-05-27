'use client'

import { Bed, Footprints, Dumbbell, Wind } from 'lucide-react'

interface RecommendationCardProps {
  recommendation?: string
  restDay: boolean
  cardioSuggestion?: string
}

export function RecommendationCard({
  recommendation,
  restDay,
  cardioSuggestion,
}: RecommendationCardProps) {
  const getIcon = () => {
    if (restDay) return <Bed className="w-6 h-6" />
    if (cardioSuggestion) return <Footprints className="w-6 h-6" />
    return <Dumbbell className="w-6 h-6" />
  }

  const getColors = () => {
    if (restDay) return {
      bg: 'bg-blue-900/20',
      border: 'border-blue-800/50',
      icon: 'bg-blue-900/50 text-blue-400',
      badge: 'bg-blue-900/50 text-blue-300',
      badgeText: 'Descanso',
    }
    if (cardioSuggestion) return {
      bg: 'bg-warning-900/20',
      border: 'border-warning-800/50',
      icon: 'bg-warning-900/50 text-warning-400',
      badge: 'bg-warning-900/50 text-warning-300',
      badgeText: 'Cardio',
    }
    return {
      bg: 'bg-success-900/20',
      border: 'border-success-800/50',
      icon: 'bg-success-900/50 text-success-400',
      badge: 'bg-success-900/50 text-success-300',
      badgeText: 'Treino completo',
    }
  }

  const colors = getColors()

  return (
    <div className={`${colors.bg} rounded-xl p-4 border ${colors.border}`}>
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-xl ${colors.icon} flex-shrink-0`}>
          {getIcon()}
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-sm font-semibold text-white">
              Recomendação do dia
            </h3>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors.badge}`}>
              {colors.badgeText}
            </span>
          </div>

          <p className="text-sm text-gray-300 leading-relaxed">
            {recommendation || 'Carregando recomendação...'}
          </p>

          {cardioSuggestion && !restDay && (
            <div className="mt-3 flex items-center gap-2 text-xs text-warning-400">
              <Wind className="w-3.5 h-3.5" />
              <span className="font-medium">{cardioSuggestion} recomendados</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

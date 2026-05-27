'use client'

import { Trash2, Sparkles } from 'lucide-react'
import type { MealResponse } from '@/lib/types'

const MEAL_EMOJIS: Record<string, string> = {
  cafe: '☕',
  almoco: '🍽️',
  jantar: '🌙',
  lanche: '🍎',
}

const MEAL_LABELS: Record<string, string> = {
  cafe: 'Café da manhã',
  almoco: 'Almoço',
  jantar: 'Jantar',
  lanche: 'Lanche',
}

interface MealCardProps {
  meal: MealResponse
  onDelete?: (id: number) => void
  isDeleting?: boolean
}

export function MealCard({ meal, onDelete, isDeleting = false }: MealCardProps) {
  const emoji = MEAL_EMOJIS[meal.meal_type] || '🍴'
  const label = MEAL_LABELS[meal.meal_type] || meal.meal_type

  return (
    <div className={`bg-gray-800 rounded-xl p-4 border border-gray-700 hover:border-gray-600 transition-all ${isDeleting ? 'opacity-50' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-gray-700 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
          {emoji}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-gray-400 font-medium">{label}</span>
            {meal.analyzed_by_ai && (
              <span className="flex items-center gap-1 text-xs text-primary-400 bg-primary-900/30 px-1.5 py-0.5 rounded-full">
                <Sparkles className="w-3 h-3" />
                IA
              </span>
            )}
          </div>

          <p className="text-sm text-white font-medium truncate">
            {meal.description}
          </p>

          {/* Macros pills */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            <span className="text-xs bg-orange-900/30 text-orange-400 px-2 py-0.5 rounded-full font-medium">
              P {Math.round(meal.protein_g)}g
            </span>
            <span className="text-xs bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded-full font-medium">
              C {Math.round(meal.carbs_g)}g
            </span>
            <span className="text-xs bg-yellow-900/30 text-yellow-400 px-2 py-0.5 rounded-full font-medium">
              G {Math.round(meal.fat_g)}g
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <span className="text-lg font-bold text-white">
            {Math.round(meal.calories)}
          </span>
          <span className="text-xs text-gray-400">kcal</span>

          {onDelete && (
            <button
              onClick={() => onDelete(meal.id)}
              disabled={isDeleting}
              className="p-1.5 rounded-lg text-gray-500 hover:text-danger-400 hover:bg-danger-900/20 transition-all disabled:opacity-50"
              aria-label="Remover refeição"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

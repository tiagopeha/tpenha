'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Plus, UtensilsCrossed } from 'lucide-react'
import { api } from '@/lib/api'
import type { MealCreate, MealResponse } from '@/lib/types'
import { DateNav } from '@/components/DateNav'
import { MealCard } from '@/components/MealCard'
import { MealForm } from '@/components/MealForm'

const MEAL_TYPES = [
  { value: 'cafe', label: 'Café da manhã', emoji: '☕' },
  { value: 'almoco', label: 'Almoço', emoji: '🍽️' },
  { value: 'jantar', label: 'Jantar', emoji: '🌙' },
  { value: 'lanche', label: 'Lanche', emoji: '🍎' },
] as const

export default function RefeicoesPage() {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [showForm, setShowForm] = useState(false)
  const queryClient = useQueryClient()

  const { data: meals = [], isLoading } = useQuery({
    queryKey: ['meals', date],
    queryFn: () => api.getMeals(date).then((r) => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (data: MealCreate) => api.createMeal(data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meals', date] })
      queryClient.invalidateQueries({ queryKey: ['dashboard', date] })
      setShowForm(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteMeal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meals', date] })
      queryClient.invalidateQueries({ queryKey: ['dashboard', date] })
    },
  })

  // Group meals by type
  const mealsByType = MEAL_TYPES.map((type) => ({
    ...type,
    meals: meals.filter((m) => m.meal_type === type.value),
  })).filter((group) => group.meals.length > 0)

  // Daily totals
  const totalCalories = meals.reduce((sum, m) => sum + m.calories, 0)
  const totalProtein = meals.reduce((sum, m) => sum + m.protein_g, 0)
  const totalCarbs = meals.reduce((sum, m) => sum + m.carbs_g, 0)
  const totalFat = meals.reduce((sum, m) => sum + m.fat_g, 0)

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-900/50 rounded-xl">
            <UtensilsCrossed className="w-6 h-6 text-primary-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Refeições</h1>
            <p className="text-gray-400 text-sm">Registre o que você comeu</p>
          </div>
        </div>
        <DateNav date={date} onDateChange={setDate} />
      </div>

      {/* Add button */}
      <button
        onClick={() => setShowForm(true)}
        className="w-full flex items-center justify-center gap-3 p-4 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium transition-all group"
      >
        <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-200" />
        Adicionar Refeição — Claude vai estimar as calorias
      </button>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 skeleton rounded-xl" />
          ))}
        </div>
      )}

      {/* Meals grouped by type */}
      {!isLoading && mealsByType.length > 0 && (
        <div className="space-y-6">
          {mealsByType.map((group) => (
            <div key={group.value}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">{group.emoji}</span>
                <h2 className="text-sm font-semibold text-gray-300">{group.label}</h2>
                <div className="flex-1 h-px bg-gray-800" />
                <span className="text-xs text-gray-500">
                  {Math.round(group.meals.reduce((s, m) => s + m.calories, 0))} kcal
                </span>
              </div>
              <div className="space-y-2">
                {group.meals.map((meal) => (
                  <MealCard
                    key={meal.id}
                    meal={meal}
                    onDelete={(id) => deleteMutation.mutate(id)}
                    isDeleting={deleteMutation.isPending}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && meals.length === 0 && (
        <div className="bg-gray-800 rounded-2xl p-12 border border-gray-700 text-center">
          <UtensilsCrossed className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-white font-semibold mb-2">Nenhuma refeição registrada</h3>
          <p className="text-gray-400 text-sm mb-6">
            Adicione sua primeira refeição. O Claude vai estimar automaticamente as calorias e macros.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-medium transition-all"
          >
            Adicionar Refeição
          </button>
        </div>
      )}

      {/* Daily total */}
      {meals.length > 0 && (
        <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Total do dia</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{Math.round(totalCalories)}</p>
              <p className="text-xs text-gray-400 mt-1">Calorias</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-400">{Math.round(totalProtein)}g</p>
              <p className="text-xs text-gray-400 mt-1">Proteína</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-400">{Math.round(totalCarbs)}g</p>
              <p className="text-xs text-gray-400 mt-1">Carboidratos</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-400">{Math.round(totalFat)}g</p>
              <p className="text-xs text-gray-400 mt-1">Gorduras</p>
            </div>
          </div>
        </div>
      )}

      {/* Meal Form Modal */}
      {showForm && (
        <MealForm
          defaultDate={date}
          onSubmit={async (data) => { await createMutation.mutateAsync(data) }}
          onClose={() => setShowForm(false)}
          isLoading={createMutation.isPending}
        />
      )}
    </div>
  )
}

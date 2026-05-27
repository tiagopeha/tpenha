'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Plus, TrendingDown, Activity, Moon, Heart, Footprints } from 'lucide-react'
import { api } from '@/lib/api'
import type { MealCreate } from '@/lib/types'
import { DateNav } from '@/components/DateNav'
import { DeficitGauge } from '@/components/DeficitGauge'
import { MacrosBar } from '@/components/MacrosBar'
import { SamsungCard } from '@/components/SamsungCard'
import { MealCard } from '@/components/MealCard'
import { MealForm } from '@/components/MealForm'
import { RecommendationCard } from '@/components/RecommendationCard'

export default function DashboardPage() {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [showMealForm, setShowMealForm] = useState(false)
  const queryClient = useQueryClient()

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboard', date],
    queryFn: () => api.getDashboard(date).then((r) => r.data),
  })

  const createMealMutation = useMutation({
    mutationFn: (data: MealCreate) => api.createMeal(data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', date] })
      queryClient.invalidateQueries({ queryKey: ['meals', date] })
      setShowMealForm(false)
    },
  })

  const deleteMealMutation = useMutation({
    mutationFn: (id: number) => api.deleteMeal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', date] })
      queryClient.invalidateQueries({ queryKey: ['meals', date] })
    },
  })

  const macros = dashboard?.daily_macros
  const health = dashboard?.samsung_health
  const profile = dashboard?.profile

  // Estimated macro targets based on TDEE
  const tdee = dashboard?.tdee || 2000
  const proteinTarget = (profile?.weight_kg || 70) * 2.2 // 2.2g/kg
  const carbsTarget = (tdee * 0.45) / 4 // 45% of calories
  const fatTarget = (tdee * 0.30) / 9 // 30% of calories

  const passos = health?.passos
  const passosProgress = passos ? (passos / 10000) * 100 : 0

  const lastExercise = health?.exercicios?.[0]

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 skeleton rounded-lg" />
          <div className="h-8 w-32 skeleton rounded-lg" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 skeleton rounded-xl" />
          <div className="h-64 skeleton rounded-xl" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 skeleton rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 text-sm">
            Olá, {profile?.name || 'Usuário'}! Aqui está seu resumo.
          </p>
        </div>
        <DateNav date={date} onDateChange={setDate} />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Deficit Gauge */}
        <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown className="w-5 h-5 text-primary-400" />
            <h2 className="text-base font-semibold text-white">Balanço Calórico</h2>
          </div>
          <div className="flex justify-center">
            <DeficitGauge
              consumed={macros?.total_calories || 0}
              tdee={tdee}
              deficitToday={dashboard?.deficit_today}
              targetDeficit={dashboard?.target_deficit || 500}
            />
          </div>
        </div>

        {/* Macros */}
        <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 space-y-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-success-400" />
            <h2 className="text-base font-semibold text-white">Macronutrientes</h2>
          </div>
          <MacrosBar
            label="Proteína"
            value={macros?.total_protein || 0}
            target={proteinTarget}
            color="bg-orange-500"
          />
          <MacrosBar
            label="Carboidratos"
            value={macros?.total_carbs || 0}
            target={carbsTarget}
            color="bg-blue-500"
          />
          <MacrosBar
            label="Gorduras"
            value={macros?.total_fat || 0}
            target={fatTarget}
            color="bg-yellow-500"
          />

          <div className="pt-2 border-t border-gray-700">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Total calorias</span>
              <span className="text-white font-semibold">
                {Math.round(macros?.total_calories || 0)} / {Math.round(tdee)} kcal
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Samsung Health row */}
      <div>
        <h2 className="text-base font-semibold text-white mb-3">Samsung Health</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SamsungCard
            icon={Footprints}
            label="Passos"
            value={passos?.toLocaleString('pt-BR')}
            subtitle={health?.distancia_km ? `${health.distancia_km} km` : undefined}
            progress={passosProgress}
            iconColor="text-primary-400"
            unavailable={passos === null || passos === undefined}
          />
          <SamsungCard
            icon={Moon}
            label="Sono"
            value={health?.sono_horas}
            unit="h"
            subtitle={health?.sono_qualidade ? `Qualidade: ${health.sono_qualidade}` : undefined}
            iconColor="text-blue-400"
            unavailable={health?.sono_horas === null || health?.sono_horas === undefined}
          />
          <SamsungCard
            icon={Heart}
            label="Freq. Cardíaca"
            value={health?.fc_media}
            unit="bpm"
            subtitle={
              health?.fc_min && health?.fc_max
                ? `${health.fc_min}-${health.fc_max} bpm`
                : undefined
            }
            iconColor="text-red-400"
            unavailable={health?.fc_media === null || health?.fc_media === undefined}
          />
          <SamsungCard
            icon={Activity}
            label="Último treino"
            value={lastExercise?.tipo}
            subtitle={
              lastExercise
                ? `${lastExercise.duracao_min}min · ${lastExercise.calorias} kcal`
                : undefined
            }
            iconColor="text-success-400"
            unavailable={!lastExercise}
          />
        </div>
      </div>

      {/* Recommendation */}
      <RecommendationCard
        recommendation={dashboard?.recommendation}
        restDay={dashboard?.rest_day || false}
        cardioSuggestion={dashboard?.cardio_suggestion}
      />

      {/* Today's meals */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-white">
            Refeições do dia
            {macros?.meals?.length ? (
              <span className="ml-2 text-sm font-normal text-gray-400">
                ({macros.meals.length})
              </span>
            ) : null}
          </h2>
          <button
            onClick={() => setShowMealForm(true)}
            className="flex items-center gap-2 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-medium transition-all"
          >
            <Plus className="w-4 h-4" />
            Adicionar
          </button>
        </div>

        {macros?.meals?.length ? (
          <div className="space-y-3">
            {macros.meals.map((meal) => (
              <MealCard
                key={meal.id}
                meal={meal}
                onDelete={(id) => deleteMealMutation.mutate(id)}
                isDeleting={deleteMealMutation.isPending}
              />
            ))}
          </div>
        ) : (
          <div className="bg-gray-800 rounded-xl p-8 border border-gray-700 text-center">
            <p className="text-gray-400 text-sm">Nenhuma refeição registrada hoje</p>
            <button
              onClick={() => setShowMealForm(true)}
              className="mt-3 text-primary-400 hover:text-primary-300 text-sm font-medium transition-colors"
            >
              Adicionar primeira refeição
            </button>
          </div>
        )}
      </div>

      {/* Meal Form Modal */}
      {showMealForm && (
        <MealForm
          defaultDate={date}
          onSubmit={async (data) => { await createMealMutation.mutateAsync(data) }}
          onClose={() => setShowMealForm(false)}
          isLoading={createMealMutation.isPending}
        />
      )}
    </div>
  )
}

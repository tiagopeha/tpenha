'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Dumbbell,
  Footprints,
  Moon,
  Heart,
  Flame,
  Clock,
  MapPin,
  Bed,
  Activity,
} from 'lucide-react'
import { api } from '@/lib/api'
import { DateNav } from '@/components/DateNav'
import { SamsungCard } from '@/components/SamsungCard'
import { RecommendationCard } from '@/components/RecommendationCard'
import type { SamsungHealthData } from '@/lib/types'

const EXERCISE_ICONS: Record<string, string> = {
  'Caminhada': '🚶',
  'Corrida': '🏃',
  'Ciclismo': '🚴',
  'Natação': '🏊',
  'Musculação': '🏋️',
  'Funcional': '🤸',
  'Yoga': '🧘',
  'Pilates': '🧘',
  'Corrida na esteira': '🏃',
  'Ciclismo indoor': '🚴',
}

function WeeklyStrip({ currentDate }: { currentDate: string }) {
  const today = new Date()
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(today, 6 - i)
    return {
      date: format(d, 'yyyy-MM-dd'),
      label: format(d, 'EEE', { locale: ptBR }),
      dayNum: format(d, 'd'),
      isToday: format(d, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd'),
      isCurrent: format(d, 'yyyy-MM-dd') === currentDate,
    }
  })

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">Últimos 7 dias</h3>
      <div className="flex justify-between gap-1">
        {days.map((day) => (
          <div
            key={day.date}
            className={`flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-lg transition-all ${
              day.isCurrent
                ? 'bg-primary-600 text-white'
                : day.isToday
                ? 'bg-gray-700 text-gray-200'
                : 'text-gray-500'
            }`}
          >
            <span className="text-xs capitalize">{day.label.slice(0, 3)}</span>
            <span className={`text-sm font-bold ${day.isCurrent ? 'text-white' : ''}`}>
              {day.dayNum}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SleepCard({ health }: { health?: SamsungHealthData }) {
  const sono = health?.sono_horas
  const fases = health?.sono_fases
  const qualidade = health?.sono_qualidade

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <div className="flex items-center gap-2 mb-4">
        <Moon className="w-5 h-5 text-blue-400" />
        <h3 className="text-sm font-semibold text-white">Sono</h3>
        {qualidade && (
          <span className="ml-auto text-xs text-blue-300 bg-blue-900/30 px-2 py-0.5 rounded-full">
            {qualidade}
          </span>
        )}
      </div>

      {sono !== null && sono !== undefined ? (
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-4xl font-bold text-white">{sono.toFixed(1)}</p>
            <p className="text-sm text-gray-400">horas de sono</p>
          </div>

          {/* Sleep quality indicator */}
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                sono >= 8 ? 'bg-success-500' : sono >= 6 ? 'bg-warning-500' : 'bg-danger-500'
              }`}
              style={{ width: `${Math.min((sono / 10) * 100, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 text-center">
            {sono >= 8 ? 'Excelente recuperação' : sono >= 6 ? 'Recuperação adequada' : 'Sono insuficiente — priorize descanso'}
          </p>

          {/* Sleep phases */}
          {fases && (
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-700">
              {Object.entries(fases)
                .filter(([, v]) => v !== undefined && v !== null)
                .map(([key, value]) => (
                  <div key={key} className="text-center">
                    <p className="text-lg font-semibold text-white">{value}min</p>
                    <p className="text-xs text-gray-400 capitalize">{key}</p>
                  </div>
                ))}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-4">
          <Bed className="w-8 h-8 text-gray-600 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">Dados de sono não disponíveis</p>
        </div>
      )}
    </div>
  )
}

function HeartRateCard({ health }: { health?: SamsungHealthData }) {
  const fcMedia = health?.fc_media
  const fcMin = health?.fc_min
  const fcMax = health?.fc_max

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <div className="flex items-center gap-2 mb-4">
        <Heart className="w-5 h-5 text-red-400" />
        <h3 className="text-sm font-semibold text-white">Frequência Cardíaca</h3>
      </div>

      {fcMedia !== null && fcMedia !== undefined ? (
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-4xl font-bold text-white">{fcMedia}</p>
            <p className="text-sm text-gray-400">bpm média</p>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-700">
            <div className="text-center">
              <p className="text-xl font-semibold text-blue-400">{fcMin}</p>
              <p className="text-xs text-gray-400">Mínima</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-semibold text-red-400">{fcMax}</p>
              <p className="text-xs text-gray-400">Máxima</p>
            </div>
          </div>

          {/* HR zone indicator */}
          <div className="text-xs text-center text-gray-500">
            {fcMedia < 60 ? 'Repouso (excelente)' :
             fcMedia < 100 ? 'Normal' :
             fcMedia < 140 ? 'Atividade moderada' :
             'Atividade intensa'}
          </div>
        </div>
      ) : (
        <div className="text-center py-4">
          <Heart className="w-8 h-8 text-gray-600 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">Dados de FC não disponíveis</p>
        </div>
      )}
    </div>
  )
}

export default function TreinosPage() {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  const { data: health, isLoading } = useQuery({
    queryKey: ['health', date],
    queryFn: () => api.getHealthData(date).then((r) => r.data),
  })

  const { data: dashboard } = useQuery({
    queryKey: ['dashboard', date],
    queryFn: () => api.getDashboard(date).then((r) => r.data),
  })

  const exercicios = health?.exercicios || []
  const totalCaloriesExercise = exercicios.reduce((s, e) => s + e.calorias, 0)
  const passos = health?.passos

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-success-900/50 rounded-xl">
            <Dumbbell className="w-6 h-6 text-success-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Treinos</h1>
            <p className="text-gray-400 text-sm">Atividade física e recuperação</p>
          </div>
        </div>
        <DateNav date={date} onDateChange={setDate} />
      </div>

      {/* Weekly strip */}
      <WeeklyStrip currentDate={date} />

      {/* Recommendation */}
      {dashboard && (
        <RecommendationCard
          recommendation={dashboard.recommendation}
          restDay={dashboard.rest_day}
          cardioSuggestion={dashboard.cardio_suggestion}
        />
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 skeleton rounded-xl" />
          ))}
        </div>
      )}

      {/* Stats row */}
      {!isLoading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SamsungCard
            icon={Footprints}
            label="Passos"
            value={passos?.toLocaleString('pt-BR')}
            subtitle={health?.distancia_km ? `${health.distancia_km} km` : undefined}
            progress={passos ? (passos / 10000) * 100 : 0}
            iconColor="text-primary-400"
            unavailable={!passos}
          />
          <SamsungCard
            icon={Flame}
            label="Queimadas (exercício)"
            value={totalCaloriesExercise || undefined}
            unit="kcal"
            iconColor="text-orange-400"
            unavailable={exercicios.length === 0}
          />
          <SamsungCard
            icon={Activity}
            label="Exercícios"
            value={exercicios.length || undefined}
            subtitle={exercicios.length === 1 ? 'sessão' : 'sessões'}
            iconColor="text-success-400"
            unavailable={exercicios.length === 0}
          />
          <SamsungCard
            icon={Clock}
            label="Tempo ativo"
            value={exercicios.reduce((s, e) => s + e.duracao_min, 0) || undefined}
            unit="min"
            iconColor="text-yellow-400"
            unavailable={exercicios.length === 0}
          />
        </div>
      )}

      {/* Exercise list */}
      {exercicios.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-white mb-3">Exercícios registrados</h2>
          <div className="space-y-3">
            {exercicios.map((ex, idx) => {
              const emoji = EXERCISE_ICONS[ex.tipo] || '🏃'
              return (
                <div
                  key={idx}
                  className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex items-center gap-4"
                >
                  <div className="w-12 h-12 bg-gray-700 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                    {emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-semibold">{ex.tipo}</h3>
                    <div className="flex flex-wrap gap-3 mt-1">
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock className="w-3 h-3" />
                        {ex.duracao_min} min
                      </span>
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Flame className="w-3 h-3 text-orange-400" />
                        {ex.calorias} kcal
                      </span>
                      {ex.distancia_km > 0 && (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <MapPin className="w-3 h-3" />
                          {ex.distancia_km} km
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Sleep and HR cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SleepCard health={health} />
        <HeartRateCard health={health} />
      </div>

      {/* No data state */}
      {!isLoading && !health?.passos && !health?.sono_horas && !health?.fc_media && exercicios.length === 0 && (
        <div className="bg-gray-800 rounded-2xl p-12 border border-gray-700 text-center">
          <Dumbbell className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-white font-semibold mb-2">Samsung Health não conectado</h3>
          <p className="text-gray-400 text-sm mb-4">
            Configure sua integração Samsung Health para ver seus dados de treino e saúde aqui.
          </p>
          <a
            href="/perfil"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-medium transition-all"
          >
            Conectar Samsung Health
          </a>
        </div>
      )}
    </div>
  )
}

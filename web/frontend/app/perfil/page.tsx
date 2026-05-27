'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { User, Check, ExternalLink, Wifi, WifiOff, ChevronDown } from 'lucide-react'
import { api } from '@/lib/api'
import type { UserProfile } from '@/lib/types'

const ACTIVITY_LEVELS = [
  { value: 'sedentary', label: 'Sedentário', description: 'Trabalho de escritório, sem exercício' },
  { value: 'light', label: 'Leve', description: '1-3 dias de exercício por semana' },
  { value: 'moderate', label: 'Moderado', description: '3-5 dias de exercício por semana' },
  { value: 'active', label: 'Ativo', description: '6-7 dias de exercício intenso' },
  { value: 'very_active', label: 'Muito ativo', description: 'Atleta, trabalho físico intenso' },
] as const

const GOALS = [
  { value: 'deficit', label: 'Perder peso', emoji: '📉', description: 'Déficit calórico' },
  { value: 'maintain', label: 'Manter peso', emoji: '⚖️', description: 'Calorias em equilíbrio' },
  { value: 'surplus', label: 'Ganhar massa', emoji: '📈', description: 'Superávit calórico' },
] as const

function calcBMR(w: number, h: number, age: number, sex: string) {
  const base = 10 * w + 6.25 * h - 5 * age
  return sex === 'm' ? base + 5 : base - 161
}

function calcTDEE(bmr: number, activity: string) {
  const mults: Record<string, number> = {
    sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9,
  }
  return Math.round(bmr * (mults[activity] || 1.55))
}

export default function PerfilPage() {
  const queryClient = useQueryClient()
  const [saved, setSaved] = useState(false)

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.getProfile().then((r) => r.data),
  })

  const { data: authStatus } = useQuery({
    queryKey: ['health-auth-status'],
    queryFn: () => api.getHealthAuthStatus().then((r) => r.data),
    refetchInterval: 10000,
  })

  const { data: authUrlData } = useQuery({
    queryKey: ['health-auth-url'],
    queryFn: () => api.getHealthAuthUrl().then((r) => r.data),
  })

  const [form, setForm] = useState<Partial<UserProfile>>({})

  useEffect(() => {
    if (profile && Object.keys(form).length === 0) {
      setForm({ ...profile })
    }
  }, [profile])

  const updateMutation = useMutation({
    mutationFn: (data: Partial<UserProfile>) => api.updateProfile(data).then((r) => r.data),
    onSuccess: (updated) => {
      queryClient.setQueryData(['profile'], updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateMutation.mutate(form)
  }

  const updateField = <K extends keyof UserProfile>(key: K, value: UserProfile[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const currentBMR = form.weight_kg && form.height_cm && form.age && form.sex
    ? Math.round(calcBMR(form.weight_kg, form.height_cm, form.age, form.sex))
    : null

  const currentTDEE = currentBMR && form.activity_level
    ? calcTDEE(currentBMR, form.activity_level)
    : null

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 skeleton rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gray-700 rounded-xl">
          <User className="w-6 h-6 text-gray-300" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Perfil</h1>
          <p className="text-gray-400 text-sm">Suas informações pessoais e metas</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal info */}
        <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700 space-y-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
            Informações pessoais
          </h2>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Nome</label>
            <input
              type="text"
              value={form.name || ''}
              onChange={(e) => updateField('name', e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-primary-500 text-sm"
              placeholder="Seu nome"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Peso (kg)
              </label>
              <input
                type="number"
                value={form.weight_kg || ''}
                onChange={(e) => updateField('weight_kg', parseFloat(e.target.value))}
                className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500 text-sm"
                step="0.1"
                min="30"
                max="300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Altura (cm)
              </label>
              <input
                type="number"
                value={form.height_cm || ''}
                onChange={(e) => updateField('height_cm', parseFloat(e.target.value))}
                className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500 text-sm"
                min="100"
                max="250"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Idade
              </label>
              <input
                type="number"
                value={form.age || ''}
                onChange={(e) => updateField('age', parseInt(e.target.value))}
                className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500 text-sm"
                min="10"
                max="120"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Sexo biológico
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['m', 'f'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => updateField('sex', s)}
                    className={`py-3 rounded-xl text-sm font-medium border transition-all ${
                      form.sex === s
                        ? 'bg-primary-600 border-primary-500 text-white'
                        : 'bg-gray-700 border-gray-600 text-gray-400 hover:border-gray-500'
                    }`}
                  >
                    {s === 'm' ? 'Masculino' : 'Feminino'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Activity level */}
        <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700 space-y-3">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
            Nível de atividade
          </h2>
          <div className="space-y-2">
            {ACTIVITY_LEVELS.map((level) => (
              <button
                key={level.value}
                type="button"
                onClick={() => updateField('activity_level', level.value)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                  form.activity_level === level.value
                    ? 'border-primary-500 bg-primary-900/30'
                    : 'border-gray-700 bg-gray-700/50 hover:border-gray-600'
                }`}
              >
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  form.activity_level === level.value ? 'bg-primary-400' : 'bg-gray-600'
                }`} />
                <div className="flex-1">
                  <p className={`text-sm font-medium ${
                    form.activity_level === level.value ? 'text-primary-300' : 'text-gray-200'
                  }`}>
                    {level.label}
                  </p>
                  <p className="text-xs text-gray-500">{level.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Goal */}
        <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700 space-y-3">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
            Meta
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {GOALS.map((goal) => (
              <button
                key={goal.value}
                type="button"
                onClick={() => updateField('goal', goal.value)}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all ${
                  form.goal === goal.value
                    ? 'border-primary-500 bg-primary-900/30'
                    : 'border-gray-700 bg-gray-700/50 hover:border-gray-600'
                }`}
              >
                <span className="text-2xl">{goal.emoji}</span>
                <span className={`text-xs font-medium ${
                  form.goal === goal.value ? 'text-primary-300' : 'text-gray-300'
                }`}>
                  {goal.label}
                </span>
                <span className="text-xs text-gray-500 text-center leading-tight">
                  {goal.description}
                </span>
              </button>
            ))}
          </div>

          {form.goal !== 'maintain' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Meta de {form.goal === 'deficit' ? 'déficit' : 'superávit'} diário
              </label>
              <div className="space-y-2">
                <input
                  type="range"
                  min={100}
                  max={1000}
                  step={50}
                  value={form.target_deficit_kcal || 500}
                  onChange={(e) => updateField('target_deficit_kcal', parseInt(e.target.value))}
                  className="w-full accent-primary-500"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>100 kcal</span>
                  <span className="text-primary-400 font-semibold text-sm">
                    {form.target_deficit_kcal || 500} kcal
                  </span>
                  <span>1000 kcal</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Calculated values */}
        {currentBMR && currentTDEE && (
          <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
              Valores calculados (estimativa)
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-700/50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-white">{currentBMR}</p>
                <p className="text-xs text-gray-400 mt-1">BMR (kcal/dia)</p>
                <p className="text-xs text-gray-500 mt-0.5">Taxa metabólica basal</p>
              </div>
              <div className="bg-gray-700/50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-primary-400">{currentTDEE}</p>
                <p className="text-xs text-gray-400 mt-1">TDEE (kcal/dia)</p>
                <p className="text-xs text-gray-500 mt-0.5">Gasto total estimado</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3 text-center">
              Baseado na equação de Mifflin-St Jeor
            </p>
          </div>
        )}

        {/* Save button */}
        <button
          type="submit"
          disabled={updateMutation.isPending}
          className={`w-full py-4 rounded-2xl font-semibold text-base transition-all flex items-center justify-center gap-2 ${
            saved
              ? 'bg-success-600 text-white'
              : 'bg-primary-600 hover:bg-primary-700 text-white'
          } disabled:opacity-50`}
        >
          {updateMutation.isPending ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Salvando...
            </>
          ) : saved ? (
            <>
              <Check className="w-5 h-5" />
              Salvo com sucesso!
            </>
          ) : (
            'Salvar Perfil'
          )}
        </button>
      </form>

      {/* Samsung Health connection */}
      <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
          Samsung Health
        </h2>

        <div className="flex items-center gap-4 mb-4">
          <div className={`p-3 rounded-xl ${
            authStatus?.authenticated
              ? 'bg-success-900/30 text-success-400'
              : 'bg-gray-700 text-gray-500'
          }`}>
            {authStatus?.authenticated ? (
              <Wifi className="w-5 h-5" />
            ) : (
              <WifiOff className="w-5 h-5" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-white">
              {authStatus?.authenticated ? 'Conectado' : 'Não conectado'}
            </p>
            <p className="text-xs text-gray-400">
              {authStatus?.message || 'Verificando status...'}
            </p>
          </div>
        </div>

        {!authStatus?.authenticated && authUrlData?.auth_url && (
          <a
            href={authUrlData.auth_url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-all"
          >
            <ExternalLink className="w-4 h-4" />
            Conectar Samsung Health
          </a>
        )}

        {!authUrlData?.auth_url && (
          <div className="bg-gray-700/50 rounded-xl p-4">
            <p className="text-xs text-gray-400">
              Para conectar o Samsung Health, configure as variáveis de ambiente:
            </p>
            <code className="text-xs text-primary-400 block mt-2 font-mono">
              SAMSUNG_HEALTH_CLIENT_ID=...<br />
              SAMSUNG_HEALTH_CLIENT_SECRET=...
            </code>
          </div>
        )}
      </div>
    </div>
  )
}

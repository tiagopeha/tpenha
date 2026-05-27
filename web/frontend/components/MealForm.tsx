'use client'

import { useState, useRef } from 'react'
import { X, Upload, Sparkles, Save, Image } from 'lucide-react'
import type { MealCreate } from '@/lib/types'

interface MealFormProps {
  defaultDate: string
  onSubmit: (data: MealCreate) => Promise<void>
  onClose: () => void
  isLoading?: boolean
}

const MEAL_TYPES = [
  { value: 'cafe', label: 'Café da manhã', emoji: '☕' },
  { value: 'almoco', label: 'Almoço', emoji: '🍽️' },
  { value: 'jantar', label: 'Jantar', emoji: '🌙' },
  { value: 'lanche', label: 'Lanche', emoji: '🍎' },
] as const

export function MealForm({ defaultDate, onSubmit, onClose, isLoading = false }: MealFormProps) {
  const [mealType, setMealType] = useState<'cafe' | 'almoco' | 'jantar' | 'lanche'>('almoco')
  const [description, setDescription] = useState('')
  const [imageBase64, setImageBase64] = useState<string | undefined>()
  const [imagePreview, setImagePreview] = useState<string | undefined>()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const result = event.target?.result as string
      setImageBase64(result) // includes data:image/... prefix
      setImagePreview(result)
    }
    reader.readAsDataURL(file)
  }

  const removeImage = () => {
    setImageBase64(undefined)
    setImagePreview(undefined)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!description.trim()) return

    await onSubmit({
      date: defaultDate,
      meal_type: mealType,
      description: description.trim(),
      image_base64: imageBase64,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-white">Adicionar Refeição</h2>
            <p className="text-sm text-gray-400">Claude vai estimar as calorias automaticamente</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Meal type selector */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Tipo de refeição
            </label>
            <div className="grid grid-cols-4 gap-2">
              {MEAL_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setMealType(type.value)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-center transition-all ${
                    mealType === type.value
                      ? 'border-primary-500 bg-primary-900/30 text-primary-300'
                      : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600 hover:text-gray-200'
                  }`}
                >
                  <span className="text-2xl">{type.emoji}</span>
                  <span className="text-xs leading-tight">{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Descrição da refeição
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: 2 ovos mexidos, fatia de pão integral com manteiga, suco de laranja natural..."
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-primary-500 resize-none text-sm leading-relaxed"
              rows={3}
              required
            />
          </div>

          {/* Image upload */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Foto da refeição (opcional)
            </label>

            {imagePreview ? (
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full h-32 object-cover rounded-xl border border-gray-700"
                />
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-lg text-white hover:bg-black/80 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/60 rounded-lg px-2 py-1">
                  <Image className="w-3 h-3 text-primary-400" />
                  <span className="text-xs text-gray-200">Claude vai analisar a imagem</span>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-20 border-2 border-dashed border-gray-700 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-gray-300 hover:border-gray-600 transition-all"
              >
                <Upload className="w-5 h-5" />
                <span className="text-xs">Clique para adicionar foto</span>
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-medium transition-all disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading || !description.trim()}
              className="flex-1 px-4 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Claude analisando...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Analisar com IA
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

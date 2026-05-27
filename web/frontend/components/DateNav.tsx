'use client'

import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { format, addDays, subDays, isToday, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface DateNavProps {
  date: string
  onDateChange: (date: string) => void
}

export function DateNav({ date, onDateChange }: DateNavProps) {
  const parsed = parseISO(date)
  const today = new Date()
  const isTodayDate = isToday(parsed)

  const goToPrev = () => {
    onDateChange(format(subDays(parsed, 1), 'yyyy-MM-dd'))
  }

  const goToNext = () => {
    const next = addDays(parsed, 1)
    // Don't go to future dates
    if (next <= today) {
      onDateChange(format(next, 'yyyy-MM-dd'))
    }
  }

  const goToToday = () => {
    onDateChange(format(today, 'yyyy-MM-dd'))
  }

  const displayDate = isTodayDate
    ? 'Hoje'
    : format(parsed, "dd 'de' MMMM", { locale: ptBR })

  const isNextDisabled = addDays(parsed, 1) > today

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={goToPrev}
        className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-all"
        aria-label="Dia anterior"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-2 min-w-[160px] justify-center">
        <Calendar className="w-4 h-4 text-gray-400" />
        <span className="text-white font-medium text-sm">{displayDate}</span>
        {isTodayDate && (
          <span className="text-xs bg-primary-600 text-white px-1.5 py-0.5 rounded-full">
            Hoje
          </span>
        )}
      </div>

      <button
        onClick={goToNext}
        disabled={isNextDisabled}
        className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Próximo dia"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      {!isTodayDate && (
        <button
          onClick={goToToday}
          className="ml-2 px-3 py-1.5 text-xs bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-all font-medium"
        >
          Hoje
        </button>
      )}
    </div>
  )
}

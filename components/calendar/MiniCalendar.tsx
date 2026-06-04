'use client'

import {
  addMonths, eachDayOfInterval, endOfMonth, endOfWeek,
  format, isSameDay, isSameMonth, isToday,
  startOfMonth, startOfWeek, subMonths,
} from 'date-fns'
import { ja } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { getHoliday } from '@/lib/holidays'

interface MiniCalendarProps {
  selectedDate: Date
  onSelect: (date: Date) => void
  hasEventOn?: (date: Date) => boolean
}

export function MiniCalendar({ selectedDate, onSelect, hasEventOn }: MiniCalendarProps) {
  const [month, setMonth] = useState(() => startOfMonth(selectedDate))

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 0 }),
  })

  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-2 px-1">
        <button
          onClick={() => setMonth(subMonths(month, 1))}
          className="p-1 rounded hover:bg-gray-100 text-gray-500"
        >
          <ChevronLeft size={14} />
        </button>
        <button
          onClick={() => setMonth(startOfMonth(selectedDate))}
          className="text-xs font-semibold text-gray-700 hover:text-indigo-600"
        >
          {format(month, 'yyyy年M月', { locale: ja })}
        </button>
        <button
          onClick={() => setMonth(addMonths(month, 1))}
          className="p-1 rounded hover:bg-gray-100 text-gray-500"
        >
          <ChevronRight size={14} />
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (
          <div key={d} className={`text-center text-[10px] font-semibold py-0.5 ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-400'}`}>
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const isSelected = isSameDay(day, selectedDate)
          const isCurrentMonth = isSameMonth(day, month)
          const today = isToday(day)
          const isSun = day.getDay() === 0
          const isSat = day.getDay() === 6
          const hasEv = hasEventOn?.(day)
          const holiday = getHoliday(day)
          const isRed = isSun || !!holiday

          return (
            <button
              key={day.toISOString()}
              onClick={() => { onSelect(day); setMonth(startOfMonth(day)) }}
              title={holiday?.name}
              className={`relative mx-auto flex h-9 w-9 flex-col items-center justify-center rounded-full text-xs transition-colors sm:h-7 sm:w-7 sm:text-[11px] ${
                isSelected
                  ? 'bg-indigo-600 text-white font-bold'
                  : today
                  ? 'border border-indigo-600 text-indigo-600 font-bold hover:bg-indigo-50'
                  : !isCurrentMonth
                  ? 'text-gray-300 hover:bg-gray-50'
                  : isRed
                  ? 'text-red-500 hover:bg-red-50'
                  : isSat
                  ? 'text-blue-500 hover:bg-blue-50'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {format(day, 'd')}
              {hasEv && !isSelected && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-indigo-400" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

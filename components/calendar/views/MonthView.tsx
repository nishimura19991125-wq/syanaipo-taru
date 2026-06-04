'use client'

import { useMemo } from 'react'
import {
  eachDayOfInterval, endOfMonth, endOfWeek,
  format, isSameMonth, isToday,
  startOfMonth, startOfWeek,
} from 'date-fns'
import { CalendarEvent } from '@/types/calendar'
import { getHoliday } from '@/lib/holidays'

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

function eventOccursOnDay(event: CalendarEvent, day: Date) {
  const start = new Date(event.startAt)
  const end = event.endAt ? new Date(event.endAt) : start
  const ds = new Date(day.getFullYear(), day.getMonth(), day.getDate())
  const de = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59)
  return start <= de && end >= ds
}

interface MonthViewProps {
  currentMonth: Date
  events: CalendarEvent[]
  onDayClick: (day: Date) => void
  onEventClick: (event: CalendarEvent, e: React.MouseEvent) => void
  onSlotClick: (day: Date) => void
}

export function MonthView({ currentMonth, events, onDayClick, onEventClick, onSlotClick }: MonthViewProps) {
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 })
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 })
    return eachDayOfInterval({ start, end })
  }, [currentMonth])

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-gray-200">
        {WEEKDAYS.map((d, i) => (
          <div key={d} className={`py-2 text-center text-xs font-semibold ${
            i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'
          }`}>
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 flex-1 overflow-y-auto">
        {days.map((day) => {
          const dayEvents = events.filter((e) => eventOccursOnDay(e, day))
          const inMonth = isSameMonth(day, currentMonth)
          const today = isToday(day)
          const isSun = day.getDay() === 0
          const isSat = day.getDay() === 6
          const holiday = getHoliday(day)
          const isHoliday = !!holiday
          const isRed = isSun || isHoliday

          return (
            <div
              key={day.toISOString()}
              className={`flex min-h-[72px] flex-col border-b border-r border-gray-100 sm:min-h-[90px] md:min-h-[110px] ${
                !inMonth
                  ? 'bg-gray-50/60'
                  : isHoliday && !isSun && !isSat
                  ? 'bg-red-50/30 hover:bg-red-50/60'
                  : 'bg-white hover:bg-gray-50/40'
              } transition-colors`}
            >
              {/* Day number + holiday name */}
              <button
                onClick={() => onDayClick(day)}
                className="flex items-center gap-1 px-2 pt-1.5 pb-0.5"
              >
                <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                  today
                    ? 'bg-indigo-600 text-white'
                    : !inMonth
                    ? 'text-gray-300'
                    : isRed
                    ? 'text-red-500 hover:bg-red-50'
                    : isSat
                    ? 'text-blue-500 hover:bg-blue-50'
                    : 'text-gray-800 hover:bg-gray-100'
                }`}>
                  {format(day, 'd')}
                </span>
                {holiday && (
                  <span className={`hidden truncate text-[10px] font-medium leading-tight sm:inline ${!inMonth ? 'text-red-300' : 'text-red-500'}`}>
                    {holiday.name}
                  </span>
                )}
              </button>

              {/* Events */}
              <div className="flex flex-col gap-0.5 px-1 pb-1 flex-1 overflow-hidden">
                {dayEvents.slice(0, 3).map((ev) => (
                  <button
                    key={ev.id}
                    onClick={(e) => { e.stopPropagation(); onEventClick(ev, e) }}
                    className="truncate rounded px-1 py-0.5 text-left text-[10px] font-medium text-white hover:opacity-80 active:opacity-70 sm:text-[11px]"
                    style={{ backgroundColor: ev.color }}
                    title={ev.ownerName ? `${ev.ownerName}: ${ev.title}` : ev.title}
                  >
                    {!ev.allDay && (
                      <span className="opacity-70 mr-1">
                        {format(new Date(ev.startAt), 'H:mm')}
                      </span>
                    )}
                    {ev.ownerName && (
                      <span className="opacity-75 mr-0.5">[{ev.ownerName.charAt(0)}]</span>
                    )}
                    {ev.title}
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <button
                    onClick={() => onDayClick(day)}
                    className="text-left text-[11px] text-gray-500 hover:text-indigo-600 px-1"
                  >
                    他{dayEvents.length - 3}件
                  </button>
                )}
                {dayEvents.length < 3 && (
                  <button
                    onClick={() => onSlotClick(day)}
                    className="flex-1 min-h-[8px]"
                    aria-label="予定を追加"
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

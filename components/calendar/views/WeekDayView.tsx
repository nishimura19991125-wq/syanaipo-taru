'use client'

import { useEffect, useMemo, useRef } from 'react'
import {
  addDays, eachDayOfInterval, format,
  isToday, startOfWeek,
} from 'date-fns'
import { ja } from 'date-fns/locale'
import { CalendarEvent } from '@/types/calendar'
import { getHoliday } from '@/lib/holidays'

const PX_PER_HOUR = 64
const PX_PER_MIN = PX_PER_HOUR / 60
const HOURS = Array.from({ length: 24 }, (_, i) => i)

function minutesFromMidnight(date: Date) {
  return date.getHours() * 60 + date.getMinutes()
}

function layoutEvents(dayEvents: CalendarEvent[]) {
  const timed = dayEvents
    .filter((e) => !e.allDay)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())

  type LayoutEvent = CalendarEvent & { col: number; totalCols: number; startMin: number; endMin: number }
  const result: LayoutEvent[] = []
  const columns: number[] = []

  for (const ev of timed) {
    const startMin = minutesFromMidnight(new Date(ev.startAt))
    const endMin = ev.endAt ? minutesFromMidnight(new Date(ev.endAt)) : startMin + 60

    let col = columns.findIndex((colEnd) => colEnd <= startMin)
    if (col === -1) col = columns.length
    columns[col] = endMin
    result.push({ ...ev, col, totalCols: 1, startMin, endMin })
  }

  for (const ev of result) {
    const overlapping = result.filter(
      (other) => other.startMin < ev.endMin && other.endMin > ev.startMin
    )
    const maxCol = Math.max(...overlapping.map((o) => o.col)) + 1
    result.forEach((e) => { if (e.id === ev.id) e.totalCols = maxCol })
  }

  return result
}

interface WeekDayViewProps {
  baseDate: Date
  mode: 'week' | 'day'
  events: CalendarEvent[]
  onSlotClick: (date: Date) => void
  onEventClick: (event: CalendarEvent, e: React.MouseEvent) => void
}

export function WeekDayView({ baseDate, mode, events, onSlotClick, onEventClick }: WeekDayViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const days = useMemo(() => {
    if (mode === 'day') return [baseDate]
    const weekStart = startOfWeek(baseDate, { weekStartsOn: 0 })
    return eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) })
  }, [baseDate, mode])

  useEffect(() => {
    const now = new Date()
    const scrollTop = (now.getHours() * 60 + now.getMinutes()) * PX_PER_MIN - 80
    scrollRef.current?.scrollTo({ top: Math.max(0, scrollTop) })
  }, [])

  const currentMinute = new Date().getHours() * 60 + new Date().getMinutes()

  function eventsOnDay(day: Date) {
    return events.filter((e) => {
      const start = new Date(e.startAt)
      const end = e.endAt ? new Date(e.endAt) : start
      const ds = new Date(day.getFullYear(), day.getMonth(), day.getDate())
      const de = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59)
      return start <= de && end >= ds
    })
  }

  function handleSlotClick(day: Date, hour: number) {
    const d = new Date(day)
    d.setHours(hour, 0, 0, 0)
    onSlotClick(d)
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Day headers */}
      <div className="sticky top-0 z-10 flex overflow-x-auto border-b border-gray-200 bg-white">
        <div className="w-10 shrink-0 sm:w-14" />
        <div className="flex min-w-0 flex-1">
        {days.map((day) => {
          const isSun = day.getDay() === 0
          const isSat = day.getDay() === 6
          const today = isToday(day)
          const holiday = getHoliday(day)
          const isRed = isSun || !!holiday

          return (
            <div
              key={day.toISOString()}
              className={`min-w-[48px] flex-1 text-center py-1 border-l border-gray-100 sm:min-w-0 sm:py-1.5 ${
                !!holiday && !isSun && !isSat ? 'bg-red-50/50' : ''
              }`}
            >
              <div className={`text-[10px] font-medium sm:text-[11px] ${isRed ? 'text-red-500' : isSat ? 'text-blue-500' : 'text-gray-500'}`}>
                {format(day, 'E', { locale: ja })}
              </div>
              <div className={`mx-auto inline-flex h-8 w-8 items-center justify-center rounded-full text-base font-semibold sm:h-9 sm:w-9 sm:text-xl ${
                today ? 'bg-indigo-600 text-white' : isRed ? 'text-red-500' : isSat ? 'text-blue-500' : 'text-gray-900'
              }`}>
                {format(day, 'd')}
              </div>
              {holiday && (
                <div className="hidden truncate px-1 pb-0.5 text-[10px] font-medium leading-tight text-red-500 sm:block">
                  {holiday.name}
                </div>
              )}
            </div>
          )
        })}
        </div>
      </div>

      {/* All-day / holiday row */}
      {(() => {
        const allDayRows = days.map((day) => ({
          events: eventsOnDay(day).filter((e) => e.allDay),
          holiday: getHoliday(day),
        }))
        const hasAny = allDayRows.some((r) => r.events.length > 0 || r.holiday)
        if (!hasAny) return null

        return (
          <div className="flex overflow-x-auto border-b border-gray-200 bg-gray-50/50">
            <div className="w-10 shrink-0 py-1 pr-1 pt-2 text-right text-[10px] text-gray-400 sm:w-14 sm:pr-2">終日</div>
            <div className="flex min-w-0 flex-1">
            {allDayRows.map(({ events: dayEvs, holiday }, i) => (
              <div key={i} className="min-w-[48px] flex-1 border-l border-gray-100 px-0.5 py-1 sm:min-w-0">
                {/* Holiday chip */}
                {holiday && (
                  <div className="truncate rounded px-1.5 py-0.5 text-[11px] font-medium text-white bg-red-500/90">
                    {holiday.name}
                  </div>
                )}
                {/* All-day events */}
                {dayEvs.map((ev) => (
                  <button
                    key={ev.id}
                    onClick={(e) => { e.stopPropagation(); onEventClick(ev, e) }}
                    className="mb-0.5 truncate rounded px-1 py-0.5 text-left text-[10px] font-medium text-white hover:opacity-80 sm:text-[11px]"
                    style={{ backgroundColor: ev.color }}
                    title={ev.ownerName ? `${ev.ownerName}: ${ev.title}` : ev.title}
                  >
                    {ev.ownerName && <span className="opacity-75">[{ev.ownerName.charAt(0)}] </span>}
                    {ev.title}
                  </button>
                ))}
              </div>
            ))}
            </div>
          </div>
        )
      })()}

      {/* Time grid */}
      <div ref={scrollRef} className="relative flex-1 overflow-y-auto overflow-x-auto">
        <div className="flex min-w-full" style={{ height: 24 * PX_PER_HOUR }}>
          <div className="relative w-10 shrink-0 sm:w-14">
            {HOURS.map((h) => (
              <div
                key={h}
                className="absolute right-2 text-[10px] text-gray-400 -translate-y-2"
                style={{ top: h * PX_PER_HOUR }}
              >
                {h === 0 ? '' : `${h}:00`}
              </div>
            ))}
          </div>

          <div className="flex min-w-0 flex-1">
          {days.map((day) => {
            const dayEvs = eventsOnDay(day)
            const layouted = layoutEvents(dayEvs)
            const today = isToday(day)
            const holiday = getHoliday(day)
            const isSun = day.getDay() === 0
            const isSat = day.getDay() === 6
            const isRed = isSun || !!holiday

            return (
              <div
                key={day.toISOString()}
                className={`relative min-w-[48px] flex-1 border-l border-gray-100 sm:min-w-0 ${
                  !!holiday && !isSun && !isSat ? 'bg-red-50/20' : ''
                }`}
              >
                {/* Hour slots */}
                {HOURS.map((h) => (
                  <div
                    key={h}
                    onClick={() => handleSlotClick(day, h)}
                    className={`border-t border-gray-100 transition-colors ${
                      isRed ? 'hover:bg-red-50/40' : 'hover:bg-indigo-50/30'
                    } cursor-pointer`}
                    style={{ height: PX_PER_HOUR }}
                  >
                    <div className="border-t border-gray-100/50 border-dashed" style={{ marginTop: PX_PER_HOUR / 2 }} />
                  </div>
                ))}

                {/* Current time indicator */}
                {today && (
                  <div
                    className="absolute left-0 right-0 z-10 pointer-events-none"
                    style={{ top: currentMinute * PX_PER_MIN }}
                  >
                    <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-red-500" />
                    <div className="border-t-2 border-red-500 w-full" />
                  </div>
                )}

                {/* Timed events */}
                {layouted.map((ev) => {
                  const top = ev.startMin * PX_PER_MIN
                  const height = Math.max((ev.endMin - ev.startMin) * PX_PER_MIN, 20)
                  const colW = 100 / ev.totalCols
                  const left = ev.col * colW

                  return (
                    <button
                      key={ev.id}
                      onClick={(e) => { e.stopPropagation(); onEventClick(ev, e) }}
                      className="absolute rounded-lg text-white text-[11px] px-1.5 overflow-hidden hover:opacity-90 transition-opacity shadow-sm"
                      style={{
                        top, height: height - 2,
                        left: `calc(${left}% + 2px)`,
                        width: `calc(${colW}% - 4px)`,
                        backgroundColor: ev.color,
                        zIndex: 5,
                      }}
                      title={ev.ownerName ? `${ev.ownerName}: ${ev.title}` : ev.title}
                    >
                      <div className="font-medium leading-tight truncate">
                        {ev.ownerName && <span className="opacity-75">[{ev.ownerName.charAt(0)}] </span>}
                        {ev.title}
                      </div>
                      {height >= 30 && (
                        <div className="opacity-75 text-[10px] leading-tight">
                          {ev.ownerName ? `${ev.ownerName} · ` : ''}
                          {format(new Date(ev.startAt), 'HH:mm')}
                          {ev.endAt && ` – ${format(new Date(ev.endAt), 'HH:mm')}`}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}
          </div>
        </div>
      </div>
    </div>
  )
}

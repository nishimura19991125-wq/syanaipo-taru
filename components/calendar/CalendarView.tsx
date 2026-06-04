'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  addDays, addMonths, addWeeks, format,
  startOfMonth, startOfWeek, subDays, subMonths, subWeeks,
} from 'date-fns'
import { ja } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Filter, Plus, Search } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Sheet } from '@/components/ui/Sheet'
import { CalendarSidebar } from '@/components/calendar/CalendarSidebar'
import { EventForm } from '@/components/calendar/EventForm'
import { EventPopover } from '@/components/calendar/EventPopover'
import { MonthView } from '@/components/calendar/views/MonthView'
import { WeekDayView } from '@/components/calendar/views/WeekDayView'
import { getMemberColor } from '@/lib/memberColors'
import { useAuth } from '@/contexts/AuthContext'
import { useIsMobile } from '@/hooks/useMediaQuery'
import type { CalendarEvent, CalendarEventInput, EventCategory } from '@/types/calendar'

type ViewMode = 'month' | 'week' | 'day'

interface PopoverState {
  event: CalendarEvent
  rect: DOMRect
}

interface Member {
  id: string
  name: string | null
  email: string
  role: string
}

export function CalendarView() {
  const { user: me } = useAuth()
  const isMobile = useIsMobile()
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)

  const [showForm, setShowForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [defaultDate, setDefaultDate] = useState<string | undefined>()
  const [defaultTime, setDefaultTime] = useState<string | undefined>()

  const [popover, setPopover] = useState<PopoverState | null>(null)
  const [filterCategory, setFilterCategory] = useState<EventCategory | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  const [members, setMembers] = useState<Member[]>([])
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (isMobile && viewMode === 'week') setViewMode('day')
  }, [isMobile, viewMode])

  useEffect(() => {
    fetch('/api/users')
      .then((r) => r.json())
      .then((d) => { if (d.users) setMembers(d.users) })
      .catch(() => {})
  }, [])

  const loadEvents = useCallback(async () => {
    setLoading(true)
    try {
      const from = new Date(currentDate)
      from.setDate(1)
      from.setMonth(from.getMonth() - 1)
      const to = new Date(currentDate)
      to.setDate(1)
      to.setMonth(to.getMonth() + 2)
      to.setDate(0)

      const params = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
      })
      if (selectedMemberIds.size > 0) {
        params.set('userIds', Array.from(selectedMemberIds).join(','))
      }

      const res = await fetch(`/api/calendar?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setEvents(data.events)
    } catch {
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [currentDate, selectedMemberIds])

  useEffect(() => { loadEvents() }, [loadEvents])

  const eventsWithColors = events.map((e) => {
    if (!me || e.userId === me.id) return e
    return { ...e, color: getMemberColor(e.userId) }
  })

  const filteredEvents = eventsWithColors.filter((e) => {
    if (filterCategory !== 'all' && e.category !== filterCategory) return false
    if (searchQuery && !e.title.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  function navigate(dir: -1 | 1) {
    setCurrentDate((d) => {
      if (viewMode === 'month') return dir === 1 ? addMonths(d, 1) : subMonths(d, 1)
      if (viewMode === 'week') return dir === 1 ? addWeeks(d, 1) : subWeeks(d, 1)
      return dir === 1 ? addDays(d, 1) : subDays(d, 1)
    })
  }

  function getHeaderTitle() {
    if (viewMode === 'month') return format(startOfMonth(currentDate), 'yyyy年M月', { locale: ja })
    if (viewMode === 'week') {
      const ws = startOfWeek(currentDate, { weekStartsOn: 0 })
      const we = addDays(ws, 6)
      if (ws.getMonth() === we.getMonth()) {
        return format(ws, 'yyyy年M月d日', { locale: ja }) + ' – ' + format(we, 'd日', { locale: ja })
      }
      return format(ws, 'yyyy年M月d日', { locale: ja }) + ' – ' + format(we, 'M月d日', { locale: ja })
    }
    return format(currentDate, 'M月d日（E）', { locale: ja })
  }

  const createEvent = async (data: CalendarEventInput) => {
    const res = await fetch('/api/calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || '保存に失敗しました')
    await loadEvents()
    setShowForm(false)
  }

  const updateEvent = async (data: CalendarEventInput) => {
    if (!editingEvent) return
    const res = await fetch(`/api/calendar/${editingEvent.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || '更新に失敗しました')
    await loadEvents()
    setShowForm(false)
    setEditingEvent(null)
  }

  const deleteEvent = async (event: CalendarEvent) => {
    const res = await fetch(`/api/calendar/${event.id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('削除に失敗しました')
    await loadEvents()
  }

  function openNewEvent(date?: Date, hour?: number) {
    setEditingEvent(null)
    if (date) {
      setDefaultDate(format(date, 'yyyy-MM-dd'))
      setDefaultTime(hour !== undefined ? `${String(hour).padStart(2, '0')}:00` : undefined)
    } else {
      setDefaultDate(undefined)
      setDefaultTime(undefined)
    }
    setShowForm(true)
  }

  function openEditEvent(event: CalendarEvent) {
    if (me && event.userId !== me.id) return
    setEditingEvent(event)
    setShowForm(true)
    setPopover(null)
  }

  function handleEventClick(event: CalendarEvent, e: React.MouseEvent) {
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setPopover({ event, rect })
  }

  function handleSlotClick(date: Date) {
    openNewEvent(date, date.getHours() || undefined)
  }

  function handleDayClick(day: Date) {
    setCurrentDate(day)
    setViewMode('day')
  }

  function toggleMember(id: string) {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const sidebarProps = {
    currentDate,
    events: filteredEvents,
    me,
    members,
    selectedMemberIds,
    filterCategory,
    onSelectDate: setCurrentDate,
    onToggleMember: toggleMember,
    onClearMembers: () => setSelectedMemberIds(new Set()),
    onFilterCategory: setFilterCategory,
    onCreate: () => openNewEvent(),
  }

  const viewModes: ViewMode[] = isMobile ? ['day', 'month'] : ['day', 'week', 'month']

  return (
    <div className="flex h-[calc(100dvh-7rem)] lg:h-[calc(100dvh-0px)] overflow-hidden bg-white lg:bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col overflow-y-auto border-r border-gray-200 bg-white p-4 lg:flex">
        <CalendarSidebar {...sidebarProps} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white">
        {/* Toolbar */}
        <div className="shrink-0 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-1.5 px-3 py-2 sm:gap-2 sm:px-4">
            <button
              onClick={() => setCurrentDate(new Date())}
              className="shrink-0 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 sm:px-3 sm:text-sm"
            >
              今日
            </button>
            <div className="flex shrink-0 items-center">
              <button onClick={() => navigate(-1)} className="rounded-full p-1.5 text-gray-600 hover:bg-gray-100 active:bg-gray-200">
                <ChevronLeft size={20} />
              </button>
              <button onClick={() => navigate(1)} className="rounded-full p-1.5 text-gray-600 hover:bg-gray-100 active:bg-gray-200">
                <ChevronRight size={20} />
              </button>
            </div>
            <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900 sm:text-base md:text-lg">
              {getHeaderTitle()}
            </h2>
            <button
              onClick={() => setShowFilters(true)}
              className="rounded-full p-2 text-gray-600 hover:bg-gray-100 active:bg-gray-200 lg:hidden"
              aria-label="フィルター"
            >
              <Filter size={18} />
            </button>
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="rounded-full p-2 text-gray-600 hover:bg-gray-100 active:bg-gray-200"
              aria-label="検索"
            >
              <Search size={18} />
            </button>
            <button
              onClick={() => openNewEvent()}
              className="rounded-full bg-indigo-600 p-2 text-white hover:bg-indigo-700 active:bg-indigo-800 lg:hidden"
              aria-label="予定を追加"
            >
              <Plus size={18} />
            </button>
          </div>

          {showSearch && (
            <div className="border-t border-gray-100 px-3 py-2 sm:px-4">
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="予定を検索..."
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          <div className="flex items-center justify-between border-t border-gray-100 px-3 py-1.5 sm:px-4">
            <div className="flex items-center rounded-lg bg-gray-100 p-0.5">
              {viewModes.map((m) => (
                <button
                  key={m}
                  onClick={() => setViewMode(m)}
                  className={`min-w-[44px] rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm ${
                    viewMode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {m === 'day' ? '日' : m === 'week' ? '週' : '月'}
                </button>
              ))}
            </div>
            {selectedMemberIds.size > 0 && (
              <span className="text-[11px] text-indigo-600 sm:text-xs">
                {selectedMemberIds.size}人表示中
              </span>
            )}
          </div>
        </div>

        {loading && <div className="h-0.5 shrink-0 animate-pulse bg-indigo-500" />}

        <div className="flex-1 overflow-hidden">
          {viewMode === 'month' && (
            <MonthView
              currentMonth={startOfMonth(currentDate)}
              events={filteredEvents}
              onDayClick={handleDayClick}
              onEventClick={handleEventClick}
              onSlotClick={handleSlotClick}
            />
          )}
          {(viewMode === 'week' || viewMode === 'day') && (
            <WeekDayView
              baseDate={currentDate}
              mode={viewMode}
              events={filteredEvents}
              onSlotClick={handleSlotClick}
              onEventClick={handleEventClick}
            />
          )}
        </div>
      </div>

      {/* Mobile filter sheet */}
      <Sheet open={showFilters} onClose={() => setShowFilters(false)} title="フィルター" side="left">
        <CalendarSidebar {...sidebarProps} />
      </Sheet>

      {popover && (
        <EventPopover
          event={popover.event}
          anchorRect={popover.rect}
          onClose={() => setPopover(null)}
          onEdit={() => openEditEvent(popover.event)}
          onDelete={() => deleteEvent(popover.event).then(() => setPopover(null))}
          isOwn={me ? popover.event.userId === me.id : false}
        />
      )}

      <Modal
        open={showForm}
        onClose={() => { setShowForm(false); setEditingEvent(null) }}
        title={editingEvent ? '予定を編集' : '予定を作成'}
        maxWidth="max-w-xl"
      >
        <EventForm
          initialDate={defaultDate ?? (editingEvent ? undefined : format(currentDate, 'yyyy-MM-dd'))}
          initialTime={defaultTime}
          event={editingEvent ?? undefined}
          onSubmit={editingEvent ? updateEvent : createEvent}
          onDelete={editingEvent ? () => deleteEvent(editingEvent).then(() => { setShowForm(false); setEditingEvent(null) }) : undefined}
          onCancel={() => { setShowForm(false); setEditingEvent(null) }}
        />
      </Modal>
    </div>
  )
}

'use client'

import { Plus } from 'lucide-react'
import { MiniCalendar } from '@/components/calendar/MiniCalendar'
import { getMemberColor } from '@/lib/memberColors'
import type { CalendarEvent, EventCategory } from '@/types/calendar'
import { EVENT_CATEGORY_LABELS } from '@/types/calendar'

interface Member {
  id: string
  name: string | null
  email: string
  role: string
}

interface CalendarSidebarProps {
  currentDate: Date
  events: CalendarEvent[]
  me: { id: string; name: string | null; email: string } | null
  members: Member[]
  selectedMemberIds: Set<string>
  filterCategory: EventCategory | 'all'
  onSelectDate: (d: Date) => void
  onToggleMember: (id: string) => void
  onClearMembers: () => void
  onFilterCategory: (c: EventCategory | 'all') => void
  onCreate: () => void
}

export function CalendarSidebar({
  currentDate,
  events,
  me,
  members,
  selectedMemberIds,
  filterCategory,
  onSelectDate,
  onToggleMember,
  onClearMembers,
  onFilterCategory,
  onCreate,
}: CalendarSidebarProps) {
  const otherMembers = members.filter((m) => m.id !== me?.id)

  return (
    <div className="flex flex-col gap-5">
      <button
        onClick={onCreate}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-gray-700 shadow-sm transition-shadow hover:shadow-md active:scale-[0.98]"
      >
        <Plus size={18} className="text-indigo-600" />
        予定を作成
      </button>

      <MiniCalendar
        selectedDate={currentDate}
        onSelect={onSelectDate}
        hasEventOn={(d) =>
          events.some((e) => {
            const start = new Date(e.startAt)
            const end = e.endAt ? new Date(e.endAt) : start
            const ds = new Date(d.getFullYear(), d.getMonth(), d.getDate())
            const de = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59)
            return start <= de && end >= ds
          })
        }
      />

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">マイカレンダー</p>
        <div className="flex items-center gap-2 rounded-lg px-2 py-1.5">
          <span className="h-3 w-3 rounded-sm bg-indigo-600" />
          <span className="truncate text-sm text-gray-700">{me?.name ?? me?.email}</span>
        </div>
      </div>

      {otherMembers.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">メンバー</p>
            {selectedMemberIds.size > 0 && (
              <button onClick={onClearMembers} className="text-[10px] text-gray-400 hover:text-gray-600">
                すべて非表示
              </button>
            )}
          </div>
          <div className="flex flex-col gap-0.5">
            {otherMembers.map((m) => {
              const checked = selectedMemberIds.has(m.id)
              const color = getMemberColor(m.id)
              return (
                <label key={m.id} className="group flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 hover:bg-gray-50 active:bg-gray-100">
                  <input type="checkbox" checked={checked} onChange={() => onToggleMember(m.id)} className="sr-only" />
                  <div
                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border-2"
                    style={{ backgroundColor: checked ? color : 'transparent', borderColor: color }}
                  >
                    {checked && (
                      <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 12 12">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <span className="truncate text-sm text-gray-700">{m.name ?? m.email}</span>
                  {m.role === 'admin' && (
                    <span className="ml-auto shrink-0 text-[10px] font-medium text-amber-500">管理者</span>
                  )}
                </label>
              )
            })}
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">カテゴリ</p>
        <div className="flex flex-col gap-0.5">
          <button
            onClick={() => onFilterCategory('all')}
            className={`rounded-lg px-2 py-2 text-left text-sm transition-colors ${
              filterCategory === 'all' ? 'bg-indigo-50 font-medium text-indigo-700' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            すべて
          </button>
          {(Object.entries(EVENT_CATEGORY_LABELS) as [EventCategory, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => onFilterCategory(key)}
              className={`rounded-lg px-2 py-2 text-left text-sm transition-colors ${
                filterCategory === key ? 'bg-indigo-50 font-medium text-indigo-700' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

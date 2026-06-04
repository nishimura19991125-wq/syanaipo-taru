'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  CalendarEvent,
  CalendarEventInput,
  EventCategory,
  RecurrenceType,
  EVENT_CATEGORY_LABELS,
  EVENT_CATEGORY_COLORS,
} from '@/types/calendar'

const RECURRENCE_LABELS: Record<RecurrenceType, string> = {
  none: '繰り返しなし',
  daily: '毎日',
  weekly: '毎週',
  monthly: '毎月',
  yearly: '毎年',
}

function toDateInputValue(iso: string) {
  return iso.slice(0, 10)
}

function toTimeInputValue(iso: string) {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function buildIso(date: string, time: string, allDay: boolean) {
  if (allDay) return new Date(`${date}T00:00:00`).toISOString()
  return new Date(`${date}T${time}:00`).toISOString()
}

function buildEndIso(date: string, time: string, allDay: boolean) {
  if (allDay) return new Date(`${date}T23:59:59`).toISOString()
  return new Date(`${date}T${time}:00`).toISOString()
}

interface EventFormProps {
  initialDate?: string
  initialTime?: string
  event?: CalendarEvent
  onSubmit: (data: CalendarEventInput) => Promise<void>
  onDelete?: () => Promise<void>
  onCancel: () => void
}

export function EventForm({ initialDate, initialTime, event, onSubmit, onDelete, onCancel }: EventFormProps) {
  const defaultDate = initialDate ?? toDateInputValue(new Date().toISOString())
  const hasTime = !!initialTime
  const [title, setTitle] = useState(event?.title ?? '')
  const [description, setDescription] = useState(event?.description ?? '')
  const [category, setCategory] = useState<EventCategory>(event?.category ?? 'other')
  const [recurrence, setRecurrence] = useState<RecurrenceType>(event?.recurrence ?? 'none')
  const [startDate, setStartDate] = useState(event ? toDateInputValue(event.startAt) : defaultDate)
  const [endDate, setEndDate] = useState(event?.endAt ? toDateInputValue(event.endAt) : defaultDate)
  const [startTime, setStartTime] = useState(event && !event.allDay ? toTimeInputValue(event.startAt) : (initialTime ?? '09:00'))
  const [endTime, setEndTime] = useState(() => {
    if (event?.endAt && !event.allDay) return toTimeInputValue(event.endAt)
    if (initialTime) {
      const [h] = initialTime.split(':').map(Number)
      return `${String(Math.min(h + 1, 23)).padStart(2, '0')}:00`
    }
    return '10:00'
  })
  const [allDay, setAllDay] = useState(event?.allDay ?? !hasTime)
  const [useCustomColor, setUseCustomColor] = useState(
    !!event?.color && !Object.values(EVENT_CATEGORY_COLORS).includes(event.color)
  )
  const [customColor, setCustomColor] = useState(event?.color ?? '#4F46E5')
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const effectiveColor = useCustomColor ? customColor : EVENT_CATEGORY_COLORS[category]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!title.trim()) { setError('タイトルを入力してください'); return }
    setLoading(true)
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        startAt: buildIso(startDate, startTime, allDay),
        endAt: allDay ? buildEndIso(endDate, '23:59', true) : buildEndIso(endDate, endTime, false),
        allDay,
        color: effectiveColor,
        category,
        recurrence,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!onDelete || !confirm('この予定を削除しますか？')) return
    setDeleting(true)
    try { await onDelete() } catch (err) {
      setError(err instanceof Error ? err.message : '削除に失敗しました')
      setDeleting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="タイトル"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="会議名・タスク名など"
        required
      />

      {/* Category */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">カテゴリ</label>
        <div className="grid grid-cols-3 gap-1.5">
          {(Object.entries(EVENT_CATEGORY_LABELS) as [EventCategory, string][]).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => { setCategory(key); setUseCustomColor(false) }}
              className={`rounded-lg px-2 py-1.5 text-xs font-medium border transition-all ${
                category === key && !useCustomColor
                  ? 'border-transparent text-white shadow-sm'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300 bg-white'
              }`}
              style={category === key && !useCustomColor ? { backgroundColor: EVENT_CATEGORY_COLORS[key] } : {}}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Color override */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={useCustomColor}
            onChange={(e) => setUseCustomColor(e.target.checked)}
            className="rounded border-gray-300 text-indigo-600"
          />
          カスタムカラー
        </label>
        {useCustomColor && (
          <input
            type="color"
            value={customColor}
            onChange={(e) => setCustomColor(e.target.value)}
            className="h-8 w-16 rounded border border-gray-300 cursor-pointer"
          />
        )}
        {!useCustomColor && (
          <span
            className="inline-block h-5 w-5 rounded-full border border-white shadow"
            style={{ backgroundColor: effectiveColor }}
          />
        )}
      </div>

      {/* Dates */}
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={allDay}
          onChange={(e) => setAllDay(e.target.checked)}
          className="rounded border-gray-300 text-indigo-600"
        />
        終日
      </label>
      <div className="grid grid-cols-2 gap-3">
        <Input label="開始日" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        <Input label="終了日" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
      </div>
      {!allDay && (
        <div className="grid grid-cols-2 gap-3">
          <Input label="開始時刻" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
          <Input label="終了時刻" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
        </div>
      )}

      {/* Recurrence */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">繰り返し</label>
        <div className="flex flex-wrap gap-1.5">
          {(Object.entries(RECURRENCE_LABELS) as [RecurrenceType, string][]).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setRecurrence(key)}
              className={`rounded-full px-3 py-1 text-xs font-medium border transition-all ${
                recurrence === key
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300 bg-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Memo */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">メモ（任意）</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="詳細・備考など"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap gap-2 justify-end pt-2 border-t border-gray-100">
        {onDelete && (
          <Button type="button" variant="danger" onClick={handleDelete} loading={deleting}>
            削除
          </Button>
        )}
        <Button type="button" variant="secondary" onClick={onCancel}>キャンセル</Button>
        <Button type="submit" loading={loading}>{event ? '更新' : '追加'}</Button>
      </div>
    </form>
  )
}

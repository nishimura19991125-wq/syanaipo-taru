'use client'

import { useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { X, Pencil, Trash2, RotateCcw, User } from 'lucide-react'
import { CalendarEvent, EVENT_CATEGORY_LABELS, EventCategory } from '@/types/calendar'
import { useIsMobile } from '@/hooks/useMediaQuery'

const RECURRENCE_LABELS: Record<string, string> = {
  daily: '毎日繰り返し', weekly: '毎週繰り返し',
  monthly: '毎月繰り返し', yearly: '毎年繰り返し',
}

interface EventPopoverProps {
  event: CalendarEvent
  anchorRect: DOMRect
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  isOwn?: boolean
}

function EventDetails({ event, isOwn, onEdit, onDelete, onClose }: Omit<EventPopoverProps, 'anchorRect'>) {
  const start = new Date(event.startAt)
  const end = event.endAt ? new Date(event.endAt) : null

  return (
    <>
      <div className="px-4 py-3 flex items-start justify-between" style={{ backgroundColor: event.color }}>
        <div className="flex-1 min-w-0 pr-2">
          <p className="font-semibold text-white text-base leading-snug">{event.title}</p>
          {event.category && event.category !== 'other' && (
            <p className="text-white/80 text-xs mt-0.5">
              {EVENT_CATEGORY_LABELS[event.category as EventCategory]}
            </p>
          )}
        </div>
        <button onClick={onClose} className="shrink-0 rounded-lg p-1 text-white/80 hover:bg-white/10 hover:text-white">
          <X size={18} />
        </button>
      </div>

      <div className="space-y-3 px-4 py-4">
        {!isOwn && event.ownerName && (
          <div className="flex items-center gap-1.5 text-sm font-medium text-indigo-600">
            <User size={14} />
            {event.ownerName}
          </div>
        )}

        <p className="text-sm text-gray-700">
          {event.allDay
            ? `${format(start, 'M月d日（E）', { locale: ja })} 終日`
            : `${format(start, 'M月d日（E）HH:mm', { locale: ja })}${end ? ` – ${format(end, 'HH:mm')}` : ''}`}
        </p>

        {event.recurrence && event.recurrence !== 'none' && (
          <p className="flex items-center gap-1 text-xs text-gray-500">
            <RotateCcw size={12} />
            {RECURRENCE_LABELS[event.recurrence] ?? event.recurrence}
          </p>
        )}

        {event.description && (
          <p className="whitespace-pre-wrap text-sm text-gray-600">{event.description}</p>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {isOwn ? (
          <>
            <button
              onClick={() => { onEdit(); onClose() }}
              className="flex min-h-[44px] items-center gap-2 rounded-lg px-3 text-sm font-medium text-gray-700 hover:bg-gray-100 active:bg-gray-200"
            >
              <Pencil size={16} /> 編集
            </button>
            <button
              onClick={() => {
                if (confirm(`「${event.title}」を削除しますか？`)) { onDelete(); onClose() }
              }}
              className="flex min-h-[44px] items-center gap-2 rounded-lg px-3 text-sm font-medium text-red-600 hover:bg-red-50 active:bg-red-100"
            >
              <Trash2 size={16} /> 削除
            </button>
          </>
        ) : (
          <p className="text-sm text-gray-400">
            {event.ownerName ?? 'メンバー'}の予定（閲覧のみ）
          </p>
        )}
      </div>
    </>
  )
}

export function EventPopover({ event, anchorRect, onClose, onEdit, onDelete, isOwn = true }: EventPopoverProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isMobile = useIsMobile()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const kh = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', kh)
    if (isMobile) document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', kh)
      if (isMobile) document.body.style.overflow = ''
    }
  }, [onClose, isMobile])

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div
          ref={ref}
          className="absolute inset-x-0 bottom-0 overflow-hidden rounded-t-2xl bg-white shadow-2xl"
        >
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-gray-300" />
          <EventDetails event={event} isOwn={isOwn} onEdit={onEdit} onDelete={onDelete} onClose={onClose} />
        </div>
      </div>
    )
  }

  const popW = 320
  const vw = window.innerWidth
  const vh = window.innerHeight
  let left = anchorRect.right + 8
  let top = anchorRect.top
  if (left + popW > vw - 16) left = anchorRect.left - popW - 8
  if (left < 16) left = 16
  if (top + 280 > vh - 16) top = Math.max(16, vh - 296)

  return (
    <div
      ref={ref}
      className="fixed z-50 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
      style={{ left, top, width: popW }}
    >
      <EventDetails event={event} isOwn={isOwn} onEdit={onEdit} onDelete={onDelete} onClose={onClose} />
    </div>
  )
}

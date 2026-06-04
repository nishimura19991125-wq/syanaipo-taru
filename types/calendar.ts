export type EventCategory = 'meeting' | 'deadline' | 'task' | 'personal' | 'holiday' | 'construction' | 'other'

export const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
  meeting: '会議・打合せ',
  deadline: '締切・期限',
  task: 'タスク・作業',
  personal: '個人・プライベート',
  holiday: '休日・祝日',
  construction: '工事',
  other: 'その他',
}

export const EVENT_CATEGORY_COLORS: Record<EventCategory, string> = {
  meeting: '#4F46E5',
  deadline: '#DC2626',
  task: '#D97706',
  personal: '#16A34A',
  holiday: '#7C3AED',
  construction: '#EA580C',
  other: '#64748B',
}

export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface CalendarEvent {
  id: string
  title: string
  description: string | null
  startAt: string
  endAt: string | null
  allDay: boolean
  color: string
  category: EventCategory
  recurrence: RecurrenceType
  userId: string
  ownerName: string | null
  createdAt: string
  updatedAt: string
}

export interface CalendarEventInput {
  title: string
  description?: string
  startAt: string
  endAt?: string | null
  allDay?: boolean
  color?: string
  category?: EventCategory
  recurrence?: RecurrenceType
}

import { calendarEvents, users } from '@/lib/db'
import type { CalendarEvent } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { sanitizeString } from '@/lib/sanitize'
import { EVENT_CATEGORY_COLORS } from '@/types/calendar'
import { startOfMonth, endOfMonth, parseISO, isValid } from 'date-fns'

const VALID_CATEGORIES = ['meeting', 'deadline', 'task', 'personal', 'holiday', 'construction', 'other']
const VALID_RECURRENCES = ['none', 'daily', 'weekly', 'monthly', 'yearly']

function serializeEvent(e: CalendarEvent, ownerName: string | null = null) {
  return {
    id: e.id,
    title: e.title,
    description: e.description,
    startAt: e.startAt,
    endAt: e.endAt ?? null,
    allDay: e.allDay,
    color: e.color,
    category: e.category ?? 'other',
    recurrence: e.recurrence ?? 'none',
    userId: e.userId,
    ownerName,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  }
}

export async function GET(request: Request) {
  const user = await getSession()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')

  const userIdsParam = searchParams.get('userIds')
  const extraUserIds = userIdsParam
    ? userIdsParam.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 50)
    : []

  let rangeStart: Date
  let rangeEnd: Date

  if (fromParam && toParam) {
    rangeStart = parseISO(fromParam)
    rangeEnd = parseISO(toParam)
    if (!isValid(rangeStart) || !isValid(rangeEnd)) {
      return Response.json({ error: '日付の形式が正しくありません' }, { status: 400 })
    }
  } else {
    const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()), 10)
    const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1), 10)
    if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) {
      return Response.json({ error: '年月が正しくありません' }, { status: 400 })
    }
    const anchor = new Date(year, month - 1, 1)
    rangeStart = startOfMonth(anchor)
    rangeEnd = endOfMonth(anchor)
  }

  // Fetch own events
  const ownEvents = await calendarEvents.findByUsersInRange([user.id], rangeStart, rangeEnd)

  // Fetch other members' events (verify IDs exist, exclude personal for privacy)
  let otherEvents: CalendarEvent[] = []
  const nameMap = new Map<string, string | null>()

  if (extraUserIds.length > 0) {
    const validUsers = await users.findManyByIds(extraUserIds)
    const validIds = new Set(validUsers.map((u) => u.id))
    validUsers.forEach((u) => nameMap.set(u.id, u.name))

    const filteredIds = extraUserIds.filter((id) => validIds.has(id) && id !== user.id)
    if (filteredIds.length > 0) {
      const raw = await calendarEvents.findByUsersInRange(filteredIds, rangeStart, rangeEnd)
      otherEvents = raw.filter((e) => e.category !== 'personal')
    }
  }

  const allEvents = [
    ...ownEvents.flatMap((e) => {
      const base = serializeEvent(e, user.name)
      const expanded = expandRecurring(e, rangeStart, rangeEnd).map((occ) => serializeEvent(occ, user.name))
      return [base, ...expanded]
    }),
    ...otherEvents.flatMap((e) => {
      const ownerName = nameMap.get(e.userId) ?? null
      const base = serializeEvent(e, ownerName)
      const expanded = expandRecurring(e, rangeStart, rangeEnd).map((occ) => serializeEvent(occ, ownerName))
      return [base, ...expanded]
    }),
  ]

  return Response.json({ events: allEvents })
}

function expandRecurring(event: CalendarEvent, rangeStart: Date, rangeEnd: Date): CalendarEvent[] {
  if (!event.recurrence || event.recurrence === 'none') return []
  const results: CalendarEvent[] = []
  const originalStart = new Date(event.startAt)
  const duration = event.endAt ? (new Date(event.endAt).getTime() - originalStart.getTime()) : 0
  const MAX_OCCURRENCES = 60

  let current = new Date(originalStart)
  let count = 0

  while (current <= rangeEnd && count < MAX_OCCURRENCES) {
    advance(current, event.recurrence)
    count++
    if (current >= rangeStart && current <= rangeEnd && current > originalStart) {
      const newStart = new Date(current)
      const newEnd = duration > 0 ? new Date(current.getTime() + duration) : null
      results.push({
        ...event,
        id: `${event.id}_r_${current.getTime()}`,
        startAt: newStart.toISOString(),
        endAt: newEnd ? newEnd.toISOString() : null,
      })
    }
  }
  return results
}

function advance(date: Date, recurrence: string) {
  if (recurrence === 'daily') date.setDate(date.getDate() + 1)
  else if (recurrence === 'weekly') date.setDate(date.getDate() + 7)
  else if (recurrence === 'monthly') date.setMonth(date.getMonth() + 1)
  else if (recurrence === 'yearly') date.setFullYear(date.getFullYear() + 1)
}

export async function POST(request: Request) {
  const user = await getSession()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }

  const title = sanitizeString(body.title, 200).trim()
  const description = sanitizeString(body.description, 2000).trim() || null
  const { startAt, endAt, allDay, color, category, recurrence } = body

  if (!title) return Response.json({ error: 'タイトルを入力してください' }, { status: 400 })
  if (!startAt) return Response.json({ error: '開始日時を入力してください' }, { status: 400 })

  const start = new Date(startAt as string)
  if (Number.isNaN(start.getTime())) {
    return Response.json({ error: '開始日時が正しくありません' }, { status: 400 })
  }

  let end: string | null = null
  if (endAt) {
    const endDate = new Date(endAt as string)
    if (Number.isNaN(endDate.getTime())) {
      return Response.json({ error: '終了日時が正しくありません' }, { status: 400 })
    }
    if (endDate < start) {
      return Response.json({ error: '終了は開始より後にしてください' }, { status: 400 })
    }
    end = endDate.toISOString()
  }

  const validCategory = VALID_CATEGORIES.includes(category as string) ? (category as string) : 'other'
  const validRecurrence = VALID_RECURRENCES.includes(recurrence as string) ? (recurrence as string) : 'none'
  const colorStr = typeof color === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color) ? color : null
  const eventColor = colorStr || EVENT_CATEGORY_COLORS[validCategory as keyof typeof EVENT_CATEGORY_COLORS] || '#4F46E5'

  const event = await calendarEvents.create({
    title, description, startAt: start.toISOString(), endAt: end,
    allDay: Boolean(allDay), color: eventColor,
    category: validCategory, recurrence: validRecurrence, userId: user.id,
  })

  return Response.json({ event: serializeEvent(event, user.name) }, { status: 201 })
}

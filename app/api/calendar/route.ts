import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { sanitizeString } from '@/lib/sanitize'
import { EVENT_CATEGORY_COLORS } from '@/types/calendar'
import { startOfMonth, endOfMonth, parseISO, isValid } from 'date-fns'

const VALID_CATEGORIES = ['meeting', 'deadline', 'task', 'personal', 'holiday', 'construction', 'other']
const VALID_RECURRENCES = ['none', 'daily', 'weekly', 'monthly', 'yearly']

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeEvent(e: any, ownerName: string | null = null) {
  return {
    id: e.id,
    title: e.title,
    description: e.description,
    startAt: e.startAt.toISOString(),
    endAt: e.endAt?.toISOString() ?? null,
    allDay: e.allDay,
    color: e.color,
    category: e.category ?? 'other',
    recurrence: e.recurrence ?? 'none',
    userId: e.userId,
    ownerName: ownerName ?? e.user?.name ?? null,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  }
}

export async function GET(request: Request) {
  const user = await getSession()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')

  // Optional: comma-separated userIds to also fetch (other members' events)
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

  const rangeWhere = {
    startAt: { lte: rangeEnd },
    OR: [
      { endAt: { gte: rangeStart } },
      { endAt: null, startAt: { gte: rangeStart } },
    ],
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prismaAny = prisma as any

  // Fetch own events
  const ownEvents = await prismaAny.calendarEvent.findMany({
    where: { userId: user.id, ...rangeWhere },
    orderBy: { startAt: 'asc' },
  })

  // Fetch other members' events (exclude 'personal' category for privacy)
  let otherEvents: unknown[] = []
  if (extraUserIds.length > 0) {
    // Verify these are real user IDs (security: prevent data fishing)
    const validUsers = await prismaAny.user.findMany({
      where: { id: { in: extraUserIds } },
      select: { id: true, name: true },
    })
    const validIds = new Set(validUsers.map((u: { id: string }) => u.id))
    const nameMap = new Map(validUsers.map((u: { id: string; name: string | null }) => [u.id, u.name]))

    const filteredIds = extraUserIds.filter((id) => validIds.has(id) && id !== user.id)

    if (filteredIds.length > 0) {
      const raw = await prismaAny.calendarEvent.findMany({
        where: {
          userId: { in: filteredIds },
          // Exclude personal events of other users for privacy
          NOT: { category: 'personal' },
          ...rangeWhere,
        },
        orderBy: { startAt: 'asc' },
      })
      otherEvents = raw.map((e: Record<string, unknown>) =>
        ({ ...e, _ownerName: nameMap.get(e.userId as string) ?? null })
      )
    }
  }

  // Expand recurring events
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allEvents: any[] = []

  for (const e of ownEvents) {
    allEvents.push(serializeEvent(e, user.name))
    if (e.recurrence && e.recurrence !== 'none') {
      expandRecurring(e, rangeStart, rangeEnd).forEach((occ) =>
        allEvents.push(serializeEvent(occ, user.name))
      )
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const e of otherEvents as any[]) {
    const { _ownerName, ...rest } = e
    allEvents.push(serializeEvent(rest, _ownerName))
    if (rest.recurrence && rest.recurrence !== 'none') {
      expandRecurring(rest, rangeStart, rangeEnd).forEach((occ) =>
        allEvents.push(serializeEvent(occ, _ownerName))
      )
    }
  }

  return Response.json({ events: allEvents })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function expandRecurring(event: any, rangeStart: Date, rangeEnd: Date) {
  const results = []
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
      results.push({ ...event, id: `${event.id}_r_${current.getTime()}`, startAt: newStart, endAt: newEnd })
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
  if (Number.isNaN(start.getTime())) return Response.json({ error: '開始日時が正しくありません' }, { status: 400 })

  let end: Date | null = null
  if (endAt) {
    end = new Date(endAt as string)
    if (Number.isNaN(end.getTime())) return Response.json({ error: '終了日時が正しくありません' }, { status: 400 })
    if (end < start) return Response.json({ error: '終了は開始より後にしてください' }, { status: 400 })
  }

  const validCategory = VALID_CATEGORIES.includes(category as string) ? (category as string) : 'other'
  const validRecurrence = VALID_RECURRENCES.includes(recurrence as string) ? (recurrence as string) : 'none'
  const eventColor = (color as string) || EVENT_CATEGORY_COLORS[validCategory as keyof typeof EVENT_CATEGORY_COLORS] || '#4F46E5'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const event = await (prisma as any).calendarEvent.create({
    data: { title, description, startAt: start, endAt: end, allDay: Boolean(allDay), color: eventColor, category: validCategory, recurrence: validRecurrence, userId: user.id },
  })

  return Response.json({ event: serializeEvent(event, user.name) }, { status: 201 })
}

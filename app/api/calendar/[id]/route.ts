import { calendarEvents } from '@/lib/db'
import type { CalendarEvent } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { sanitizeString } from '@/lib/sanitize'

function serializeEvent(event: CalendarEvent) {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    startAt: event.startAt,
    endAt: event.endAt ?? null,
    allDay: event.allDay,
    color: event.color,
    category: event.category ?? 'other',
    recurrence: event.recurrence ?? 'none',
    userId: event.userId,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const event = await calendarEvents.findById(id)
  if (!event || event.userId !== user.id) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  return Response.json({ event: serializeEvent(event) })
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const existing = await calendarEvents.findById(id)
  if (!existing || existing.userId !== user.id) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const body = await request.json()
  const VALID_CATEGORIES = ['meeting', 'deadline', 'task', 'personal', 'holiday', 'construction', 'other']
  const VALID_RECURRENCES = ['none', 'daily', 'weekly', 'monthly', 'yearly']

  const updateData: Record<string, unknown> = {}

  if (body.title !== undefined) {
    const title = sanitizeString(body.title, 200).trim()
    if (!title) return Response.json({ error: 'タイトルを入力してください' }, { status: 400 })
    updateData.title = title
  }
  if (body.description !== undefined) {
    updateData.description = sanitizeString(body.description, 2000).trim() || null
  }
  if (body.startAt !== undefined) {
    const start = new Date(body.startAt)
    if (Number.isNaN(start.getTime())) {
      return Response.json({ error: '開始日時が正しくありません' }, { status: 400 })
    }
    updateData.startAt = start.toISOString()
  }
  if (body.endAt !== undefined) {
    if (body.endAt === null) {
      updateData.endAt = null
    } else {
      const end = new Date(body.endAt)
      if (Number.isNaN(end.getTime())) {
        return Response.json({ error: '終了日時が正しくありません' }, { status: 400 })
      }
      updateData.endAt = end.toISOString()
    }
  }
  if (body.allDay !== undefined) updateData.allDay = Boolean(body.allDay)
  if (body.color !== undefined) {
    const color = String(body.color)
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color)) updateData.color = color
  }
  if (body.category !== undefined && VALID_CATEGORIES.includes(body.category as string)) {
    updateData.category = body.category
  }
  if (body.recurrence !== undefined && VALID_RECURRENCES.includes(body.recurrence as string)) {
    updateData.recurrence = body.recurrence
  }

  // Validate start/end ordering
  const startAt = (updateData.startAt as string) ?? existing.startAt
  const endAt = 'endAt' in updateData ? (updateData.endAt as string | null) : existing.endAt
  if (endAt && new Date(endAt) < new Date(startAt)) {
    return Response.json({ error: '終了は開始より後にしてください' }, { status: 400 })
  }

  const event = await calendarEvents.update(id, updateData)
  return Response.json({ event: serializeEvent(event) })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const existing = await calendarEvents.findById(id)
  if (!existing || existing.userId !== user.id) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  await calendarEvents.delete(id)
  return Response.json({ ok: true })
}

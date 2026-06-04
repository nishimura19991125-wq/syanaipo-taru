import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

async function getOwnedEvent(id: string, userId: string) {
  const event = await prisma.calendarEvent.findUnique({ where: { id } })
  if (!event || event.userId !== userId) return null
  return event
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeEvent(event: any) {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    startAt: event.startAt.toISOString(),
    endAt: event.endAt?.toISOString() ?? null,
    allDay: event.allDay,
    color: event.color,
    category: event.category ?? 'other',
    recurrence: event.recurrence ?? 'none',
    userId: event.userId,
    ownerName: event.user?.name ?? null,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const event = await getOwnedEvent(id, user.id)
  if (!event) return Response.json({ error: 'Not found' }, { status: 404 })

  return Response.json({ event: serializeEvent(event) })
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const existing = await getOwnedEvent(id, user.id)
  if (!existing) return Response.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const updateData: Record<string, unknown> = {}

  if (body.title !== undefined) {
    if (!body.title?.trim()) {
      return Response.json({ error: 'タイトルを入力してください' }, { status: 400 })
    }
    updateData.title = body.title.trim()
  }
  if (body.description !== undefined) {
    updateData.description = body.description?.trim() || null
  }
  if (body.startAt !== undefined) {
    const start = new Date(body.startAt)
    if (Number.isNaN(start.getTime())) {
      return Response.json({ error: '開始日時が正しくありません' }, { status: 400 })
    }
    updateData.startAt = start
  }
  if (body.endAt !== undefined) {
    if (body.endAt === null) {
      updateData.endAt = null
    } else {
      const end = new Date(body.endAt)
      if (Number.isNaN(end.getTime())) {
        return Response.json({ error: '終了日時が正しくありません' }, { status: 400 })
      }
      updateData.endAt = end
    }
  }
  if (body.allDay !== undefined) updateData.allDay = Boolean(body.allDay)
  if (body.color !== undefined) updateData.color = body.color
  const VALID_CATEGORIES = ['meeting', 'deadline', 'task', 'personal', 'holiday', 'construction', 'other']
  const VALID_RECURRENCES = ['none', 'daily', 'weekly', 'monthly', 'yearly']
  if (body.category !== undefined && VALID_CATEGORIES.includes(body.category as string)) {
    updateData.category = body.category
  }
  if (body.recurrence !== undefined && VALID_RECURRENCES.includes(body.recurrence as string)) {
    updateData.recurrence = body.recurrence
  }

  const startAt = (updateData.startAt as Date) ?? existing.startAt
  const endAt = updateData.endAt !== undefined
    ? (updateData.endAt as Date | null)
    : existing.endAt
  if (endAt && endAt < startAt) {
    return Response.json({ error: '終了は開始より後にしてください' }, { status: 400 })
  }

  const event = await prisma.calendarEvent.update({
    where: { id },
    data: updateData,
  })

  return Response.json({ event: serializeEvent(event) })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const existing = await getOwnedEvent(id, user.id)
  if (!existing) return Response.json({ error: 'Not found' }, { status: 404 })

  await prisma.calendarEvent.delete({ where: { id } })
  return Response.json({ ok: true })
}

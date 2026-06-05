import { announcements } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { sanitizeString } from '@/lib/sanitize'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }

  const raw = body as Record<string, unknown>
  const title = sanitizeString(raw?.title, 200).trim()
  const content = sanitizeString(raw?.content, 10000).trim()

  if (!title || !content) {
    return Response.json({ error: 'タイトルと内容を入力してください' }, { status: 400 })
  }

  const announcement = await announcements.update(id, { title, content, pinned: Boolean(raw?.pinned) })
  return Response.json({
    announcement: { ...announcement, author: { name: user.name } },
  })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  await announcements.delete(id)
  return Response.json({ ok: true })
}

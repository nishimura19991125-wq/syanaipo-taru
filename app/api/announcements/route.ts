import { announcements, users } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { sanitizeString } from '@/lib/sanitize'

export async function GET() {
  const user = await getSession()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const list = await announcements.findAll()

  // Batch-fetch author names
  const authorIds = [...new Set(list.map((a) => a.authorId))]
  const authorList = await users.findManyByIds(authorIds)
  const authorMap = new Map(authorList.map((u) => [u.id, u]))

  const result = list.map((a) => ({
    ...a,
    author: { name: authorMap.get(a.authorId)?.name ?? null },
  }))

  return Response.json({ announcements: result })
}

export async function POST(request: Request) {
  const user = await getSession()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

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

  const announcement = await announcements.create({
    title, content, pinned: Boolean(raw?.pinned), authorId: user.id,
  })

  return Response.json({
    announcement: { ...announcement, author: { name: user.name } },
  }, { status: 201 })
}

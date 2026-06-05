import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { sanitizeString } from '@/lib/sanitize'

export async function GET() {
  const user = await getSession()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const announcements = await prisma.announcement.findMany({
    include: { author: { select: { name: true } } },
    orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
  })

  return Response.json({ announcements })
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

  const announcement = await prisma.announcement.create({
    data: { title, content, pinned: Boolean(raw?.pinned), authorId: user.id },
    include: { author: { select: { name: true } } },
  })

  return Response.json({ announcement }, { status: 201 })
}

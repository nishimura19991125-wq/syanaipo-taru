import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

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

  const { title, content, pinned } = await request.json()
  if (!title || !content) {
    return Response.json({ error: 'タイトルと内容を入力してください' }, { status: 400 })
  }

  const announcement = await prisma.announcement.create({
    data: { title, content, pinned: pinned ?? false, authorId: user.id },
    include: { author: { select: { name: true } } },
  })

  return Response.json({ announcement }, { status: 201 })
}

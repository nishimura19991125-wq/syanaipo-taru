import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const mindMap = await prisma.mindMap.findUnique({ where: { id } })
  if (!mindMap || mindMap.ownerId !== user.id) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const shares = await prisma.mindMapShare.findMany({
    where: { mindMapId: id },
    include: { user: { select: { id: true, name: true, email: true } } },
  })

  return Response.json({ shares })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const mindMap = await prisma.mindMap.findUnique({ where: { id } })
  if (!mindMap || mindMap.ownerId !== user.id) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { email, permission } = await request.json()
  if (!email) return Response.json({ error: 'メールアドレスを入力してください' }, { status: 400 })

  const targetUser = await prisma.user.findUnique({ where: { email } })
  if (!targetUser) return Response.json({ error: 'ユーザーが見つかりません' }, { status: 404 })
  if (targetUser.id === user.id) {
    return Response.json({ error: '自分自身には共有できません' }, { status: 400 })
  }

  const share = await prisma.mindMapShare.upsert({
    where: { mindMapId_userId: { mindMapId: id, userId: targetUser.id } },
    update: { permission: permission || 'view' },
    create: { mindMapId: id, userId: targetUser.id, permission: permission || 'view' },
    include: { user: { select: { id: true, name: true, email: true } } },
  })

  return Response.json({ share }, { status: 201 })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const mindMap = await prisma.mindMap.findUnique({ where: { id } })
  if (!mindMap || mindMap.ownerId !== user.id) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId } = await request.json()
  await prisma.mindMapShare.deleteMany({
    where: { mindMapId: id, userId },
  })

  return Response.json({ ok: true })
}

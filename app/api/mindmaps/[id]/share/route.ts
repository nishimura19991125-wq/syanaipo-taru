import { mindMaps, shares, users } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const mindMap = await mindMaps.findById(id)
  if (!mindMap || mindMap.ownerId !== user.id) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const mapShares = await shares.findByMindMap(id)
  const shareUsers = await users.findManyByIds(mapShares.map((s) => s.userId))
  const userMap = new Map(shareUsers.map((u) => [u.id, u]))

  const result = mapShares.map((s) => {
    const u = userMap.get(s.userId)
    return {
      ...s,
      user: u ? { id: u.id, name: u.name, email: u.email } : null,
    }
  })

  return Response.json({ shares: result })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const mindMap = await mindMaps.findById(id)
  if (!mindMap || mindMap.ownerId !== user.id) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { email, permission } = await request.json()
  if (!email) return Response.json({ error: 'メールアドレスを入力してください' }, { status: 400 })

  const safePermission = permission === 'edit' ? 'edit' : 'view'

  const targetUser = await users.findByEmail(email)
  if (!targetUser) return Response.json({ error: 'ユーザーが見つかりません' }, { status: 404 })
  if (targetUser.id === user.id) {
    return Response.json({ error: '自分自身には共有できません' }, { status: 400 })
  }

  const share = await shares.upsert(id, targetUser.id, safePermission)
  return Response.json({
    share: {
      ...share,
      user: { id: targetUser.id, name: targetUser.name, email: targetUser.email },
    },
  }, { status: 201 })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const mindMap = await mindMaps.findById(id)
  if (!mindMap || mindMap.ownerId !== user.id) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId } = await request.json()
  await shares.delete(id, userId)
  return Response.json({ ok: true })
}

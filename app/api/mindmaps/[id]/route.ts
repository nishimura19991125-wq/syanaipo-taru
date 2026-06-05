import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { sanitizeString, sanitizeUrl } from '@/lib/sanitize'

async function getPermission(mindMapId: string, userId: string) {
  const mindMap = await prisma.mindMap.findUnique({
    where: { id: mindMapId },
    include: { shares: { where: { userId } } },
  })
  if (!mindMap) return null
  if (mindMap.ownerId === userId) return 'owner'
  if (mindMap.isPublic) return 'view'
  if (mindMap.shares.length > 0) return mindMap.shares[0].permission
  return null
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const perm = await getPermission(id, user.id)
  if (!perm) return Response.json({ error: 'Not found' }, { status: 404 })

  const mindMap = await prisma.mindMap.findUnique({
    where: { id },
    include: { owner: { select: { name: true } } },
  })

  return Response.json({ mindMap, permission: perm })
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const perm = await getPermission(id, user.id)
  if (!perm || perm === 'view') return Response.json({ error: 'Forbidden' }, { status: 403 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }

  const updateData: Record<string, unknown> = {}

  if (body.data !== undefined) {
    // Enforce payload size limit before parsing (prevent memory DoS)
    const raw = body.data as string
    if (typeof raw !== 'string' || raw.length > 500_000) {
      return Response.json({ error: 'データが大きすぎます（上限500KB）' }, { status: 413 })
    }
    try {
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object' || !parsed.rootId) {
        return Response.json({ error: 'データ形式が不正です' }, { status: 400 })
      }
      if (parsed.nodes && Array.isArray(parsed.nodes)) {
        // Cap node count to prevent DB bloat / DoS
        if (parsed.nodes.length > 500) {
          return Response.json({ error: 'ノード数が上限（500）を超えています' }, { status: 400 })
        }
        parsed.nodes = parsed.nodes.map((n: Record<string, unknown>) => ({
          ...n,
          text: sanitizeString(n.text, 200),
          url: n.url ? sanitizeUrl(n.url) : undefined,
        }))
      }
      updateData.data = JSON.stringify(parsed)
    } catch {
      return Response.json({ error: 'データ形式が不正です' }, { status: 400 })
    }
  }
  if (body.title !== undefined && perm === 'owner') {
    updateData.title = sanitizeString(body.title, 200).trim()
  }
  if (body.isPublic !== undefined && perm === 'owner') updateData.isPublic = Boolean(body.isPublic)

  const mindMap = await prisma.mindMap.update({
    where: { id },
    data: updateData,
  })

  return Response.json({ mindMap })
}

export async function DELETE(
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

  await prisma.mindMap.delete({ where: { id } })
  return Response.json({ ok: true })
}

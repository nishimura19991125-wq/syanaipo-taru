import { mindMaps, shares } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { sanitizeString, sanitizeUrl } from '@/lib/sanitize'

async function getPermission(mindMapId: string, userId: string) {
  const [mindMap, mapShares] = await Promise.all([
    mindMaps.findById(mindMapId),
    shares.findByMindMapAndUser(mindMapId, userId),
  ])
  if (!mindMap) return null
  if (mindMap.ownerId === userId) return { perm: 'owner' as const, mindMap }
  if (mindMap.isPublic) return { perm: 'view' as const, mindMap }
  if (mapShares) return { perm: mapShares.permission as 'view' | 'edit', mindMap }
  return null
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const result = await getPermission(id, user.id)
  if (!result) return Response.json({ error: 'Not found' }, { status: 404 })

  return Response.json({ mindMap: result.mindMap, permission: result.perm })
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const result = await getPermission(id, user.id)
  if (!result || result.perm === 'view') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }

  const updateData: Partial<Pick<import('@/lib/db').MindMap, 'title' | 'data' | 'isPublic'>> = {}

  if (body.data !== undefined) {
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
  if (body.title !== undefined && result.perm === 'owner') {
    updateData.title = sanitizeString(body.title, 200).trim()
  }
  if (body.isPublic !== undefined && result.perm === 'owner') {
    updateData.isPublic = Boolean(body.isPublic)
  }

  const mindMap = await mindMaps.update(id, updateData)
  return Response.json({ mindMap })
}

export async function DELETE(
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

  await mindMaps.delete(id)
  return Response.json({ ok: true })
}

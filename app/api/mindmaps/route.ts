import { mindMaps, shares, users } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { sanitizeString } from '@/lib/sanitize'

export async function GET() {
  const user = await getSession()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch owned maps and shared items in parallel
  const [owned, sharedItems] = await Promise.all([
    mindMaps.findByOwner(user.id),
    shares.findByUser(user.id),
  ])

  const ownedMaps = owned.map((m) => ({
    id: m.id,
    title: m.title,
    isPublic: m.isPublic,
    ownerId: m.ownerId,
    ownerName: user.name,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
    permission: 'owner' as const,
  }))

  // Batch-fetch mindmaps and their owners for shared items
  const sharedMindMapIds = sharedItems.map((s) => s.mindMapId)
  const sharedMindMapList = await mindMaps.findManyByIds(sharedMindMapIds)
  const sharedMindMapMap = new Map(sharedMindMapList.map((m) => [m.id, m]))

  const ownerIds = [...new Set(sharedMindMapList.map((m) => m.ownerId))]
  const ownerList = await users.findManyByIds(ownerIds)
  const ownerMap = new Map(ownerList.map((u) => [u.id, u]))

  const sharedMaps = sharedItems
    .map((s) => {
      const m = sharedMindMapMap.get(s.mindMapId)
      if (!m) return null
      const owner = ownerMap.get(m.ownerId)
      return {
        id: m.id,
        title: m.title,
        isPublic: m.isPublic,
        ownerId: m.ownerId,
        ownerName: owner?.name ?? null,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
        permission: s.permission as 'view' | 'edit',
      }
    })
    .filter(Boolean)

  return Response.json({ mindMaps: [...ownedMaps, ...sharedMaps] })
}

export async function POST(request: Request) {
  const user = await getSession()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }

  const title = sanitizeString((body as Record<string, unknown>)?.title, 200).trim()
  if (!title) return Response.json({ error: 'タイトルを入力してください' }, { status: 400 })

  const rootId = 'root-' + Date.now()
  const initialData = JSON.stringify({
    nodes: [{ id: rootId, text: title, x: 0, y: 0, color: '#4F46E5', parentId: null }],
    rootId,
  })

  const mindMap = await mindMaps.create({ title, data: initialData, ownerId: user.id })
  return Response.json({ mindMap }, { status: 201 })
}

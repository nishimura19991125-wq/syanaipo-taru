import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET() {
  const user = await getSession()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const owned = await prisma.mindMap.findMany({
    where: { ownerId: user.id },
    include: { owner: { select: { name: true } } },
    orderBy: { updatedAt: 'desc' },
  })

  const shared = await prisma.mindMapShare.findMany({
    where: { userId: user.id },
    include: {
      mindMap: {
        include: { owner: { select: { name: true } } },
      },
    },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ownedMaps = owned.map((m: any) => ({
    id: m.id,
    title: m.title,
    isPublic: m.isPublic,
    ownerId: m.ownerId,
    ownerName: m.owner.name,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
    permission: 'owner' as const,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sharedMaps = shared.map((s: any) => ({
    id: s.mindMap.id,
    title: s.mindMap.title,
    isPublic: s.mindMap.isPublic,
    ownerId: s.mindMap.ownerId,
    ownerName: s.mindMap.owner.name,
    createdAt: s.mindMap.createdAt.toISOString(),
    updatedAt: s.mindMap.updatedAt.toISOString(),
    permission: s.permission as 'view' | 'edit',
  }))

  return Response.json({ mindMaps: [...ownedMaps, ...sharedMaps] })
}

export async function POST(request: Request) {
  const user = await getSession()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { title } = await request.json()
  if (!title) return Response.json({ error: 'タイトルを入力してください' }, { status: 400 })

  const rootId = 'root-' + Date.now()
  const initialData = JSON.stringify({
    nodes: [{ id: rootId, text: title, x: 0, y: 0, color: '#4F46E5', parentId: null }],
    rootId,
  })

  const mindMap = await prisma.mindMap.create({
    data: { title, data: initialData, ownerId: user.id },
  })

  return Response.json({ mindMap }, { status: 201 })
}

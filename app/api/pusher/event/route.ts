import { NextRequest, NextResponse } from 'next/server'
import { pusherServer } from '@/lib/pusher'
import { getSession } from '@/lib/auth'
import { sanitizeString } from '@/lib/sanitize'
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/ratelimit'

export async function POST(request: NextRequest) {
  // Rate limit: 120 events per minute per user (2/sec max)
  const ip = getClientIp(request)
  const rl = checkRateLimit(`pusher:${ip}`, 120, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl.resetAt)

  const user = await getSession()
  if (!user) return new Response('Unauthorized', { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return new Response('Bad Request', { status: 400 })
  }

  const { mindMapId, data } = body
  if (!mindMapId || typeof mindMapId !== 'string') {
    return new Response('Bad Request', { status: 400 })
  }

  const safeId = sanitizeString(mindMapId).slice(0, 64)
  const socketId = request.headers.get('x-socket-id') ?? undefined

  await pusherServer.trigger(
    `presence-mindmap-${safeId}`,
    'map_update',
    data,
    socketId ? { socket_id: socketId } : undefined,
  )

  return NextResponse.json({ ok: true })
}

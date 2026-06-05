import { NextRequest, NextResponse } from 'next/server'
import { pusherServer } from '@/lib/pusher'
import { getSession } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const user = await getSession()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const body = await request.text()
  const params = new URLSearchParams(body)
  const socketId = params.get('socket_id')
  const channel = params.get('channel_name')

  if (!socketId || !channel) {
    return new Response('Bad Request', { status: 400 })
  }

  const auth = pusherServer.authorizeChannel(socketId, channel, {
    user_id: user.id,
    user_info: { name: user.name || user.email },
  })

  return NextResponse.json(auth)
}

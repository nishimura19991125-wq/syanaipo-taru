import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { Server as SocketIOServer } from 'socket.io'

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

const rooms = new Map<string, Map<string, { userId: string; name: string }>>()

// Cleanup stale rooms every 30 minutes
setInterval(() => {
  rooms.forEach((members, roomId) => {
    if (members.size === 0) rooms.delete(roomId)
  })
}, 30 * 60 * 1000)

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true)
    handle(req, res, parsedUrl)
  })

  const allowedOrigin = process.env.ALLOWED_ORIGIN || (dev ? '*' : process.env.NEXTAUTH_URL || '')

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: allowedOrigin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // Limit payload size to prevent DoS
    maxHttpBufferSize: 1e5, // 100KB
  })

  io.on('connection', (socket) => {
    const query = socket.handshake.query as Record<string, string>
    const mindMapId = typeof query.mindMapId === 'string' ? query.mindMapId.slice(0, 64) : ''
    const userId = typeof query.userId === 'string' ? query.userId.slice(0, 64) : ''
    const userName = typeof query.userName === 'string' ? query.userName.slice(0, 100) : 'Unknown'

    if (!mindMapId || !userId) {
      socket.disconnect(true)
      return
    }

    socket.join(mindMapId)

    if (!rooms.has(mindMapId)) {
      rooms.set(mindMapId, new Map())
    }
    rooms.get(mindMapId)!.set(socket.id, { userId, name: userName })

    const emitUsers = () => {
      const users = Array.from(rooms.get(mindMapId)?.values() ?? [])
      io.to(mindMapId).emit('users_updated', users)
    }
    emitUsers()

    socket.on('map_update', (data: unknown) => {
      // Only forward to others in the same room (not back to sender)
      socket.to(mindMapId).emit('map_update', data)
    })

    socket.on('cursor_move', (pos: { x: number; y: number }) => {
      if (typeof pos?.x !== 'number' || typeof pos?.y !== 'number') return
      socket.to(mindMapId).emit('cursor_move', { userId, name: userName, x: pos.x, y: pos.y })
    })

    socket.on('disconnect', () => {
      rooms.get(mindMapId)?.delete(socket.id)
      emitUsers()
      if ((rooms.get(mindMapId)?.size ?? 0) === 0) {
        rooms.delete(mindMapId)
      }
    })
  })

  const port = parseInt(process.env.PORT || '3000', 10)
  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`)
  })
})

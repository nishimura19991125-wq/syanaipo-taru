import { cookies } from 'next/headers'
import { sessions, users } from './db'

export type SessionUser = {
  id: string
  name: string | null
  email: string
  role: string
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('session_token')?.value
  if (!token) return null

  const session = await sessions.findByToken(token)
  if (!session) return null

  if (new Date(session.expiresAt) < new Date()) {
    await sessions.deleteByToken(token)
    return null
  }

  const user = await users.findById(session.userId)
  if (!user) return null

  return { id: user.id, name: user.name, email: user.email, role: user.role }
}

export async function requireAuth(): Promise<SessionUser> {
  const user = await getSession()
  if (!user) throw new Error('Unauthorized')
  return user
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireAuth()
  if (user.role !== 'admin') throw new Error('Forbidden')
  return user
}

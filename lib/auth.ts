import { cookies } from 'next/headers'
import { prisma } from './prisma'

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

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  })

  if (!session) return null
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { token } })
    return null
  }

  return session.user
}

export async function requireAuth(): Promise<SessionUser> {
  const user = await getSession()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireAuth()
  if (user.role !== 'admin') {
    throw new Error('Forbidden')
  }
  return user
}

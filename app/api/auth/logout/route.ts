import { sessions } from '@/lib/db'
import { cookies } from 'next/headers'

export async function POST() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session_token')?.value

  if (token) {
    await sessions.deleteByToken(token)
    cookieStore.delete('session_token')
  }

  return Response.json({ ok: true })
}

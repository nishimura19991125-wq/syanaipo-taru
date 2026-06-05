import { users } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET() {
  const user = await getSession()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const list = await users.findAll()
  return Response.json({
    users: list.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role })),
  })
}

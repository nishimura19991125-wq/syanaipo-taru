import { users, sessions } from '@/lib/db'
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/ratelimit'
import { sanitizeString, validateEmail } from '@/lib/sanitize'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  const ip = getClientIp(request)
  const rl = checkRateLimit(`login:${ip}`, 10, 15 * 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl.resetAt)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }

  const email = sanitizeString((body as Record<string, unknown>)?.email, 254).toLowerCase()
  const password = sanitizeString((body as Record<string, unknown>)?.password, 128)

  if (!email || !password) {
    return Response.json({ error: 'メールアドレスとパスワードを入力してください' }, { status: 400 })
  }
  if (!validateEmail(email)) {
    return Response.json({ error: 'メールアドレスの形式が正しくありません' }, { status: 400 })
  }

  const user = await users.findByEmail(email)
  // Always run bcrypt to prevent user-enumeration via timing differences.
  const DUMMY_HASH = '$2b$12$WwsdfLJ18snLGXKu7E4K7eZLaU2EGDlqaFLLIjNV6yVYSBMgC91fC'
  const hashToCompare = user ? user.password : DUMMY_HASH
  const matched = await bcrypt.compare(password, hashToCompare)
  const valid = user ? matched : false

  if (!user || !valid) {
    return Response.json({ error: 'メールアドレスまたはパスワードが正しくありません' }, { status: 401 })
  }

  const token = randomBytes(48).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  await sessions.create({ userId: user.id, token, expiresAt })

  const cookieStore = await cookies()
  cookieStore.set('session_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    expires: expiresAt,
    path: '/',
  })

  return Response.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  })
}

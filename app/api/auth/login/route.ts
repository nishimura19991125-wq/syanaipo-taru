import { prisma } from '@/lib/prisma'
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/ratelimit'
import { sanitizeString, validateEmail } from '@/lib/sanitize'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  // Rate limit: 10 attempts per 15 minutes per IP
  const ip = getClientIp(request)
  const rl = checkRateLimit(`login:${ip}`, 10, 15 * 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl.resetAt)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }

  const email = sanitizeString((body as Record<string, unknown>)?.email, 254)
  const password = sanitizeString((body as Record<string, unknown>)?.password, 128)

  if (!email || !password) {
    return Response.json({ error: 'メールアドレスとパスワードを入力してください' }, { status: 400 })
  }
  if (!validateEmail(email)) {
    return Response.json({ error: 'メールアドレスの形式が正しくありません' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { email } })
  // Always compare hash to prevent timing attacks
  const dummyHash = '$2b$12$invalidhashinvalidhashinvali'
  const valid = user
    ? await bcrypt.compare(password, user.password)
    : await bcrypt.compare(password, dummyHash).then(() => false)

  if (!user || !valid) {
    return Response.json({ error: 'メールアドレスまたはパスワードが正しくありません' }, { status: 401 })
  }

  const token = randomBytes(48).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  await prisma.session.create({
    data: { userId: user.id, token, expiresAt },
  })

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

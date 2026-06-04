import { prisma } from '@/lib/prisma'
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/ratelimit'
import { sanitizeString, validateEmail } from '@/lib/sanitize'
import bcrypt from 'bcryptjs'

export async function POST(request: Request) {
  // Rate limit: 5 registrations per hour per IP
  const ip = getClientIp(request)
  const rl = checkRateLimit(`register:${ip}`, 5, 60 * 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl.resetAt)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }

  const raw = body as Record<string, unknown>
  const name = sanitizeString(raw?.name, 100).trim()
  const email = sanitizeString(raw?.email, 254).trim().toLowerCase()
  const password = sanitizeString(raw?.password, 128)

  if (!name || !email || !password) {
    return Response.json({ error: '全項目を入力してください' }, { status: 400 })
  }
  if (!validateEmail(email)) {
    return Response.json({ error: 'メールアドレスの形式が正しくありません' }, { status: 400 })
  }
  if (password.length < 8) {
    return Response.json({ error: 'パスワードは8文字以上必要です' }, { status: 400 })
  }
  if (password.length > 128) {
    return Response.json({ error: 'パスワードは128文字以下にしてください' }, { status: 400 })
  }
  // Basic password strength: at least one letter and one number
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return Response.json({ error: 'パスワードには英字と数字を含めてください' }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return Response.json({ error: 'このメールアドレスは既に登録されています' }, { status: 409 })
  }

  const hashed = await bcrypt.hash(password, 12)
  const count = await prisma.user.count()
  const role = count === 0 ? 'admin' : 'user'

  const user = await prisma.user.create({
    data: { name, email, password: hashed, role },
    select: { id: true, name: true, email: true, role: true },
  })

  return Response.json({ user }, { status: 201 })
}

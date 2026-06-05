import { users } from '@/lib/db'
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/ratelimit'
import { sanitizeString, validateEmail } from '@/lib/sanitize'
import bcrypt from 'bcryptjs'

export async function POST(request: Request) {
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
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return Response.json({ error: 'パスワードには英字と数字を含めてください' }, { status: 400 })
  }

  const existing = await users.findByEmail(email)
  if (existing) {
    return Response.json({ error: 'このメールアドレスは既に登録されています' }, { status: 409 })
  }

  const hashed = await bcrypt.hash(password, 12)
  const count = await users.count()
  const role = count === 0 ? 'admin' : 'user'

  const user = await users.create({ name, email, password: hashed, role })

  return Response.json(
    { user: { id: user.id, name: user.name, email: user.email, role: user.role } },
    { status: 201 }
  )
}

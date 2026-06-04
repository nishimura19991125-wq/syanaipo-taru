// Simple in-memory rate limiter (single-process; for multi-process use Redis)
interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Purge old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  store.forEach((v, k) => { if (v.resetAt < now) store.delete(k) })
}, 5 * 60 * 1000)

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { ok: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: maxRequests - 1, resetAt: now + windowMs }
  }

  entry.count++
  if (entry.count > maxRequests) {
    return { ok: false, remaining: 0, resetAt: entry.resetAt }
  }

  return { ok: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt }
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip') ?? 'unknown'
}

export function rateLimitResponse(resetAt: number): Response {
  const retryAfter = Math.ceil((resetAt - Date.now()) / 1000)
  return new Response(
    JSON.stringify({ error: 'リクエストが多すぎます。しばらくしてからお試しください。' }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter),
        'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
      },
    }
  )
}

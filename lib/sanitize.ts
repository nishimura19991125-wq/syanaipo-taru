// Strip control characters and limit string length
export function sanitizeString(value: unknown, maxLen = 1000): string {
  if (typeof value !== 'string') return ''
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').slice(0, maxLen)
}

export function sanitizeUrl(url: unknown): string | undefined {
  if (typeof url !== 'string' || !url.trim()) return undefined
  const trimmed = url.trim()
  try {
    const parsed = new URL(trimmed.startsWith('http') ? trimmed : 'https://' + trimmed)
    if (!['http:', 'https:'].includes(parsed.protocol)) return undefined
    return parsed.toString()
  } catch {
    return undefined
  }
}

export function validateEmail(email: unknown): boolean {
  if (typeof email !== 'string') return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254
}

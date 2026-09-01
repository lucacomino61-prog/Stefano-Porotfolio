import { createHash } from 'node:crypto'

/**
 * One-way, salted, and rotated daily so the output cannot be used to follow a
 * visitor across days. Raw addresses are never persisted.
 */
export function hashVisitor(ip: string | null, extra = ''): string | null {
  if (!ip) return null
  const salt = process.env.IP_HASH_SALT
  if (!salt) return null
  const day = new Date().toISOString().slice(0, 10)
  return createHash('sha256').update(`${salt}:${day}:${ip}:${extra}`).digest('hex').slice(0, 32)
}

/** Vercel and most proxies put the client first in x-forwarded-for. */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? null
  return headers.get('x-real-ip')
}

import { SignJWT, jwtVerify } from 'jose'

import { MAX_FILL_SECONDS, MIN_FILL_SECONDS } from '@/lib/validation/contact'

const PURPOSE = 'contact-form'

function secret(): Uint8Array {
  const value = process.env.ADMIN_SESSION_SECRET
  if (!value || value.length < 32) {
    throw new Error('ADMIN_SESSION_SECRET must be set and at least 32 characters.')
  }
  return new TextEncoder().encode(value)
}

/**
 * Issued the moment a visitor focuses the first field, not when the page is
 * rendered. That keeps the page fully cacheable under ISR while still giving
 * the time-trap a real clock to measure against.
 */
export async function issueFormToken(): Promise<string> {
  return new SignJWT({ purpose: PURPOSE })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_FILL_SECONDS}s`)
    .sign(secret())
}

/** False when absent, forged, expired, reused for another purpose, or too fast. */
export async function verifyFormToken(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, secret())
    if (payload.purpose !== PURPOSE || typeof payload.iat !== 'number') return false
    const elapsed = Math.floor(Date.now() / 1000) - payload.iat
    return elapsed >= MIN_FILL_SECONDS && elapsed <= MAX_FILL_SECONDS
  } catch {
    return false
  }
}

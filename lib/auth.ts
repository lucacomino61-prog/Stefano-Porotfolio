import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

import { SignJWT, jwtVerify } from 'jose'

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>

const KEY_LENGTH = 64
export const SESSION_COOKIE = 'sp_admin'
const SESSION_TTL = '7d'

function sessionSecret(): Uint8Array {
  const secret = process.env.ADMIN_SESSION_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('ADMIN_SESSION_SECRET must be set and at least 32 characters.')
  }
  return new TextEncoder().encode(secret)
}

/** Stored as `scrypt$<saltHex>$<keyHex>`. Generate with `npm run hash-password`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await scrypt(password, salt, KEY_LENGTH)
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`
}

export async function verifyPassword(password: string): Promise<boolean> {
  const stored = process.env.ADMIN_PASSWORD_HASH
  if (!stored) return false

  const [scheme, saltHex, keyHex] = stored.split('$')
  if (scheme !== 'scrypt' || !saltHex || !keyHex) return false

  const expected = Buffer.from(keyHex, 'hex')
  if (expected.length !== KEY_LENGTH) return false

  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), KEY_LENGTH)
  // Both buffers are a fixed length, so this comparison cannot leak via timing.
  return timingSafeEqual(actual, expected)
}

export async function createSession(): Promise<string> {
  return new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(sessionSecret())
}

export async function readSession(token: string | undefined): Promise<boolean> {
  if (!token) return false
  try {
    const { payload } = await jwtVerify(token, sessionSecret())
    return payload.role === 'admin'
  } catch {
    return false
  }
}

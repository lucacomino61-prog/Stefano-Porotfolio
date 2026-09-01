import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { SESSION_COOKIE, createSession, verifyPassword } from '@/lib/auth'
import { clientIp, hashVisitor } from '@/lib/hash'
import { rateLimit } from '@/lib/ratelimit'

const loginSchema = z.object({ password: z.string().min(1).max(200) })

export async function POST(request: Request): Promise<NextResponse> {
  // Five attempts per ten minutes per IP. A login attempt is itself the
  // sensitive operation, so unlike the contact form there is no looser tier.
  const key = `admin:${hashVisitor(clientIp(request.headers)) ?? 'anonymous'}`
  try {
    const limit = await rateLimit('auth', key)
    if (!limit.success) return NextResponse.json({ ok: false }, { status: 429 })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const parsed = loginSchema.safeParse(body)
  if (!parsed.success || !(await verifyPassword(parsed.data.password))) {
    // A wrong password and a malformed request are deliberately
    // indistinguishable from the outside.
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const store = await cookies()
  store.set(SESSION_COOKIE, await createSession(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(): Promise<NextResponse> {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
  return NextResponse.json({ ok: true })
}

import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { getDb } from '@/lib/db/client'
import { submissions } from '@/lib/db/schema'
import { issueFormToken, verifyFormToken } from '@/lib/formToken'
import { clientIp, hashVisitor } from '@/lib/hash'
import { sendContactNotification } from '@/lib/mail/resend'
import { rateLimit } from '@/lib/ratelimit'
import {
  type ContactFieldErrors,
  type ContactResponse,
  contactSchema,
} from '@/lib/validation/contact'

/** Issues the time-trap nonce, called when the visitor focuses the first field. */
export async function GET(): Promise<NextResponse> {
  const token = await issueFormToken()
  return NextResponse.json({ token }, { headers: { 'cache-control': 'no-store' } })
}

export async function POST(request: Request): Promise<NextResponse<ContactResponse>> {
  const ip = clientIp(request.headers)
  const key = hashVisitor(ip) ?? 'anonymous'

  const tooMany = (reset: number): NextResponse<ContactResponse> => {
    const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000))
    return NextResponse.json<ContactResponse>(
      { ok: false, error: 'rateLimited', retryAfter },
      { status: 429, headers: { 'retry-after': String(retryAfter) } },
    )
  }

  // The loose abuse guard, charged against every request that gets here.
  // rateLimit throws in production when Upstash is unconfigured, which is
  // deliberate, and must surface as a server error rather than an unhandled
  // rejection.
  try {
    const attempt = await rateLimit('attempt', key)
    if (!attempt.success) return tooMany(attempt.reset)
  } catch {
    return NextResponse.json({ ok: false, error: 'server' }, { status: 500 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'rejected' }, { status: 400 })
  }

  const parsed = contactSchema.safeParse(body)
  if (!parsed.success) {
    const fields: ContactFieldErrors = {}
    for (const issue of parsed.error.issues) {
      const field = issue.path[0]
      // The honeypot and the token are never surfaced. Anything that trips
      // either gets the same opaque rejection as malformed input, so a bot
      // learns nothing about which guard caught it.
      if (field === 'company' || field === 'token') {
        return NextResponse.json({ ok: false, error: 'rejected' }, { status: 400 })
      }
      if (typeof field === 'string' && !(field in fields)) {
        fields[field as keyof ContactFieldErrors] = issue.message
      }
    }
    return NextResponse.json({ ok: false, error: 'validation', fields }, { status: 422 })
  }

  const { name, email, message, locale, token } = parsed.data

  if (!(await verifyFormToken(token))) {
    return NextResponse.json({ ok: false, error: 'rejected' }, { status: 400 })
  }

  // Only now, with a well-formed submission from something that waited like a
  // person, is the tight policy charged. This is the request that costs a row
  // and an email, so this is the one worth limiting hard.
  try {
    const submit = await rateLimit('submit', key)
    if (!submit.success) return tooMany(submit.reset)
  } catch {
    return NextResponse.json({ ok: false, error: 'server' }, { status: 500 })
  }

  try {
    const [row] = await getDb()
      .insert(submissions)
      .values({
        name,
        email,
        message,
        locale,
        ipHash: hashVisitor(ip),
        userAgent: request.headers.get('user-agent')?.slice(0, 500) ?? null,
      })
      .returning({ id: submissions.id })

    // Persisted first, notified second. If Resend is down the enquiry still
    // exists and /admin still lists it, so the visitor is correctly told it
    // worked rather than being asked to send it twice.
    const notified = await sendContactNotification({ name, email, message, locale })
    if (notified && row) {
      await getDb()
        .update(submissions)
        .set({ notifiedAt: new Date() })
        .where(eq(submissions.id, row.id))
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'server' }, { status: 500 })
  }
}

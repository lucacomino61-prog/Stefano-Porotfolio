import { NextResponse } from 'next/server'
import { z } from 'zod'

import { getDb } from '@/lib/db/client'
import { sectionViews } from '@/lib/db/schema'
import { clientIp, hashVisitor } from '@/lib/hash'
import { LOCALES } from '@/lib/i18n/config'

/**
 * First-party section-view analytics. No third-party script, no cookie, no
 * durable identifier: the visitor hash is salted and rotates every day, so it
 * cannot be used to follow anyone across days.
 */
const eventSchema = z.object({
  section: z.enum(['hero', 'manifesto', 'work', 'case-study', 'process', 'contact']),
  locale: z.enum(LOCALES),
})

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown
  try {
    // navigator.sendBeacon posts a Blob; both it and a plain fetch arrive as
    // text, so parse the text rather than relying on the content type.
    body = JSON.parse(await request.text())
  } catch {
    return new NextResponse(null, { status: 204 })
  }

  const parsed = eventSchema.safeParse(body)
  if (!parsed.success) return new NextResponse(null, { status: 204 })

  try {
    await getDb().insert(sectionViews).values({
      section: parsed.data.section,
      locale: parsed.data.locale,
      visitorHash: hashVisitor(clientIp(request.headers), 'events'),
    })
  } catch {
    // Analytics never surfaces to the visitor and never retries. A dropped
    // event is strictly better than a blocked page.
  }

  // 204 keeps sendBeacon quiet and costs no response body.
  return new NextResponse(null, { status: 204 })
}

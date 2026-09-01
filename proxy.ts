import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { DEFAULT_LOCALE, LOCALES, type Locale } from '@/lib/i18n/config'

/**
 * Named `proxy`, not `middleware`: Next.js 16 renamed the convention. The
 * behaviour is unchanged.
 *
 * Its only job is sending a locale-less URL to a locale. It does not touch
 * sessions or authorisation, which belong in the admin layout where the Node
 * runtime and the real cookie check live.
 */
function preferredLocale(request: NextRequest): Locale {
  const header = request.headers.get('accept-language')
  if (!header) return DEFAULT_LOCALE

  const ranked = header
    .split(',')
    .map((part) => {
      const [tag, q] = part.trim().split(';q=')
      return { tag: (tag ?? '').toLowerCase(), q: q ? Number(q) : 1 }
    })
    .sort((a, b) => b.q - a.q)

  for (const { tag } of ranked) {
    const base = tag.split('-')[0]
    // `sq` is the language tag for Albanian; `al` is the URL segment we serve
    // it under. A browser will always send sq, never al.
    if (base === 'sq') return 'al'
    if (base && (LOCALES as readonly string[]).includes(base)) return base as Locale
  }

  return DEFAULT_LOCALE
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const hasLocale = LOCALES.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  )
  if (hasLocale) return NextResponse.next()

  const url = request.nextUrl.clone()
  url.pathname = `/${preferredLocale(request)}${pathname === '/' ? '' : pathname}`
  return NextResponse.redirect(url)
}

export const config = {
  // Everything except API routes, Next internals, and anything with a file
  // extension. Static assets must never take a locale redirect.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}

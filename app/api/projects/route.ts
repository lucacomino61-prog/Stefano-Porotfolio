import { NextResponse } from 'next/server'

import { listPublishedProjects } from '@/lib/db/queries'

/**
 * A real public endpoint, not the page's data source. The page imports
 * listPublishedProjects directly instead of fetching this route: a page that
 * fetches its own API during a build doubles latency and can deadlock at
 * prerender time. See the note in lib/db/queries.ts.
 */
/**
 * Dynamic at the origin, cached at the edge by the header below. Prerendering
 * this at build time would require database credentials to exist before the
 * first deploy, and would bake a failure response into the build if they did
 * not.
 */
export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
  try {
    const projects = await listPublishedProjects()
    return NextResponse.json(
      { projects },
      { headers: { 'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400' } },
    )
  } catch {
    return NextResponse.json({ error: 'unavailable' }, { status: 503 })
  }
}

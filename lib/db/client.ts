import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'

import * as schema from './schema'

type Database = ReturnType<typeof create>

function create(url: string) {
  return drizzle(neon(url), { schema })
}

let cached: Database | null = null

/**
 * Resolved on first use, not at import.
 *
 * Importing this module must never throw: route handlers are compiled during
 * the build, and a module-level throw would make a missing DATABASE_URL fail
 * the whole build rather than the one request that actually needed a database.
 */
export function getDb(): Database {
  if (cached) return cached

  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.',
    )
  }

  cached = create(url)
  return cached
}

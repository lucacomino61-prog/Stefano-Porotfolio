import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { getDb } from '../lib/db/client'
import { type NewProject, projects } from '../lib/db/schema'

/**
 * Seeds projects from `content/projects.json`.
 *
 * It deliberately does not ship a built-in list of example projects. Inventing
 * a client, an outcome or a date and writing it to the database is how fiction
 * ends up on a live portfolio, so the real data has to exist first. Copy
 * `content/projects.example.json`, fill it in, and run this.
 */
async function main() {
  const path = resolve(process.cwd(), 'content/projects.json')

  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    console.error(
      [
        'No content/projects.json found.',
        '',
        'Copy content/projects.example.json to content/projects.json, replace it',
        'with the real projects, then run this again. Nothing is seeded from',
        'made-up data.',
      ].join('\n'),
    )
    process.exit(1)
  }

  const parsed: unknown = JSON.parse(raw)
  if (!Array.isArray(parsed)) {
    console.error('content/projects.json must be a JSON array of projects.')
    process.exit(1)
  }

  const rows = parsed as NewProject[]
  if (rows.length === 0) {
    console.log('content/projects.json is empty. Nothing to seed.')
    return
  }

  const db = getDb()
  for (const row of rows) {
    await db
      .insert(projects)
      .values(row)
      .onConflictDoUpdate({ target: projects.slug, set: row })
    console.log(`  seeded ${row.slug}`)
  }

  console.log(`\nDone. ${rows.length} project(s) written.`)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})

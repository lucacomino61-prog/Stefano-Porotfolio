import { asc, desc, eq } from 'drizzle-orm'

import { getDb } from './client'
import { type Project, type Submission, projects, submissions } from './schema'

/**
 * The single source of project data.
 *
 * The page calls this directly rather than fetching its own route handler. A
 * page that fetches its own API during a build is a self-fetch: it doubles
 * latency and can deadlock at prerender time. GET /api/projects is a real
 * public endpoint and calls this same function.
 */
export async function listPublishedProjects(): Promise<Project[]> {
  return getDb()
    .select()
    .from(projects)
    .where(eq(projects.published, true))
    .orderBy(asc(projects.position), asc(projects.year))
}

export async function findProjectBySlug(slug: string): Promise<Project | undefined> {
  const rows = await getDb().select().from(projects).where(eq(projects.slug, slug)).limit(1)
  return rows[0]
}

/** Newest first. Only ever called from behind the admin gate. */
export async function listSubmissions(limit = 200): Promise<Submission[]> {
  return getDb().select().from(submissions).orderBy(desc(submissions.createdAt)).limit(limit)
}

/**
 * Returns an empty list instead of throwing when no database is configured yet.
 * The work section renders its pending state rather than taking the page down.
 */
export async function listPublishedProjectsSafe(): Promise<Project[]> {
  try {
    return await listPublishedProjects()
  } catch {
    return []
  }
}

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

export type LimitResult = { success: boolean; remaining: number; reset: number }

/**
 * Two policies, because one policy cannot do both jobs.
 *
 * `attempt` is the abuse guard: it counts every request that reaches the
 * endpoint, malformed ones included, and is deliberately loose.
 *
 * `submit` is the cost guard: it counts only requests that got past
 * validation and the time-trap, which are the ones that write a row and send
 * an email. It is deliberately tight.
 *
 * Charging failed validation against the tight policy, which an earlier
 * revision did, locks out a real person after five typos while costing a bot
 * nothing it cares about. Testing the form is what surfaced it: five malformed
 * posts left the sixth, valid one rate-limited for ten minutes.
 */
const POLICIES = {
  attempt: { max: 30, window: '10 m' },
  submit: { max: 5, window: '10 m' },
  auth: { max: 5, window: '10 m' },
} as const

export type Policy = keyof typeof POLICIES

const WINDOW_MS = 10 * 60 * 1000

/**
 * Resolved on first use, never at module evaluation. Next.js evaluates route
 * modules while collecting page data during `next build`, where runtime
 * secrets are absent, so a module-level throw would fail the build on a
 * machine that will have the credentials perfectly well at request time.
 */
const upstash = new Map<Policy, Ratelimit>()
let configured: boolean | undefined

function isConfigured(): boolean {
  if (configured !== undefined) return configured
  const has = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)

  // Production must never run unmetered. Failing loudly on the first request
  // is correct: silently degrading to "allow everything" turns a missing
  // environment variable into an open relay nobody notices.
  if (!has && process.env.NODE_ENV === 'production') {
    throw new Error(
      'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required in production.',
    )
  }

  configured = has
  return has
}

function limiterFor(policy: Policy): Ratelimit {
  const existing = upstash.get(policy)
  if (existing) return existing

  const { max, window } = POLICIES[policy]
  const created = new Ratelimit({
    redis: new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL as string,
      token: process.env.UPSTASH_REDIS_REST_TOKEN as string,
    }),
    limiter: Ratelimit.slidingWindow(max, window),
    analytics: false,
    prefix: `portfolio:${policy}`,
  })
  upstash.set(policy, created)
  return created
}

/**
 * Development fallback so the form is testable without Upstash credentials.
 * Per-process and lost on restart, which is fine for one developer and exactly
 * why the production branch above refuses to use it.
 */
const memory = new Map<string, number[]>()

function limitInMemory(policy: Policy, key: string): LimitResult {
  const now = Date.now()
  const max = POLICIES[policy].max
  const bucket = `${policy}:${key}`
  const hits = (memory.get(bucket) ?? []).filter((at) => now - at < WINDOW_MS)
  const success = hits.length < max
  if (success) hits.push(now)
  memory.set(bucket, hits)
  return { success, remaining: Math.max(0, max - hits.length), reset: now + WINDOW_MS }
}

export async function rateLimit(policy: Policy, key: string): Promise<LimitResult> {
  if (!isConfigured()) return limitInMemory(policy, key)
  const { success, remaining, reset } = await limiterFor(policy).limit(key)
  return { success, remaining, reset }
}

import { z } from 'zod'

import { LOCALES } from '@/lib/i18n/config'

/** Anything faster than this was not typed by a person. */
export const MIN_FILL_SECONDS = 3
/** Anything slower than this is a stale tab, not a submission in progress. */
export const MAX_FILL_SECONDS = 60 * 60 * 2

export const contactSchema = z.object({
  name: z.string().trim().min(2, 'tooShort').max(80, 'tooLong'),
  email: z.string().trim().toLowerCase().pipe(z.email('invalidEmail')).pipe(z.string().max(160)),
  message: z.string().trim().min(20, 'tooShort').max(4000, 'tooLong'),
  locale: z.enum(LOCALES),
  /**
   * Honeypot. Hidden from people, irresistible to naive bots. It must arrive
   * present and empty: a missing field means the form was not rendered.
   */
  company: z.literal(''),
  /** Signed nonce issued by GET /api/contact when the visitor starts typing. */
  token: z.string().min(16),
})

export type ContactInput = z.infer<typeof contactSchema>

/** Field-level errors, keyed by field, holding a dictionary key not a sentence. */
export type ContactFieldErrors = Partial<Record<keyof ContactInput, string>>

export type ContactResponse =
  | { ok: true }
  | { ok: false; error: 'validation'; fields: ContactFieldErrors }
  | { ok: false; error: 'rateLimited'; retryAfter: number }
  | { ok: false; error: 'rejected' }
  | { ok: false; error: 'server' }

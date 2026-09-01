'use client'

import { useRef, useState } from 'react'

import type { Locale } from '@/lib/i18n/config'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { ContactFieldErrors, ContactResponse } from '@/lib/validation/contact'

type Status = 'idle' | 'sending' | 'sent'

/**
 * The form is the report sheet: ruled fields, no boxes, labels in the
 * apparatus register above each line.
 *
 * The time-trap token is fetched on first focus rather than rendered into the
 * page, which keeps the page fully cacheable while still giving the server a
 * real clock to measure the fill against.
 */
export function ContactForm({ dict, locale }: { dict: Dictionary['contact']; locale: Locale }) {
  const [status, setStatus] = useState<Status>('idle')
  const [errors, setErrors] = useState<ContactFieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const token = useRef<string | null>(null)
  const requesting = useRef(false)

  async function ensureToken() {
    if (token.current || requesting.current) return
    requesting.current = true
    try {
      const res = await fetch('/api/contact')
      if (res.ok) {
        const data: unknown = await res.json()
        if (data && typeof data === 'object' && 'token' in data) {
          token.current = String((data as { token: unknown }).token)
        }
      }
    } catch {
      // Left null. Submitting without one produces the rejected path, which
      // tells the visitor to reload rather than silently failing.
    } finally {
      requesting.current = false
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (status === 'sending') return

    setErrors({})
    setFormError(null)
    setStatus('sending')

    const data = new FormData(event.currentTarget)
    const payload = {
      name: String(data.get('name') ?? ''),
      email: String(data.get('email') ?? ''),
      message: String(data.get('message') ?? ''),
      company: String(data.get('company') ?? ''),
      locale,
      token: token.current ?? '',
    }

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body: ContactResponse = await res.json()

      if (body.ok) {
        setStatus('sent')
        return
      }

      setStatus('idle')
      if (body.error === 'validation') {
        setErrors(body.fields)
        return
      }
      // A used token cannot be replayed, so drop it and let the next attempt
      // fetch a fresh one.
      token.current = null
      setFormError(dict.errors[body.error === 'rateLimited' ? 'rateLimited' : body.error])
    } catch {
      setStatus('idle')
      setFormError(dict.errors.network)
    }
  }

  if (status === 'sent') {
    return (
      <div
        role="status"
        className="border border-confirm/45 px-6 py-8 sm:px-8"
      >
        <p className="font-display text-[clamp(1.5rem,3vw,2.25rem)] font-medium tracking-[-0.03em] text-confirm">
          {dict.success}
        </p>
        <p className="mt-2 max-w-[46ch] text-ink-muted">{dict.successBody}</p>
      </div>
    )
  }

  const fieldClass =
    // Placeholder at full ink-muted, not dimmed. Placeholder text is held to
    // the same 4.5:1 as body copy, and ink-muted is already the quietest tone
    // that clears it (6.7:1). Any further alpha puts it under.
    'w-full border-0 border-b border-rule bg-transparent px-0 py-2.5 font-display text-[clamp(1rem,1.5vw,1.15rem)] text-ink outline-none transition-colors duration-[var(--f4)] placeholder:text-ink-muted focus:border-mark'
  const labelClass = 'tabular block text-[10px] tracking-[0.14em] text-ink-muted uppercase'

  return (
    <form onSubmit={handleSubmit} onFocusCapture={ensureToken} noValidate className="max-w-[42rem]">
      {/* Honeypot. Off-screen rather than display:none, because some bots skip
          hidden fields but happily fill positioned ones. */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-px w-px overflow-hidden">
        <label htmlFor="company">{dict.company}</label>
        <input id="company" name="company" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="space-y-7">
        <div>
          <label className={labelClass} htmlFor="name">
            {dict.name}
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            autoComplete="name"
            placeholder={dict.namePlaceholder}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? 'name-error' : undefined}
            className={fieldClass}
          />
          {errors.name ? (
            <p id="name-error" className="mt-2 text-sm text-alert">
              {dict.errors[errors.name as keyof typeof dict.errors] ?? errors.name}
            </p>
          ) : null}
        </div>

        <div>
          <label className={labelClass} htmlFor="email">
            {dict.email}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder={dict.emailPlaceholder}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? 'email-error' : undefined}
            className={fieldClass}
          />
          {errors.email ? (
            <p id="email-error" className="mt-2 text-sm text-alert">
              {dict.errors[errors.email as keyof typeof dict.errors] ?? errors.email}
            </p>
          ) : null}
        </div>

        <div>
          <label className={labelClass} htmlFor="message">
            {dict.message}
          </label>
          <textarea
            id="message"
            name="message"
            required
            rows={4}
            placeholder={dict.messagePlaceholder}
            aria-invalid={errors.message ? true : undefined}
            aria-describedby={errors.message ? 'message-error' : undefined}
            className={`${fieldClass} resize-y`}
          />
          {errors.message ? (
            <p id="message-error" className="mt-2 text-sm text-alert">
              {dict.errors[errors.message as keyof typeof dict.errors] ?? errors.message}
            </p>
          ) : null}
        </div>
      </div>

      {formError ? (
        <p role="alert" className="mt-6 text-sm text-alert">
          {formError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={status === 'sending'}
        className="group relative mt-9 inline-flex items-center px-7 py-3.5 font-display text-[clamp(0.95rem,1.4vw,1.1rem)] font-medium text-ink transition-colors duration-[var(--f4)] ease-[var(--ease-out)] hover:text-mark-ink focus-visible:text-mark-ink disabled:cursor-progress disabled:opacity-60 active:scale-[0.98]"
      >
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <ellipse
            cx="50"
            cy="50"
            rx="48"
            ry="42"
            className="fill-transparent stroke-mark transition-[fill] duration-[var(--f6)] ease-[var(--ease-out)] group-hover:fill-mark group-focus-visible:fill-mark"
            strokeWidth="0.8"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span className="relative">{status === 'sending' ? dict.sending : dict.submit}</span>
      </button>
    </form>
  )
}

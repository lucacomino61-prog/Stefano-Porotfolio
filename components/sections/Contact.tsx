import { ContactForm } from '@/components/sections/ContactForm'
import type { Locale } from '@/lib/i18n/config'
import type { Dictionary } from '@/lib/i18n/dictionaries'

/**
 * The contact sheet.
 *
 * The brief allowed "subtle 3D or canvas backdrop that idles at low cost"
 * here. It gets neither, on purpose: a second canvas would mean a second WebGL
 * context for decoration alone. The form itself is the report, ruled the way
 * the rest of the world is ruled, which costs nothing and says more.
 */
export function Contact({
  dict,
  locale,
  label,
}: {
  dict: Dictionary['contact']
  locale: Locale
  label: string
}) {
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL

  return (
    <section
      id="contact"
      data-scene
      data-scene-label={label}
      className="contact"
    >
      {/* The last light on the page, and the warmest. The ruled grid that used
          to sit here has gone: it was a texture standing in for a composition,
          and the form's own rules are the only lines this section needs. */}
      <div className="atmos contact-atmos" aria-hidden="true" />

      <h2 className="display contact-heading">{dict.heading}</h2>
      <p className="lede contact-intro">{dict.intro}</p>

      <div className="contact-form-slot">
        <ContactForm dict={dict} locale={locale} />
      </div>

      {/* The form genuinely needs JavaScript: the time-trap token is fetched,
          not rendered. Rather than pretend otherwise with a fallback that
          would be rejected by the server, offer the real alternative. */}
      <noscript>
        <p className="mt-8 max-w-[46ch] text-ink-muted">
          {dict.noScript}{' '}
          {email ? (
            <a className="text-mark underline underline-offset-4" href={`mailto:${email}`}>
              {email}
            </a>
          ) : null}
        </p>
      </noscript>
    </section>
  )
}

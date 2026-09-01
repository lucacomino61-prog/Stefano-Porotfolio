export const LOCALES = ['it', 'en', 'al'] as const

export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'it'

/**
 * URL segment -> BCP 47 language tag.
 *
 * These deliberately disagree for Albanian. `al` is a COUNTRY code, kept in the
 * URL because Albanian visitors recognise it; `sq` is the actual language
 * subtag. Everything that emits a language -- <html lang>, hreflang alternates,
 * Open Graph locale -- must read this map. Never pass a route segment straight
 * through as a language tag, and do not "simplify" this back into an identity
 * function.
 */
export const LANG_TAG: Record<Locale, string> = {
  it: 'it',
  en: 'en',
  al: 'sq',
}

/** Open Graph wants language_TERRITORY. */
export const OG_LOCALE: Record<Locale, string> = {
  it: 'it_IT',
  en: 'en_GB',
  al: 'sq_AL',
}

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value)
}

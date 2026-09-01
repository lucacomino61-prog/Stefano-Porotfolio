import type { Dictionary } from '@/lib/i18n/dictionaries'

/**
 * The foot of the report. Positioning line on the left, the one real address
 * on the right, ruled off from the sheet above it.
 */
export function SiteFooter({ dict }: { dict: Dictionary }) {
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-rule px-[var(--gutter)] py-8 lg:pl-[calc(var(--rail)+var(--gutter))]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3">
        <p className="max-w-[40ch] text-[0.9rem] text-ink-muted">{dict.hero.based}</p>

        <div className="tabular flex items-baseline gap-5 text-[10px] tracking-[0.12em] uppercase">
          {email ? (
            <a
              href={`mailto:${email}`}
              className="text-ink-muted transition-colors duration-[var(--f4)] hover:text-mark"
            >
              {dict.footer.email}
            </a>
          ) : null}
          {/* No alpha on the muted role. DESIGN.md: --ink-muted is the quietest
              tone that clears 4.5:1 and nothing may be dimmed below it. At /70
              and 10px this line measured 3.21:1 on the sheet. It reads quieter
              than the address beside it by being static rather than a link, not
              by being fainter. */}
          <span className="text-ink-muted">
            {year} {dict.footer.rights}
          </span>
        </div>
      </div>
    </footer>
  )
}

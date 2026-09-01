import Link from 'next/link'

type Props = {
  href: string
  children: React.ReactNode
  className?: string
}

/**
 * The primary action, drawn the way a camera assistant marks the take worth
 * printing: circled.
 *
 * The ring is present at rest rather than appearing on hover, because a
 * control that looks like plain text until you touch it has no affordance.
 * Hover and focus fill the ring instead, which is a state change rather than a
 * reveal. The ellipse is one geometric mark, not a decorative illustration.
 */
export function CircledTake({ href, children, className = '' }: Props) {
  return (
    <Link
      href={href}
      className={`group relative inline-flex items-center px-6 py-3 font-display text-[clamp(0.95rem,1.4vw,1.15rem)] font-medium tracking-[-0.01em] text-ink transition-colors duration-[var(--f4)] ease-[var(--ease-out)] hover:text-mark-ink focus-visible:text-mark-ink ${className}`}
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
          ry="44"
          className="fill-transparent stroke-mark transition-[fill] duration-[var(--f6)] ease-[var(--ease-out)] group-hover:fill-mark group-focus-visible:fill-mark"
          strokeWidth="0.8"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span className="relative">{children}</span>
    </Link>
  )
}

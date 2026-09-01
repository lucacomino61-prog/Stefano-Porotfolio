'use client'

import { useEffect } from 'react'

import type { Dictionary } from '@/lib/i18n/dictionaries'
import { THEME_ATTRIBUTE, applyTheme, resolveTheme, writeChoice } from '@/lib/theme'

/**
 * The switch between the day sheet and the night one.
 *
 * It sits on a slate in the apparatus row, with the clock and the date, because
 * it belongs to the same set of facts: what time it is, what day it is, and
 * which light the page is being read under.
 *
 * The icon shows where the switch goes, not where it is — the sun means press
 * this for daylight — and the label says the same in words. Both are swapped in
 * CSS off the attribute on the root element, so the server can render either
 * sheet without a hydration mismatch and without a frame of the wrong icon.
 *
 * The clock keeps running underneath. If nobody has overridden it, the page
 * turns over on its own at seven, which is the only way a promise about night
 * and day survives a tab left open.
 */
export function ThemeToggle({ dict }: { dict: Dictionary['hero'] }) {
  useEffect(() => {
    // The clock keeps running underneath, so once a minute the page is asked
    // whether the hour has moved past a boundary. Once a minute, not once a
    // frame: this is watching for one event a day.
    //
    // Nothing here is React state. The icon and the label are chosen in CSS off
    // the attribute the boot script already wrote, and this writes the same
    // attribute — so there is no second copy of the truth to hydrate wrongly,
    // and turning the page over costs no render at all.
    const id = setInterval(() => {
      const next = resolveTheme()
      if (next !== document.documentElement.getAttribute(THEME_ATTRIBUTE)) applyTheme(next)
    }, 60_000)

    return () => clearInterval(id)
  }, [])

  const toggle = () => {
    const next = resolveTheme() === 'dark' ? 'light' : 'dark'
    writeChoice(next)
    applyTheme(next)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="plate group cursor-pointer transition-colors duration-[var(--f4)] hover:text-slate-mark"
    >
      {/* The accessible name is the destination, and it changes with the sheet,
          which is what tells a screen reader where the switch stands. Both
          names are in the markup and the wrong one is hidden the same way the
          wrong icon is: a button whose name is decided by CSS alone would have
          no name at all. */}
      <span className="theme-when-dark sr-only">{dict.themeToLight}</span>
      <span className="theme-when-light sr-only">{dict.themeToDark}</span>

      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="h-[clamp(0.7rem,1.3vw,0.9rem)] w-[clamp(0.7rem,1.3vw,0.9rem)]"
      >
        {/* Sun: press for daylight. Shown on the night sheet. */}
        <g className="theme-when-dark">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
        </g>
        {/* Moon: press for the lights down. Shown on the day sheet. */}
        <g className="theme-when-light">
          <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
        </g>
      </svg>
    </button>
  )
}

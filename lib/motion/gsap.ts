'use client'

import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

// Registered once, here, rather than in every component that animates.
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

/** Above this width, sections may pin. Below it, every pin is disabled. */
export const PIN_BREAKPOINT = 1024

/** The three branches every animated section builds inside. */
export const MEDIA = {
  motion: `(min-width: ${PIN_BREAKPOINT}px) and (prefers-reduced-motion: no-preference)`,
  compact: `(max-width: ${PIN_BREAKPOINT - 1}px) and (prefers-reduced-motion: no-preference)`,
  reduced: '(prefers-reduced-motion: reduce)',
} as const

export { gsap, ScrollTrigger }

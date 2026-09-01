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
  /**
   * The walk into the machine, which is not a pin and so is not a width.
   *
   * Sections that pin still branch on `motion` and `compact`, because a pin
   * genuinely needs room. Walking up to the monitor does not: the machine is
   * the interface at every size, and gating it at 1024 was what left a phone
   * with a 120x60 patch of monitor that only scrolled. Reduced motion is the
   * one thing that removes the walk, and `reduced` is its exact complement, so
   * between them these two cover every visitor once.
   */
  walk: '(prefers-reduced-motion: no-preference)',
} as const

export { gsap, ScrollTrigger }

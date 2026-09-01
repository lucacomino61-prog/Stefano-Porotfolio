'use client'

import type Lenis from 'lenis'

/**
 * The live Lenis instance, so navigation and focus handlers can drive the
 * scroller directly.
 *
 * Do not reach for element.scrollIntoView() anywhere in this app. With a
 * smooth scroller installed, the native call fights Lenis and the page appears
 * to freeze; and `behavior: 'auto'` silently inherits any CSS smooth scrolling,
 * so it is not a safe fallback either.
 */
let instance: Lenis | null = null

export function setScroller(next: Lenis | null): void {
  instance = next
}

export function getScroller(): Lenis | null {
  return instance
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Scrolls to an absolute document offset, or jumps when motion is reduced. */
export function scrollToOffset(offset: number): void {
  const lenis = instance
  if (!lenis || prefersReducedMotion()) {
    window.scrollTo({ top: offset, behavior: 'auto' })
    return
  }
  lenis.scrollTo(offset, { duration: 1.1 })
}

export function scrollToTarget(target: string | HTMLElement): void {
  const lenis = instance
  if (!lenis || prefersReducedMotion()) {
    const el = typeof target === 'string' ? document.querySelector(target) : target
    if (el instanceof HTMLElement) {
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY, behavior: 'auto' })
    }
    return
  }
  lenis.scrollTo(target, { duration: 1.1 })
}

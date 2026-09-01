'use client'

import { gsap } from './gsap'

type Frame = (timeSeconds: number, deltaMs: number) => void

/**
 * The application has exactly one requestAnimationFrame loop, and it is
 * gsap.ticker. Lenis is driven from it, the WebGL canvas is advanced from it,
 * and the cursor, magnetic buttons and pointer parallax all subscribe to it.
 *
 * Anything that calls requestAnimationFrame directly is a bug: a second loop
 * means two schedulers competing for the same frame, and it makes "pause when
 * hidden" impossible to guarantee.
 */
const subscribers = new Set<Frame>()
let attached = false

function tick(timeSeconds: number, deltaMs: number): void {
  for (const fn of subscribers) fn(timeSeconds, deltaMs)
}

export function onFrame(fn: Frame): () => void {
  subscribers.add(fn)

  if (!attached) {
    // Without this, GSAP silently clamps delta after a long frame and the
    // transport stutters when the tab regains focus.
    gsap.ticker.lagSmoothing(0)
    gsap.ticker.add(tick)
    attached = true
  }

  return () => {
    subscribers.delete(fn)
    if (subscribers.size === 0 && attached) {
      gsap.ticker.remove(tick)
      attached = false
    }
  }
}

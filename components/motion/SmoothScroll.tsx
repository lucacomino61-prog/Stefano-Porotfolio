'use client'

import Lenis from 'lenis'
import { useEffect } from 'react'

import { ScrollTrigger } from '@/lib/motion/gsap'
import { prefersReducedMotion, setScroller } from '@/lib/motion/scroller'
import { onFrame } from '@/lib/motion/ticker'

/**
 * Bridges Lenis, ScrollTrigger and the single ticker. Renders nothing.
 *
 * Under reduced motion Lenis is never constructed at all. That is deliberate:
 * a smooth scroller with its duration set to zero is still a scroll hijack,
 * still intercepts the wheel, and still breaks native find-on-page behaviour.
 * The only honest kill switch is not installing it.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (prefersReducedMotion()) return

    const lenis = new Lenis({
      lerp: 0.1,
      smoothWheel: true,
      // Touch keeps native scrolling. Smoothing it fights the platform and
      // costs frames on exactly the devices that have none to spare.
      syncTouch: false,
    })
    setScroller(lenis)

    const stopFrame = onFrame((timeSeconds) => {
      lenis.raf(timeSeconds * 1000)
    })

    const handleScroll = () => ScrollTrigger.update()
    lenis.on('scroll', handleScroll)

    // Pin start and end positions are measured in pixels, so they are wrong
    // until the fonts that set the text height have actually loaded.
    const refresh = () => ScrollTrigger.refresh()
    let cancelled = false
    void document.fonts.ready.then(() => {
      if (!cancelled) refresh()
    })
    window.addEventListener('load', refresh)

    /**
     * Refresh explicitly on a width change, debounced.
     *
     * ScrollTrigger refreshes on resize itself, but defers the work, so when
     * frames are starved the deferred refresh never lands and the pin spacers
     * keep the width the window used to have. A spacer wider than the viewport
     * pushes the document sideways into empty space that nothing can scroll
     * back from. refresh() is synchronous, so calling it directly cannot be
     * starved the same way.
     *
     * Width only, on purpose. On a phone the address bar showing and hiding
     * fires resize with a changed height in the middle of a scroll, and
     * recalculating pins at that moment makes the pinned section jump under
     * the reader's finger. ScrollTrigger guards against exactly this for its
     * own refresh; an unconditional one here would have walked straight past
     * that guard.
     */
    let resizeTimer = 0
    let lastWidth = window.innerWidth
    const handleResize = () => {
      if (window.innerWidth === lastWidth) return
      lastWidth = window.innerWidth
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(refresh, 150)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelled = true
      window.clearTimeout(resizeTimer)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('load', refresh)
      lenis.off('scroll', handleScroll)
      stopFrame()
      lenis.destroy()
      setScroller(null)
    }
  }, [])

  return null
}

'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'

import { PIN_BREAKPOINT } from '@/lib/motion/gsap'
import type { Project } from '@/lib/projects'

/**
 * Keeps three, R3F and the shader out of the first-load bundle.
 *
 * The hero is above the fold, but its LCP element is DOM text over a CSS
 * fallback, not the canvas. So the canvas is allowed to arrive late: it is
 * imported only on the client, and only once the browser is idle, which means
 * roughly 160KB gzipped never competes with the text for the first paint.
 */
const HeroStage = dynamic(() => import('./HeroStage').then((m) => m.HeroStage), {
  ssr: false,
})

export function GateMount({ project }: { project: Project }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Under reduced motion the gate never runs. The CSS fallback beneath it is
    // the whole experience, and it is a complete one.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    // Nor below the pin breakpoint. The walk toward the monitor is a desktop
    // interaction, and the room it walks through is thirty-eight megabytes of
    // models and an environment map. Downloading that onto a phone to render a
    // scene the phone never scrolls through is the single most expensive thing
    // this page could do, and it would buy nothing: the projects are already on
    // the page below, full size and in the flow.
    if (window.matchMedia(`(max-width: ${PIN_BREAKPOINT - 1}px)`).matches) return

    // A `'requestIdleCallback' in window` check narrows window to never in the
    // else branch, because the DOM lib declares the method unconditionally.
    // Testing the value keeps the Safari fallback reachable.
    if (typeof window.requestIdleCallback === 'function') {
      const idle = window.requestIdleCallback(() => setMounted(true), { timeout: 2500 })
      return () => window.cancelIdleCallback(idle)
    }

    const timer = window.setTimeout(() => setMounted(true), 900)
    return () => window.clearTimeout(timer)
  }, [])

  if (!mounted) return null
  return <HeroStage project={project} />
}

'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'

import { expectScene } from '@/lib/motion/loading'
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
    // the whole experience, and it is a complete one. Telling the loader so is
    // what stops it waiting for a room that is never coming.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      expectScene(false)
      return
    }

    expectScene(true)

    // The room used to be skipped below the pin breakpoint, on the belief that
    // it weighed thirty-eight megabytes. It does not: that is the folder, most
    // of which is unreferenced source models. What actually loads is 4.1MB
    // across five models and the environment map, which is two photographs, so
    // a phone gets the room too. It does not pin or scrub there — that part is
    // still desktop only — but the workstation is the first thing this site has
    // to say, and saying it to desktop alone was the wrong trade.

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

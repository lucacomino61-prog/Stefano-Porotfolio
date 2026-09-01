'use client'

import { Canvas, type RootState } from '@react-three/fiber'
import { useEffect, useRef } from 'react'

import { gsap } from '@/lib/motion/gsap'
import { onFrame } from '@/lib/motion/ticker'

import type { ScreenView } from '@/components/ui/ProjectScreen'
import type { Project } from '@/lib/projects'

import { HeroGate } from './HeroGate'
import { deskFocusSnapshot, setDeskFocused } from '@/lib/motion/desk'

import { WorkstationScene } from './WorkstationScene'

/**
 * The single WebGL surface.
 *
 * frameloop is "never": R3F's own requestAnimationFrame is switched off and the
 * scene is advanced from gsap.ticker instead, so the whole application still
 * has exactly one loop. It also makes pausing exact rather than approximate,
 * because "pause" here means "stop calling advance", not "hope the loop
 * notices".
 *
 * Advancing stops when the gate scrolls out of view or the tab is hidden. On
 * the integrated GPUs this has to run on, that is the difference between a
 * quiet laptop and a warm one.
 */
export function HeroStage({
  project,
  view,
  hint,
  onEnter,
}: {
  project: Project
  view: ScreenView
  hint: string
  onEnter: () => void
}) {
  const wrapper = useRef<HTMLDivElement>(null)
  const state = useRef<RootState | null>(null)

  useEffect(() => {
    const el = wrapper.current
    if (!el) return

    let onScreen = true
    let visible = document.visibilityState === 'visible'

    const observer = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry?.isIntersecting ?? false
      },
      { rootMargin: '10% 0px' },
    )
    observer.observe(el)

    const handleVisibility = () => {
      visible = document.visibilityState === 'visible'
    }
    document.addEventListener('visibilitychange', handleVisibility)

    const stop = onFrame((timeSeconds) => {
      if (!onScreen || !visible) return
      state.current?.advance(timeSeconds)
    })

    // A resize while the loop is paused would otherwise leave a stale, wrongly
    // sized frame on screen until something happened to start it again.
    //
    // gsap.ticker.time, not performance.now(). With frameloop="never" R3F
    // derives its delta by subtracting the previous timestamp it was handed,
    // and gsap.ticker counts from when the ticker started while performance.now
    // counts from navigation. Mixing them hands the next frame a large negative
    // delta, which runs straight into the damping in HeroGate and blows every
    // damped value up.
    const handleResize = () => state.current?.advance(gsap.ticker.time)
    window.addEventListener('resize', handleResize)

    return () => {
      stop()
      observer.disconnect()
      window.removeEventListener('resize', handleResize)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  return (
    // Not aria-hidden any more in the sense that matters: the canvas carries a
    // real click target now. It stays out of the accessibility tree because the
    // same action is on a real button in the copy, but it must still receive
    // pointer events, which it does by default.
    <div ref={wrapper} aria-hidden="true" className="absolute inset-0 z-[1]">
      <Canvas
        /**
         * Clicking the room goes in, not just the monitor or the button.
         *
         * onPointerMissed is the click that hit no geometry at all: the space
         * above the desk, the empty part of the frame. The devices and the
         * panel stop propagation on their own clicks, so this cannot fire
         * underneath them.
         *
         * If a device is being looked at, a click on nothing dismisses it
         * rather than walking in. That is the ordinary meaning of clicking away
         * from something, and walking the camera somewhere else instead would
         * be two changes for one press.
         */
        onPointerMissed={() => {
          if (deskFocusSnapshot()) {
            setDeskFocused(null)
            return
          }
          onEnter()
        }}
        frameloop="never"
        // Capped at 2 by the brief. Beyond that the grain is invisible and the
        // fill cost is four times higher.
        dpr={[1, 2]}
        shadows
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        camera={{ position: [0, 1.15, 6.4], fov: 44, near: 0.1, far: 30 }}
        onCreated={(created) => {
          state.current = created
          // Render one frame immediately rather than waiting for the ticker.
          // With frameloop="never" the renderer does not size its drawing
          // buffer until something renders, so a stalled or late-attaching
          // loop leaves a 300x150 default canvas painting nothing. This makes
          // the first frame deterministic. Same clock as every other advance.
          created.advance(gsap.ticker.time)
        }}
      >
        <HeroGate />
        <WorkstationScene project={project} view={view} hint={hint} onEnter={onEnter} />
      </Canvas>
    </div>
  )
}

'use client'

import { Canvas, type RootState } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'

import { gsap } from '@/lib/motion/gsap'
import { onFrame } from '@/lib/motion/ticker'

import type { ScreenView } from '@/lib/screen'
import type { Project } from '@/lib/projects'

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
 * Advancing stops when the room scrolls out of view or the tab is hidden. On
 * the integrated GPUs this has to run on, that is the difference between a
 * quiet laptop and a warm one.
 */
export function HeroStage({
  project,
  view,
  hint,
  onEnter,
  onView,
}: {
  project: Project
  view: ScreenView
  hint: string
  onEnter: () => void
  onView: (view: ScreenView) => void
}) {
  const wrapper = useRef<HTMLDivElement>(null)
  const state = useRef<RootState | null>(null)

  /**
   * What this device should be asked to rasterise.
   *
   * Read once, on mount, because it decides the drawing buffer and changing it
   * mid-life reallocates every render target. HeroStage is imported with
   * ssr:false and mounted on idle, so `window` is there.
   *
   * The cap was 2 everywhere, and on a phone that is backwards. A 390x844
   * screen at device ratio 3, clamped to 2, is 780x1688: 1.32 megapixels,
   * against 1.04 on a 1273x818 desktop at ratio 1. The weakest GPU in the
   * range was being asked for 27% MORE fill than the strongest. At 1.5 it is
   * 0.74Mpx, a 44% cut, and still half again sharper than the desktop buffer.
   *
   * Antialiasing goes with it. At 1.5x on a phone the sampling is already
   * denser than the panel can resolve, so MSAA is paying a resolve on every
   * frame for an edge nobody can see.
   */
  const [profile] = useState<{ dpr: [number, number]; antialias: boolean }>(() => {
    const compact = window.innerWidth < 760
    return compact ? { dpr: [1, 1.5], antialias: false } : { dpr: [1, 2], antialias: true }
  })

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
    // delta, which runs straight into the damping in the camera rig and the
    // desk objects and blows every damped value up.
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
        // See `profile` above: the phone was rasterising more than the desktop.
        dpr={profile.dpr}
        shadows
        gl={{ antialias: profile.antialias, alpha: false, powerPreference: 'high-performance' }}
        camera={{ position: [17.2, 13.1, 24.4], fov: 38, near: 0.1, far: 80 }}
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
        <WorkstationScene
          project={project}
          view={view}
          hint={hint}
          onEnter={onEnter}
          onView={onView}
        />
      </Canvas>
    </div>
  )
}

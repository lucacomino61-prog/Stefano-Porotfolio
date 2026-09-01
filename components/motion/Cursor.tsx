'use client'

import { useEffect, useRef, useSyncExternalStore } from 'react'

import { gsap } from '@/lib/motion/gsap'
import { damp, pointer, trackPointer } from '@/lib/motion/pointer'
import { onFrame } from '@/lib/motion/ticker'

const INTERACTIVE = 'a, button, [role="button"], summary'
const TEXT_FIELD = 'input, textarea, [contenteditable="true"]'

const FINE_POINTER = '(hover: hover) and (pointer: fine)'
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

/**
 * Read through useSyncExternalStore rather than an effect that calls setState.
 *
 * It is the sanctioned way to read a browser value that differs between server
 * and client, and it earns its keep beyond satisfying the linter: subscribing
 * to both queries means the cursor appears and disappears live when a mouse is
 * connected or the reduced-motion preference is toggled, instead of being
 * decided once at mount.
 *
 * These are module-level so their identities are stable and the store does not
 * resubscribe on every render.
 */
function subscribeToCapability(onChange: () => void): () => void {
  const fine = window.matchMedia(FINE_POINTER)
  const reduced = window.matchMedia(REDUCED_MOTION)
  fine.addEventListener('change', onChange)
  reduced.addEventListener('change', onChange)
  return () => {
    fine.removeEventListener('change', onChange)
    reduced.removeEventListener('change', onChange)
  }
}

function readCapability(): boolean {
  return window.matchMedia(FINE_POINTER).matches && !window.matchMedia(REDUCED_MOTION).matches
}

/** The server never has a pointer, so it never renders the cursor. */
function readCapabilityOnServer(): boolean {
  return false
}

/**
 * The follower.
 *
 * Behaviour is adapted from Magic UI's Smooth Cursor (magicui.design, via
 * 21st.dev): a damped follow, with rotation and scale driven by pointer
 * velocity. The implementation is rewritten rather than installed, because the
 * original is incompatible with this project in four specific ways:
 *
 *   - it imports motion/react, which would put a second animation scheduler
 *     alongside gsap.ticker and the WebGL loop;
 *   - it runs its own requestAnimationFrame throttle, a third loop;
 *   - it calls setState on every mouse move, re-rendering the tree per frame;
 *   - it sets `document.body.style.cursor = "none"` unconditionally, with no
 *     `(hover: hover)` guard, so touch users lose the pointer too.
 *
 * It also leaks: the setTimeout that resets scale is created inside a
 * mousemove handler and its clear is returned from that handler, where nothing
 * ever calls it. Here the reset is derived from velocity in the ticker
 * instead, so there is no timer to leak.
 *
 * The ring is white on `mix-blend-mode: difference`, per the brief. That
 * inverts whatever is beneath it, so it stays visible over the graphite ground
 * and over a canary field without needing a colour of its own.
 */
export function Cursor() {
  const enabled = useSyncExternalStore(
    subscribeToCapability,
    readCapability,
    readCapabilityOnServer,
  )
  const ring = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ring.current
    if (!enabled || !el) return

    const root = document.documentElement
    const stopTracking = trackPointer()

    /**
     * The native pointer is hidden only while the ring is actually on screen,
     * and the two are flipped together.
     *
     * An earlier revision added the class synchronously here, while the ring
     * sat at opacity 0 until the first ticker frame with an active pointer.
     * Between those two moments, and for as long as the loop was starved or
     * the pointer never moved, the page had `cursor: none` and nothing drawn
     * in its place. The same revision could not recover: once the leave
     * handler set opacity to 0, the only code that could raise it again lived
     * behind a `started` check that had already run.
     */
    let nativeHidden = false
    const hideNative = () => {
      if (nativeHidden) return
      root.classList.add('has-custom-cursor')
      nativeHidden = true
    }
    const showNative = () => {
      if (!nativeHidden) return
      root.classList.remove('has-custom-cursor')
      nativeHidden = false
    }

    const setX = gsap.quickSetter(el, 'x', 'px')
    const setY = gsap.quickSetter(el, 'y', 'px')
    const setRotation = gsap.quickSetter(el, 'rotation', 'deg')
    const setScaleX = gsap.quickSetter(el, 'scaleX')
    const setScaleY = gsap.quickSetter(el, 'scaleY')

    let x = 0
    let y = 0
    let stretch = 0
    let angle = 0
    let started = false
    let insideWindow = true
    let lastOpacity = ''

    const stop = onFrame((_, deltaMs) => {
      const p = pointer()
      if (!p.active) return

      if (!started) {
        // Jump to the first known position instead of flying in from 0,0.
        x = p.x
        y = p.y
        started = true
      }

      // Visibility is derived every frame rather than latched by an event, so
      // there is no state the ring can get stuck in.
      const opacity = insideWindow ? '1' : '0'
      if (opacity !== lastOpacity) {
        el.style.opacity = opacity
        lastOpacity = opacity
      }
      if (insideWindow) hideNative()
      else showNative()

      const previousX = x
      const previousY = y

      // Lambda 4.5 lands close to the brief's lerp of about 0.06 per frame at
      // 60fps, but stays frame-rate independent, so a 120Hz display does not
      // get a cursor that tracks twice as tightly.
      x = damp(x, p.x, 4.5, deltaMs)
      y = damp(y, p.y, 4.5, deltaMs)
      setX(x)
      setY(y)

      const dx = x - previousX
      const dy = y - previousY

      // Pixels per second, not pixels per frame. Per-frame displacement is
      // proportional to frame duration, so a 120Hz display would have halved
      // both the rotation gate and the stretch.
      const speed = (Math.hypot(dx, dy) / Math.max(deltaMs, 1)) * 1000

      if (speed > 22) {
        angle = (Math.atan2(dy, dx) * 180) / Math.PI
        setRotation(angle)
      }

      // Stretched along the direction of travel, which is what a shutter does
      // to anything moving across the frame. Clamped so it never smears.
      stretch = damp(stretch, Math.min(0.45, speed * 0.0006), 9, deltaMs)
      setScaleX(1 + stretch)
      setScaleY(1 - stretch * 0.55)
    })

    // State comes from events, never from the frame loop.
    const handleOver = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      el.dataset.state = target.closest(TEXT_FIELD)
        ? 'text'
        : target.closest(INTERACTIVE)
          ? 'interactive'
          : 'default'
    }

    /**
     * These only record where the pointer is. The frame loop decides what that
     * means for the ring and for the native cursor, together.
     *
     * Touch is ignored. On a hybrid machine, a Windows touch laptop or an iPad
     * with a trackpad, `(hover: hover) and (pointer: fine)` matches because it
     * describes the primary pointer, so the ring mounts. But tapping the screen
     * fires pointerout then pointerleave for that touch pointer the moment it
     * lifts, and those bubble to the document. Without this guard every tap
     * would report the mouse as having left a window it never left.
     */
    const fromMouse = (event: PointerEvent) => event.pointerType !== 'touch'

    const handleLeave = (event: PointerEvent) => {
      if (!fromMouse(event)) return
      insideWindow = false
    }
    const handleEnter = (event: PointerEvent) => {
      if (!fromMouse(event)) return
      insideWindow = true
    }

    // pointerover only. It fires on entering every element and bubbles, so
    // moving from a link onto the page background raises it again on the
    // background and the state resets on its own.
    //
    // Listening to pointerout with the same handler, which an earlier revision
    // did, is backwards: on pointerout event.target is the element being LEFT,
    // so leaving a link re-asserted the interactive state instead of clearing
    // it.
    document.addEventListener('pointerover', handleOver, { passive: true })
    document.addEventListener('pointerleave', handleLeave)
    document.addEventListener('pointerenter', handleEnter)

    return () => {
      stop()
      stopTracking()
      document.removeEventListener('pointerover', handleOver)
      document.removeEventListener('pointerleave', handleLeave)
      document.removeEventListener('pointerenter', handleEnter)
      // Unconditional: if this ever fails to run the page is left with no
      // pointer, so it does not go behind the nativeHidden guard.
      root.classList.remove('has-custom-cursor')
    }
  }, [enabled])

  if (!enabled) return null

  return (
    <div
      ref={ring}
      aria-hidden="true"
      data-state="default"
      style={{ opacity: 0 }}
      className="cursor-ring"
    />
  )
}

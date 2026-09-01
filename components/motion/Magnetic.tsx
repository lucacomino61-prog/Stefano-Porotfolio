'use client'

import { useEffect, useRef } from 'react'

import { gsap } from '@/lib/motion/gsap'
import { hasFinePointer } from '@/lib/motion/pointer'
import { prefersReducedMotion } from '@/lib/motion/scroller'

type Props = {
  children: React.ReactNode
  className?: string
  /** How far the element may travel toward the pointer, in pixels. */
  strength?: number
  /** Pointer distance at which the pull starts, in pixels beyond the bounds. */
  radius?: number
}

/**
 * Pulls its child toward the pointer and springs it back.
 *
 * Driven by gsap.quickTo rather than the shared ticker on purpose: the pull is
 * event-driven, not continuous, so there is nothing to run on the frames when
 * the pointer is still. quickTo keeps the tween alive and retargets it, which
 * is interruptible in a way a fresh gsap.to on every pointermove is not.
 *
 * Reads the bounding box on pointerenter and on resize, never inside the move
 * handler, so dragging the pointer across the element cannot thrash layout.
 */
export function Magnetic({ children, className, strength = 14, radius = 90 }: Props) {
  const host = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = host.current
    if (!el) return
    if (!hasFinePointer() || prefersReducedMotion()) return

    const context = gsap.context(() => {
      const moveX = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'expo.out' })
      const moveY = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'expo.out' })

      /**
       * The box is measured lazily and invalidated by events, never measured
       * from one.
       *
       * Binding a getBoundingClientRect to the window scroll event, which an
       * earlier revision did, is a forced synchronous layout on every animated
       * frame: Lenis drives window.scrollTo from gsap.ticker, so `scroll`
       * fires once per frame for the whole of any smooth scroll. Invalidating
       * a reference costs nothing, and the next pointermove pays for the one
       * measurement it actually needs.
       */
      let box: DOMRect | null = null
      const invalidate = () => {
        box = null
      }

      // Read live rather than captured at mount, so turning reduced motion on
      // stops the pull immediately instead of at the next reload.
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')

      // quickTo restarts its tween on every call, so returning to rest is
      // guarded: without this, moving the pointer anywhere on the page relaunches
      // two half-second tweens per event on an element already at zero.
      let atRest = true

      const rest = () => {
        if (atRest) return
        atRest = true
        moveX(0)
        moveY(0)
      }

      const handleMove = (event: PointerEvent) => {
        if (reduced.matches) {
          rest()
          return
        }
        if (!box) box = el.getBoundingClientRect()
        if (!box) return

        const centreX = box.left + box.width / 2
        const centreY = box.top + box.height / 2
        const dx = event.clientX - centreX
        const dy = event.clientY - centreY
        const distance = Math.hypot(dx, dy)
        const reach = Math.max(box.width, box.height) / 2 + radius

        if (distance > reach) {
          rest()
          return
        }

        // Falls off with distance, so the pull is strongest at the centre and
        // fades rather than snapping at the edge of the radius.
        const falloff = 1 - distance / reach
        atRest = false
        moveX((dx / reach) * strength * falloff * 2)
        moveY((dy / reach) * strength * falloff * 2)
      }

      el.addEventListener('pointerenter', invalidate)
      el.addEventListener('pointerleave', rest)
      window.addEventListener('pointermove', handleMove, { passive: true })
      window.addEventListener('resize', invalidate)
      window.addEventListener('scroll', invalidate, { passive: true })
      reduced.addEventListener('change', rest)

      return () => {
        el.removeEventListener('pointerenter', invalidate)
        el.removeEventListener('pointerleave', rest)
        window.removeEventListener('pointermove', handleMove)
        window.removeEventListener('resize', invalidate)
        window.removeEventListener('scroll', invalidate)
        reduced.removeEventListener('change', rest)
      }
    }, el)

    return () => context.revert()
  }, [strength, radius])

  /**
   * A wrapper span rather than cloneElement onto the child. Cloning would need
   * the child to forward a ref, and refs cannot cross a server-to-client
   * boundary, so a server-rendered link passed in as children would silently
   * never move. The wrapper is inline-block so it takes the child's own box.
   */
  return (
    <span ref={host} className={className ? `inline-block ${className}` : 'inline-block'}>
      {children}
    </span>
  )
}

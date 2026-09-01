'use client'

import { useEffect, useRef } from 'react'

import { MEDIA, ScrollTrigger, gsap } from '@/lib/motion/gsap'
import type { Dictionary } from '@/lib/i18n/dictionaries'

/**
 * The process as an edit decision list: numbered scenes against a running rail.
 *
 * Scene numbers are earned here. The craft floor bans decorative 01/02/03
 * labels, but this sequence is the information: the steps happen in this order
 * and the order is the point.
 *
 * Nothing expands or collapses. Every step stays readable at all times and the
 * scrub only moves emphasis, because animating height is a layout property and
 * a reader who scrolls back should not have to re-open anything.
 */
export function Process({
  dict,
  label,
}: {
  dict: Dictionary['process']
  label: string
}) {
  const root = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = root.current
    if (!el) return

    const ctx = gsap.context(() => {
      const rows = gsap.utils.toArray<HTMLElement>('[data-step]')
      const fill = el.querySelector<HTMLElement>('[data-rail-fill]')
      if (rows.length === 0 || !fill) return

      const setFill = gsap.quickSetter(fill, 'scaleY')
      const media = gsap.matchMedia()

      const markActive = (index: number) => {
        rows.forEach((row, i) => {
          row.dataset.active = i === index ? 'true' : 'false'
        })
      }

      const build = (pin: boolean) => {
        gsap.set(fill, { scaleY: 0, transformOrigin: 'top center' })
        markActive(0)

        const trigger = ScrollTrigger.create({
          trigger: el,
          start: 'top top',
          end: () => `+=${rows.length * 60}%`,
          scrub: 0.6,
          pin,
          anticipatePin: pin ? 1 : 0,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            setFill(self.progress)
            // Floor rather than round, so each step owns an equal slice and
            // the last one is not reachable only at exactly 100%.
            const index = Math.min(rows.length - 1, Math.floor(self.progress * rows.length))
            markActive(index)
          },
        })

        return () => trigger.kill()
      }

      media.add(MEDIA.motion, () => build(true))
      media.add(MEDIA.compact, () => build(false))

      // Reduced motion: no trigger at all. Every step reads at full strength
      // and the rail is simply full.
      media.add(MEDIA.reduced, () => {
        gsap.set(fill, { scaleY: 1, transformOrigin: 'top center' })
        rows.forEach((row) => {
          row.dataset.active = 'true'
        })
      })

      return () => media.revert()
    }, el)

    return () => ctx.revert()
  }, [])

  return (
    <section
      ref={root}
      id="process"
      data-scene
      data-scene-label={label}
      className="flex min-h-[100svh] items-center px-[var(--gutter)] py-[clamp(4rem,10vh,7rem)]"
    >
      <div className="w-full">
        <h2 className="max-w-[20ch] font-display text-[clamp(1.6rem,3.6vw,2.9rem)] leading-[1.08] font-medium tracking-[-0.03em]">
          {dict.heading}
        </h2>
        <p className="mt-4 max-w-[52ch] text-[clamp(0.95rem,1.3vw,1.05rem)] text-ink-muted">
          {dict.intro}
        </p>

        <div className="mt-[clamp(2.5rem,6vh,4rem)] flex gap-[clamp(1rem,3vw,2.5rem)]">
          {/* The rail. A hairline track with a canary fill that runs the
              length of the sequence as you scroll it. */}
          <div
            aria-hidden="true"
            className="relative w-px shrink-0 self-stretch bg-rule"
          >
            <div data-rail-fill className="absolute inset-0 origin-top bg-mark" />
          </div>

          <ol className="flex-1 space-y-[clamp(1.5rem,3.5vh,2.5rem)]">
            {dict.steps.map((step, index) => (
              /* Emphasis is carried by colour, never by dimming.
                 Dimming the inactive rows to 45% measured about 2.3:1 against
                 the ground, and these rows are not a transient state: all five
                 are on screen the whole time the section is pinned, so four of
                 them would sit permanently below AA. Muted and full are both
                 legible on their own (6.7:1 and 16.8:1), and the difference
                 between them still reads clearly as emphasis. */
              <li
                key={step.id}
                data-step
                data-active="false"
                className="group grid grid-cols-[2.5rem_1fr] gap-x-3 sm:grid-cols-[3.5rem_1fr]"
              >
                <span className="tabular pt-1 text-[11px] tracking-[0.1em] text-ink-muted transition-colors duration-[var(--f10)] group-data-[active=true]:text-mark">
                  {(index + 1).toString().padStart(2, '0')}
                </span>
                <div>
                  <h3 className="font-display text-[clamp(1.05rem,1.9vw,1.5rem)] font-medium tracking-[-0.02em] text-ink-muted transition-colors duration-[var(--f10)] ease-[var(--ease-out)] group-data-[active=true]:text-ink">
                    {step.label}
                  </h3>
                  <p className="mt-2 max-w-[58ch] text-[clamp(0.9rem,1.2vw,1rem)] leading-relaxed text-ink-muted transition-colors duration-[var(--f10)] ease-[var(--ease-out)] group-data-[active=true]:text-ink">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}

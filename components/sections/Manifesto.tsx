'use client'

import { Fragment, useEffect, useRef } from 'react'

import { MEDIA, ScrollTrigger, gsap } from '@/lib/motion/gsap'
import type { Dictionary } from '@/lib/i18n/dictionaries'

/**
 * One statement, revealed word by word against the scrollbar.
 *
 * The reveal is scrubbed rather than triggered: the words track the scroll
 * position both ways, so scrolling back up un-reveals them. A one-shot trigger
 * would leave the statement fully lit the moment you glance away and back.
 */
export function Manifesto({
  dict,
  about,
  label,
}: {
  dict: Dictionary['manifesto']
  about: Dictionary['about']
  label: string
}) {
  const root = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = root.current
    if (!el) return

    const ctx = gsap.context(() => {
      const words = gsap.utils.toArray<HTMLElement>('[data-word]')
      if (words.length === 0) return

      const media = gsap.matchMedia()

      // The 0.45 floor is an accessibility constraint, not a taste one. A
      // scrubbed reveal has no transient states: the reader can stop anywhere
      // and stay there, so every value the scrub can hold has to be legible.
      // An earlier 0.12 floor measured about 1.4:1 against the ground. At 0.45
      // the unrevealed word is roughly 3.9:1, which clears AA for text this
      // size, and the stagger plus the y travel still carry the reveal.
      //
      // Desktop: the section pins and the statement resolves across 140% of a
      // viewport, so the words have room to land one at a time.
      media.add(MEDIA.motion, () => {
        gsap.set(words, { opacity: 0.45, y: 18 })
        const tween = gsap.to(words, {
          opacity: 1,
          y: 0,
          ease: 'none',
          stagger: { each: 0.05 },
          scrollTrigger: {
            trigger: el,
            start: 'top top',
            end: '+=140%',
            scrub: 1,
            pin: true,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        })
        return () => {
          tween.scrollTrigger?.kill()
          tween.kill()
        }
      })

      // Below the pin breakpoint nothing pins. The same reveal runs against the
      // section's own travel through the viewport.
      media.add(MEDIA.compact, () => {
        gsap.set(words, { opacity: 0.45, y: 12 })
        const tween = gsap.to(words, {
          opacity: 1,
          y: 0,
          ease: 'none',
          stagger: { each: 0.04 },
          scrollTrigger: {
            trigger: el,
            start: 'top 80%',
            end: 'bottom 60%',
            scrub: true,
            invalidateOnRefresh: true,
          },
        })
        return () => {
          tween.scrollTrigger?.kill()
          tween.kill()
        }
      })

      // Reduced motion creates no ScrollTrigger at all. The statement is simply
      // legible from the moment it enters the viewport.
      media.add(MEDIA.reduced, () => {
        gsap.set(words, { opacity: 1, y: 0 })
      })

      return () => media.revert()
    }, el)

    return () => {
      ctx.revert()
      ScrollTrigger.refresh()
    }
  }, [])

  const words = dict.statement.split(' ')

  return (
    <section
      ref={root}
      id="manifesto"
      data-scene
      data-scene-label={label}
      className="about"
    >
      <div className="atmos about-atmos" aria-hidden="true" />

      <div className="about-inner">
        <header className="about-head">
          <p className="label">{about.kicker}</p>
          <h2 className="display about-heading">{about.heading}</h2>
        </header>

        <div className="about-body">
          {/* The statement keeps its scrubbed reveal: it is the one piece of
              writing on the page that is an argument rather than a label, and
              reading it one word at a time is the reading it deserves. */}
          <p className="about-statement">
            {/* The space is a sibling of the word, never a child of it. Inside
                an inline-block a trailing space sits at the edge of the line box
                and is collapsed away, which runs every word in the statement
                into the next one. */}
            {words.map((word, index) => (
              <Fragment key={`${word}-${index}`}>
                <span data-word className="inline-block will-change-transform">
                  {word}
                </span>
                {index < words.length - 1 ? ' ' : null}
              </Fragment>
            ))}
          </p>

          <p className="lede about-lede">{about.lede}</p>
        </div>

        {/* Capabilities as a list of names. No bars, no percentages: a number
            against a skill is a claim nobody can check and everybody discounts. */}
        <div className="about-capabilities">
          <h3 className="label about-capabilities-label">{about.capabilitiesLabel}</h3>
          <ul className="about-capability-list">
            {about.capabilities.map((capability, index) => (
              <li key={capability} className="about-capability">
                <span className="tabular about-capability-index" aria-hidden="true">
                  {(index + 1).toString().padStart(2, '0')}
                </span>
                {capability}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

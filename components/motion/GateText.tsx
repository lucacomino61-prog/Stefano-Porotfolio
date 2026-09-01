'use client'

import { Fragment, useEffect, useRef } from 'react'

import { gsap } from '@/lib/motion/gsap'

type Props = {
  text: string
  className?: string
  /** Seconds. Lets a following line trail the one above it. */
  delay?: number
  /** Splits on words instead of characters. Use for anything longer than a name. */
  by?: 'char' | 'word'
}

/**
 * Text that advances through a film gate rather than fading in.
 *
 * Two rules this component exists to enforce:
 *
 * 1. Transform only, never opacity. This renders the largest text on the page,
 *    which is the LCP element, and an element at opacity 0 is not counted as
 *    painted. Fading it in would push LCP out by the whole animation duration.
 *
 * 2. The visible glyphs are aria-hidden and the real string sits on the
 *    wrapper's aria-label, so a screen reader reads a sentence rather than
 *    spelling out one letter per element.
 */
export function GateText({ text, className, delay = 0, by = 'char' }: Props) {
  const root = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = root.current
    if (!el) return

    const slots = el.querySelectorAll<HTMLElement>('.gate-slot > span')
    if (slots.length === 0) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      gsap.set(slots, { yPercent: 0 })
      return
    }

    const ctx = gsap.context(() => {
      gsap.set(slots, { yPercent: 108 })
      // Waiting on fonts matters twice over: the glyph widths change the split,
      // and starting before they land animates the fallback face.
      void document.fonts.ready.then(() => {
        gsap.to(slots, {
          yPercent: 0,
          duration: 0.9,
          delay,
          ease: 'expo.out',
          stagger: by === 'char' ? 0.035 : 0.05,
        })
      })
    }, el)

    return () => ctx.revert()
  }, [text, delay, by])

  // Splitting on characters puts every glyph in its own inline-block, which
  // hands the browser a break opportunity between any two letters. Grouping a
  // word in a nowrap span takes those back, so a name too wide for the line
  // wraps as "Stefano / Doko" and never as "Stefan / o Doko". The spaces sit
  // outside the groups because they are the only breaks that should survive.
  const words = text.split(' ')

  return (
    <span ref={root} className={className} aria-label={text}>
      {words.map((word, wordIndex) => (
        <Fragment key={`${word}-${wordIndex}`}>
          {by === 'word' ? (
            <span className="gate-slot" aria-hidden="true">
              <span>{word}</span>
            </span>
          ) : (
            <span className="whitespace-nowrap" aria-hidden="true">
              {Array.from(word).map((char, charIndex) => (
                <span key={`${char}-${charIndex}`} className="gate-slot">
                  <span>{char}</span>
                </span>
              ))}
            </span>
          )}
          {wordIndex < words.length - 1 ? <span aria-hidden="true"> </span> : null}
        </Fragment>
      ))}
    </span>
  )
}

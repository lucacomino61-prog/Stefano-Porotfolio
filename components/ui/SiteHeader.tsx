'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

import { LOCALES, type Locale } from '@/lib/i18n/config'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { getScroller, scrollToTarget } from '@/lib/motion/scroller'
import { onFrame } from '@/lib/motion/ticker'
import type { Scene } from '@/lib/sections'

/** The page is treated as a two minute reel running at 24 frames per second. */
const FPS = 24
const REEL_SECONDS = 120

function pad(value: number): string {
  return value.toString().padStart(2, '0')
}

function timecode(progress: number): string {
  const frames = Math.max(0, Math.min(1, progress)) * REEL_SECONDS * FPS
  const whole = Math.floor(frames)
  const seconds = Math.floor(whole / FPS)
  return [
    pad(Math.floor(seconds / 3600)),
    pad(Math.floor(seconds / 60) % 60),
    pad(seconds % 60),
    pad(whole % FPS),
  ].join(':')
}

/**
 * Name on the left, sections on the right, and the reel position between them.
 *
 * This replaces the timecode rail that used to run down the left edge. The rail
 * was the better object and the worse decision: it took a fixed 7.5rem out of
 * every viewport for the whole scroll, and the first screen is now a room with a
 * desk in it that wants the full width. The rail's actual work — scroll position
 * and which section you are in — is all still here, just laid along the top.
 *
 * Nothing in the frame loop touches the DOM to read. The readout is written only
 * when the string changes, and the active section is written as a data attribute
 * only when the index changes, so a scroll that moves nothing writes nothing.
 */
export function SiteHeader({
  nav,
  locale,
  scenes,
  name,
}: {
  nav: Dictionary['nav']
  locale: Locale
  scenes: Scene[]
  name: string
}) {
  const readout = useRef<HTMLSpanElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const shell = useRef<HTMLElement>(null)
  const pathname = usePathname()

  useEffect(() => {
    if (scenes.length === 0) return

    let maxScroll = 1
    let viewportHeight = window.innerHeight
    let offsets: number[] = []

    const measure = () => {
      viewportHeight = window.innerHeight
      maxScroll = Math.max(1, document.documentElement.scrollHeight - viewportHeight)
      offsets = scenes.map((scene) => {
        const el = document.getElementById(scene.id)
        return el ? el.getBoundingClientRect().top + window.scrollY : 0
      })
    }
    measure()

    let lastCode = ''
    let lastActive = -1
    let lastLifted = false

    const stop = onFrame(() => {
      const lenis = getScroller()
      const y = lenis ? lenis.scroll : window.scrollY

      const code = timecode(y / maxScroll)
      if (code !== lastCode && readout.current) {
        readout.current.textContent = code
        lastCode = code
      }

      // The bar only takes a ground once it has something to sit over. At the
      // top of the page it is type on the room, which is the point of the room.
      const lifted = y > viewportHeight * 0.12
      if (lifted !== lastLifted && shell.current) {
        shell.current.dataset.lifted = lifted ? 'true' : 'false'
        lastLifted = lifted
      }

      const line = y + viewportHeight * 0.34
      let active = 0
      for (let i = 0; i < offsets.length; i += 1) {
        if (offsets[i] !== undefined && line >= (offsets[i] as number)) active = i
      }
      if (active !== lastActive && list.current) {
        const items = list.current.querySelectorAll<HTMLElement>('[data-scene-link]')
        items.forEach((item, index) => {
          item.dataset.active = index === active ? 'true' : 'false'
        })
        lastActive = active
      }
    })

    window.addEventListener('resize', measure)
    return () => {
      stop()
      window.removeEventListener('resize', measure)
    }
  }, [scenes])

  const restOfPath = pathname.replace(/^\/[^/]+/, '')

  return (
    <header ref={shell} data-lifted="false" className="site-header">
      <a
        href="#hero"
        onClick={(event) => {
          event.preventDefault()
          scrollToTarget('#hero')
        }}
        className="site-word"
      >
        {name}
      </a>

      <span ref={readout} aria-hidden="true" className="tabular site-timecode">
        00:00:00:00
      </span>

      <nav aria-label={nav.sections}>
        <ul ref={list} className="site-nav">
          {scenes.map((scene, index) => (
            <li key={scene.id}>
              <a
                href={`#${scene.id}`}
                data-scene-link
                data-active="false"
                onClick={(event) => {
                  event.preventDefault()
                  scrollToTarget(`#${scene.id}`)
                }}
                className="site-nav-link"
              >
                <span className="tabular site-nav-index" aria-hidden="true">
                  {pad(index + 1)}
                </span>
                {scene.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <ul className="site-locales" aria-label={nav.languageLabel}>
        {LOCALES.map((code) => (
          <li key={code}>
            <a
              href={`/${code}${restOfPath}`}
              hrefLang={code}
              aria-current={code === locale ? 'true' : undefined}
              className="tabular site-locale"
            >
              {code}
            </a>
          </li>
        ))}
      </ul>
    </header>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'

import type { Dictionary } from '@/lib/i18n/dictionaries'

/**
 * The sound switch.
 *
 * Room tone is what a sound recordist captures so the silences in a cut match
 * the takes around them, and that is what plays here: a low, looping bed rather
 * than a song competing with the page.
 *
 * Three rules this enforces:
 *
 * 1. It starts off, always. Autoplay with sound is blocked by every browser
 *    worth supporting and unwelcome where it is not, so the first play is a
 *    click and the audio element carries `preload="none"` — nothing is fetched
 *    until someone asks for it, which keeps half a megabyte out of the initial
 *    load.
 * 2. It fades rather than cuts. A track snapping to full volume is a jump
 *    scare; the gain ramps over about half a second in both directions.
 * 3. It tells the truth about its own state. `play()` returns a promise that
 *    can reject, so the button follows what the element actually did, never
 *    what it was asked to do.
 */
const SRC = '/audio/room-tone.wav'
const VOLUME = 0.45
const FADE_MS = 500

export function SoundToggle({ dict }: { dict: Dictionary['hero'] }) {
  const audio = useRef<HTMLAudioElement>(null)
  const fade = useRef<ReturnType<typeof setInterval>>(undefined)
  const [playing, setPlaying] = useState(false)

  useEffect(() => () => clearInterval(fade.current), [])

  const ramp = (to: number, done?: () => void) => {
    const el = audio.current
    if (!el) return

    clearInterval(fade.current)
    const from = el.volume
    const started = performance.now()

    fade.current = setInterval(() => {
      const k = Math.min(1, (performance.now() - started) / FADE_MS)
      el.volume = from + (to - from) * k
      if (k === 1) {
        clearInterval(fade.current)
        done?.()
      }
    }, 40)
  }

  const toggle = async () => {
    const el = audio.current
    if (!el) return

    if (playing) {
      ramp(0, () => el.pause())
      setPlaying(false)
      return
    }

    el.volume = 0
    try {
      await el.play()
      ramp(VOLUME)
      setPlaying(true)
    } catch {
      // Blocked, or the file is not there. Say nothing and stay off: the page
      // does not need the audio to work.
      setPlaying(false)
    }
  }

  const label = playing ? dict.soundOff : dict.soundOn

  return (
    <>
      <audio ref={audio} src={SRC} loop preload="none" />
      <button
        type="button"
        onClick={toggle}
        aria-pressed={playing}
        aria-label={label}
        title={label}
        className="plate group cursor-pointer transition-colors duration-[var(--f4)] hover:text-slate-mark"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="h-[clamp(0.7rem,1.3vw,0.9rem)] w-[clamp(0.7rem,1.3vw,0.9rem)]"
        >
          <path d="M11 5 6 9H3v6h3l5 4z" />
          {playing ? (
            <>
              <path d="M15.5 8.5a5 5 0 0 1 0 7" />
              <path d="M18.5 5.5a9 9 0 0 1 0 13" />
            </>
          ) : (
            <>
              <path d="M16 9.5 21 15" />
              <path d="M21 9.5 16 15" />
            </>
          )}
        </svg>
      </button>
    </>
  )
}

'use client'

import { useEffect, useState } from 'react'

import type { Dictionary } from '@/lib/i18n/dictionaries'

/**
 * The clock and the date, set as two slates under the name.
 *
 * A camera report is stamped with when it was shot, so the apparatus row states
 * the same two facts: the time running now and the day it is running on.
 *
 * Both are client-only values. The server cannot know the visitor's clock, and
 * rendering its own would hydrate into a mismatch, so the markup ships fixed
 * placeholders of the same character count and fills them on mount. Same width,
 * same box: the swap costs no layout shift, which matters because these sit
 * directly under the LCP element.
 *
 * Neither reading goes through Intl. The clock is three padded numbers, and the
 * date takes its words from the dictionary — see the note on `calendar` there
 * for why that is not an oversight.
 */
const TIME_PLACEHOLDER = '--:--:--'
const DATE_PLACEHOLDER = '--- -- --- ----'

function pad(value: number): string {
  return value.toString().padStart(2, '0')
}

function formatTime(now: Date): string {
  return [pad(now.getHours()), pad(now.getMinutes()), pad(now.getSeconds())].join(':')
}

/** Day before month, in every language. A stamp, not a sentence. */
function formatDate(now: Date, calendar: Dictionary['calendar']): string {
  return [
    calendar.weekdays[now.getDay()],
    pad(now.getDate()),
    calendar.months[now.getMonth()],
    now.getFullYear(),
  ].join(' ')
}

export function Readouts({
  dict,
  calendar,
}: {
  dict: Dictionary['hero']
  calendar: Dictionary['calendar']
}) {
  const [time, setTime] = useState(TIME_PLACEHOLDER)
  const [date, setDate] = useState(DATE_PLACEHOLDER)

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setTime(formatTime(now))
      setDate(formatDate(now, calendar))
    }
    tick()

    // Line the interval up with the next whole second, so the readout changes
    // when the second changes rather than drifting a few hundred milliseconds
    // behind it. One timer, re-armed, instead of a frame loop: this needs to be
    // right once a second, not sixty times.
    let interval: ReturnType<typeof setInterval> | undefined
    const align = setTimeout(
      () => {
        tick()
        interval = setInterval(tick, 1000)
      },
      1000 - (Date.now() % 1000),
    )

    return () => {
      clearTimeout(align)
      if (interval) clearInterval(interval)
    }
  }, [calendar])

  return (
    <>
      <p className="plate tabular text-[clamp(0.6rem,1.1vw,0.75rem)]">
        <span className="sr-only">{dict.clockLabel}: </span>
        <time suppressHydrationWarning>{time}</time>
      </p>
      <p className="plate tabular text-[clamp(0.6rem,1.1vw,0.75rem)] tracking-[0.06em]">
        <span className="sr-only">{dict.dateLabel}: </span>
        <time suppressHydrationWarning>{date}</time>
      </p>
    </>
  )
}

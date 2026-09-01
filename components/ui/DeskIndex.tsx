'use client'

import { useSyncExternalStore } from 'react'

import type { Dictionary } from '@/lib/i18n/dictionaries'
import {
  DESK_OBJECT_IDS,
  type DeskObjectId,
  deskFocusServerSnapshot,
  deskFocusSnapshot,
  setDeskFocused,
  subscribeDeskFocus,
} from '@/lib/motion/desk'

/**
 * The devices on the desk, as controls.
 *
 * A mesh cannot be tabbed to, cannot be announced, and cannot be translated. So
 * the room's interactivity is mirrored here in real buttons, and these are the
 * canonical controls rather than a fallback: pressing one moves the camera by
 * exactly the same path a click in the scene takes, because both write to the
 * same store.
 *
 * Focus is read through useSyncExternalStore rather than lifted into React
 * state. The scene writes the store from a pointer event, and there is no
 * component above both the canvas and this strip that could own the value
 * without re-rendering the canvas to change a caption.
 *
 * Placement and visibility live in `.cinema-desk` in globals.css, next to the
 * other rules that position things on the pinned stage. Appended in flow after
 * the hero copy it measured 943px down a 919px viewport, which put the controls
 * for the desk out of sight at exactly the moment the desk was in view.
 *
 * That stylesheet rule also owns the 760px cut, matching the breakpoint the
 * scene uses to decide the devices are inspectable at all. One source, because
 * two places agreeing by coincidence is a bug waiting to happen.
 */
export function DeskIndex({ dict }: { dict: Dictionary['deskIndex'] }) {
  const focused = useSyncExternalStore(
    subscribeDeskFocus,
    deskFocusSnapshot,
    deskFocusServerSnapshot,
  )

  return (
    <div role="group" aria-label={dict.label} className="cinema-desk border-t border-rule pt-3">
      <p className="tabular text-[10px] tracking-[0.14em] text-ink-muted uppercase">{dict.label}</p>

      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {DESK_OBJECT_IDS.map((id: DeskObjectId) => {
          const active = focused === id
          return (
            <li key={id}>
              <button
                type="button"
                // Pressed rather than current: this is a toggle that changes
                // what the camera is looking at, not a location in the site.
                aria-pressed={active}
                onClick={() => setDeskFocused(active ? null : id)}
                className="font-display text-[0.95rem] text-ink-muted underline-offset-[6px] transition-colors duration-[var(--f4)] ease-[var(--ease-out)] hover:text-ink focus-visible:text-ink aria-pressed:text-mark aria-pressed:underline"
              >
                {dict.objects[id].name}
              </button>
            </li>
          )
        })}
      </ul>

      {/* The note and the release live in one region so a screen reader hears
          the device change once, not twice. aria-live is polite because the
          visitor caused this and does not need interrupting about it. */}
      <div aria-live="polite" className="mt-2 min-h-[2.75rem]">
        {focused ? (
          <>
            <p className="max-w-[44ch] text-[0.9rem] leading-relaxed text-ink-muted">
              {dict.objects[focused].note}
            </p>
            <button
              type="button"
              onClick={() => setDeskFocused(null)}
              className="tabular mt-2 text-[10px] tracking-[0.14em] text-mark uppercase transition-opacity duration-[var(--f4)] hover:opacity-70"
            >
              {dict.release}
            </button>
          </>
        ) : (
          <p className="max-w-[44ch] text-[0.9rem] leading-relaxed text-ink-muted/80">
            {dict.hint}
          </p>
        )}
      </div>
    </div>
  )
}

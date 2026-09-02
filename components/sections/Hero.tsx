import { GateText } from '@/components/motion/GateText'
import { CircledTake } from '@/components/ui/CircledTake'
import { Readouts } from '@/components/ui/Readouts'
import { SoundToggle } from '@/components/ui/SoundToggle'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import type { Dictionary } from '@/lib/i18n/dictionaries'

/**
 * The first screen, as type only.
 *
 * The room behind it belongs to Cinema, which owns the canvas and the walk. This
 * is the copy that stands in front of it, and it is deliberately held to one
 * side: the workstation sits right of centre at every breakpoint, so the column
 * runs down the left and nothing is ever set over the monitor.
 *
 * Two registers, and the split is the whole idea. The slates are apparatus —
 * who this is, what he does, what time it is, and the two switches — set in the
 * mono the timecode uses, because they are readings rather than sentences. The
 * line underneath is the editorial voice, set large in the display face. A page
 * that sets everything in one of those registers is either a spreadsheet or a
 * poster; the first screen needs to be both.
 */
export function Hero({
  dict,
  calendar,
  enterLabel,
  onEnter,
}: {
  dict: Dictionary['hero']
  calendar: Dictionary['calendar']
  enterLabel: string
  onEnter: () => void
}) {
  return (
    <div className="hero-copy">
      <div className="hero-slates">
        <h1 className="plate hero-name">
          <GateText text={dict.name} />
        </h1>

        <p className="plate hero-role text-slate-ink-muted">{dict.role}</p>

        <div className="hero-apparatus">
          <Readouts dict={dict} calendar={calendar} />
          <SoundToggle dict={dict} />
          <ThemeToggle dict={dict} />
        </div>
      </div>

      <div className="hero-statement">

        <div className="hero-actions">
          {/* The monitor in the room is clickable, but a click target that only
              exists inside WebGL cannot be tabbed to, cannot be announced and
              does not exist at all for anyone not using a mouse. This is the
              same action as a real control. */}
          <CircledTake onClick={onEnter}>
            {enterLabel}
          </CircledTake>

          <a href="#contact" className="hero-secondary">
            {dict.cta}
          </a>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { Dictionary } from '@/lib/i18n/dictionaries'
import { PROJECTS } from '@/lib/projects'

/**
 * The cash machine outside the bank, once you are standing at it.
 *
 * It dispenses exactly one thing, a business card, because that is the one
 * transaction this site exists to make. Everything else on the menu reads the
 * facts the rest of the site already states: the balance is two shipped sites
 * and five capabilities against zero handovers, the statement is the five
 * passes of the process. Nothing here invents a figure.
 *
 * Any four digits are a PIN. A machine that refused would be a puzzle, and a
 * puzzle in front of the contact details is a wall.
 *
 * `active` resets it. Walk away and the card comes back out, the way a real
 * one times out, so the next visitor finds it idle.
 */
type State = 'idle' | 'pin' | 'menu' | 'dispensing' | 'receipt' | 'balance' | 'statement' | 'eject'

const KEYPAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** Day, month, year, then the time. A stamp, not a sentence, and not Intl (see the calendar note in the dictionary). */
function stamp(now: Date): string {
  return `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}  ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

export function AtmScreen({
  dict,
  hero,
  about,
  steps,
  active = true,
}: {
  dict: Dictionary['atm']
  hero: Dictionary['hero']
  about: Dictionary['about']
  steps: Dictionary['process']
  active?: boolean
}) {
  const root = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<State>('idle')
  const [pin, setPin] = useState('')
  const [time, setTime] = useState('--:--')
  const [printed, setPrinted] = useState('')
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL

  // The clock in the corner. Once a minute, aligned to the minute.
  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setTime(`${pad(now.getHours())}:${pad(now.getMinutes())}`)
    }
    tick()
    let interval: ReturnType<typeof setInterval> | undefined
    const align = setTimeout(
      () => {
        tick()
        interval = setInterval(tick, 60_000)
      },
      60_000 - (Date.now() % 60_000),
    )
    return () => {
      clearTimeout(align)
      if (interval) clearInterval(interval)
    }
  }, [])

  // Arriving puts the keys under your hand. A tick late on purpose: the walk
  // focuses its Back control in an effect that runs after this one, and the
  // keypad has to end up with the focus, not lose it.
  useEffect(() => {
    if (!active) return
    const timer = window.setTimeout(() => root.current?.focus({ preventScroll: true }), 0)
    return () => window.clearTimeout(timer)
  }, [active])

  // Walking away ejects the card. Adjusted from the prop during render, the
  // documented pattern, rather than in an effect that would render the idle
  // screen a frame late.
  const [wasActive, setWasActive] = useState(active)
  if (active !== wasActive) {
    setWasActive(active)
    if (!active) {
      setState('idle')
      setPin('')
    }
  }

  // Four digits and the machine moves on by itself, after a beat to show the fourth.
  useEffect(() => {
    if (state !== 'pin' || pin.length < 4) return
    const timer = setTimeout(() => setState('menu'), 420)
    return () => clearTimeout(timer)
  }, [state, pin])

  // The timed states: the dispense, and the card coming back out.
  useEffect(() => {
    if (state === 'dispensing') {
      const timer = setTimeout(() => setState('receipt'), 1900)
      return () => clearTimeout(timer)
    }
    if (state === 'eject') {
      const timer = setTimeout(() => {
        setState('idle')
        setPin('')
      }, 2600)
      return () => clearTimeout(timer)
    }
  }, [state])

  const press = useCallback((digit: string) => {
    setPin((current) => (current.length >= 4 ? current : current + digit))
  }, [])

  const withdraw = useCallback(() => {
    setPrinted(stamp(new Date()))
    setState('dispensing')
  }, [])

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (state === 'pin') {
      if (/^[0-9]$/.test(event.key)) {
        press(event.key)
        event.preventDefault()
      } else if (event.key === 'Backspace') {
        setPin((current) => current.slice(0, -1))
        event.preventDefault()
      }
      return
    }
    if (state === 'idle' && event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) {
      setState('pin')
      event.preventDefault()
    }
  }

  return (
    <div ref={root} className="screen-ui atm-ui" data-state={state} tabIndex={-1} onKeyDown={onKeyDown}>
      <div className="atm-head">
        <span className="atm-brand">RAIFFEISEN BANK</span>
        <span className="atm-name">{dict.title}</span>
        <time className="atm-clock tabular">{time}</time>
      </div>

      <div className="atm-body">
        {state === 'idle' ? (
          <div className="atm-screen">
            <p className="atm-prompt atm-blink">{dict.insertCard}</p>
            <button type="button" className="atm-button" onClick={() => setState('pin')}>
              <span className="atm-card-chip" aria-hidden="true" />
              <span>{dict.insert}</span>
            </button>
          </div>
        ) : null}

        {state === 'pin' ? (
          <div className="atm-screen">
            <p className="atm-prompt">{dict.enterPin}</p>
            <p className="atm-digits" aria-live="polite" aria-label={`${pin.length} / 4`}>
              {[0, 1, 2, 3].map((i) => (
                <span key={i} data-filled={i < pin.length} aria-hidden="true" />
              ))}
            </p>
            <div className="atm-keypad">
              {KEYPAD.map((digit) => (
                <button key={digit} type="button" className="atm-key" onClick={() => press(digit)}>
                  {digit}
                </button>
              ))}
              <button type="button" className="atm-key atm-key-clear" onClick={() => setPin('')}>
                {dict.clear}
              </button>
              <button type="button" className="atm-key" onClick={() => press('0')}>
                0
              </button>
              <button
                type="button"
                className="atm-key atm-key-enter"
                disabled={pin.length < 4}
                onClick={() => setState('menu')}
              >
                {dict.enter}
              </button>
            </div>
            <p className="atm-hint">{dict.pinHint}</p>
          </div>
        ) : null}

        {state === 'menu' ? (
          <div className="atm-screen">
            <p className="atm-prompt">{dict.welcome}</p>
            <div className="atm-options">
              <button type="button" className="atm-option" onClick={withdraw}>
                <span>{dict.withdraw}</span>
                <small>{dict.withdrawNote}</small>
              </button>
              <button type="button" className="atm-option" onClick={() => setState('balance')}>
                <span>{dict.balance}</span>
                <small>{dict.balanceNote}</small>
              </button>
              <button type="button" className="atm-option" onClick={() => setState('statement')}>
                <span>{dict.statement}</span>
                <small>{dict.statementNote}</small>
              </button>
              <button type="button" className="atm-option" onClick={() => setState('eject')}>
                <span>{dict.exit}</span>
                <small>{dict.exitNote}</small>
              </button>
            </div>
          </div>
        ) : null}

        {state === 'dispensing' ? (
          <div className="atm-screen" role="status">
            <p className="atm-prompt">{dict.dispensing}</p>
            <div className="atm-progress" aria-hidden="true">
              <i />
            </div>
          </div>
        ) : null}

        {state === 'receipt' ? (
          <div className="atm-screen">
            {/* The slip. What comes out of the machine is the card: who this is,
                what he does, and the one address that reaches him. */}
            <div className="atm-receipt" role="status">
              <p className="atm-receipt-head">RAIFFEISEN BANK · {dict.title.toUpperCase()}</p>
              <p className="tabular">{printed}</p>
              <hr />
              <p className="atm-receipt-name">{hero.name}</p>
              <p>{hero.role}</p>
              <p>{hero.based}</p>
              {email ? <a href={`mailto:${email}`}>{email}</a> : null}
              <hr />
              <p>{dict.keep}</p>
            </div>
            <button type="button" className="atm-button" onClick={() => setState('menu')}>
              {dict.done}
            </button>
          </div>
        ) : null}

        {state === 'balance' ? (
          <div className="atm-screen">
            <p className="atm-prompt">{dict.balance}</p>
            <ul className="atm-rows">
              <li>
                <span>{dict.balanceLines.sites}</span>
                <b className="tabular">{PROJECTS.length}</b>
              </li>
              <li>
                <span>{dict.balanceLines.capabilities}</span>
                <b className="tabular">{about.capabilities.length}</b>
              </li>
              <li>
                <span>{dict.balanceLines.handovers}</span>
                <b className="tabular">0</b>
              </li>
            </ul>
            <button type="button" className="atm-button" onClick={() => setState('menu')}>
              {dict.done}
            </button>
          </div>
        ) : null}

        {state === 'statement' ? (
          <div className="atm-screen">
            <p className="atm-prompt">{dict.statement}</p>
            <ol className="atm-rows">
              {steps.steps.map((step, i) => (
                <li key={step.id}>
                  <span>{step.label}</span>
                  <b className="tabular">{pad(i + 1)}</b>
                </li>
              ))}
            </ol>
            <button type="button" className="atm-button" onClick={() => setState('menu')}>
              {dict.done}
            </button>
          </div>
        ) : null}

        {state === 'eject' ? (
          <div className="atm-screen" role="status">
            <p className="atm-prompt atm-blink">{dict.takeCard}</p>
            <div className="atm-card-out" aria-hidden="true">
              <span className="atm-card-chip" />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

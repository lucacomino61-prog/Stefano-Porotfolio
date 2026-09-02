'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import {
  GAME_IDS,
  HEIGHT,
  PHOSPHOR,
  WIDTH,
  createGame,
  type Game,
  type GameId,
  type Input,
} from '@/lib/arcade'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { onFrame } from '@/lib/motion/ticker'

/**
 * The cabinet, once you are standing at it.
 *
 * Three games on one tube, drawn at 320x240 and scaled without smoothing. The
 * loop is the application's ticker, not a requestAnimationFrame of its own:
 * one loop is the rule of the whole site (lib/motion/ticker.ts), and a game on
 * a second one would keep running with the tab hidden and the camera across
 * the street.
 *
 * Controls are real buttons as well as keys. The keys are for anyone at a
 * keyboard, named in the hint under the tube; the pad is for a thumb, and the
 * stylesheet shows it only where the primary pointer is coarse, because on a
 * desk it took a third of the tube's height for a control nobody there
 * reaches for. Scores are kept in localStorage per game, and both the read
 * and the write are guarded because storage can be refused.
 *
 * `active` gates the loop and the keys. The same component sits inside a
 * window on the desktop (active for as long as the window is open) and on the
 * panel pinned to the cabinet in the street (active only while the camera is
 * at it), so a game must not keep listening for arrows from across the road.
 */
type Mode = 'attract' | 'playing' | 'over'

const KEYS: Record<string, keyof Input> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  Space: 'action',
  Enter: 'action',
}

function idle(): Input {
  return { up: false, down: false, left: false, right: false, action: false }
}

function readBest(id: GameId): number {
  try {
    return Number(window.localStorage.getItem(`sd:arcade:${id}`)) || 0
  } catch {
    return 0
  }
}

function writeBest(id: GameId, value: number): void {
  try {
    window.localStorage.setItem(`sd:arcade:${id}`, String(value))
  } catch {
    // Storage refused. The score still shows for this round.
  }
}

export function ArcadeScreen({
  dict,
  active = true,
  embedded = false,
}: {
  dict: Dictionary['arcade']
  active?: boolean
  embedded?: boolean
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const game = useRef<Game>(createGame('snake'))
  const input = useRef<Input>(idle())
  /**
   * Keys pressed since the last frame, whether or not they are still down. A
   * tap shorter than a frame would otherwise set the flag and clear it before
   * the game ever read it, and Snake turns on a tap. Consumed once per frame.
   */
  const tapped = useRef<Input>(idle())
  const mode = useRef<Mode>('attract')
  const rest = useRef(0)
  const [gameId, setGameId] = useState<GameId>('snake')
  const [shown, setShown] = useState<Mode>('attract')
  const [score, setScore] = useState(0)
  // Read once at mount and again on every switch. Never during server render:
  // the cabinet only ever mounts behind a press, so storage is always there.
  const [best, setBest] = useState(() => readBest('snake'))

  const setMode = useCallback((next: Mode) => {
    mode.current = next
    setShown(next)
  }, [])

  const start = useCallback(() => {
    game.current.reset()
    rest.current = 0
    setScore(0)
    setMode('playing')
  }, [setMode])

  const choose = useCallback(
    (id: GameId) => {
      game.current = createGame(id)
      input.current = idle()
      setGameId(id)
      setScore(0)
      setBest(readBest(id))
      setMode('attract')
    },
    [setMode],
  )

  // One loop. The ticker steps the game and paints the tube; score and mode
  // reach React only when they change, never per frame.
  useEffect(() => {
    if (!active) return
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx) return
    let lastScore = -1
    const stop = onFrame((_, deltaMs) => {
      const dt = Math.min(deltaMs / 1000, 0.1)
      const current = game.current
      const demo = mode.current !== 'playing'
      const held = input.current
      const tap = tapped.current
      const frameInput: Input = {
        up: held.up || tap.up,
        down: held.down || tap.down,
        left: held.left || tap.left,
        right: held.right || tap.right,
        action: held.action || tap.action,
      }
      tapped.current = idle()
      // Sub-stepped, so a long frame cannot carry the ball through a paddle.
      const steps = Math.max(1, Math.ceil(dt / 0.02))
      for (let k = 0; k < steps; k++) current.step(dt / steps, frameInput, demo)
      if (!demo && current.over) {
        setMode('over')
        if (current.score > readBest(current.id)) {
          writeBest(current.id, current.score)
          setBest(current.score)
        }
      }
      if (demo && current.over) {
        // The attract loop starts itself again after a beat.
        rest.current += dt
        if (rest.current > 2.2) {
          rest.current = 0
          current.reset()
        }
      }
      if (!demo && current.score !== lastScore) {
        lastScore = current.score
        setScore(current.score)
      }
      current.draw(ctx, WIDTH, HEIGHT, PHOSPHOR[current.id])
    })
    return stop
  }, [active, setMode])

  /**
   * The tube takes the keys when you arrive.
   *
   * Whatever brought you here has just focused its own control: the window
   * its close button, the walk its Back. Both run their effects after this
   * one (parents settle after children), so the focus is moved a tick later,
   * or the first press of Space would close the window it was meant to start.
   */
  useEffect(() => {
    if (!active) return
    const timer = window.setTimeout(() => stage.current?.focus({ preventScroll: true }), 0)
    return () => window.clearTimeout(timer)
  }, [active])

  useEffect(() => {
    if (!active) return
    const down = (event: KeyboardEvent) => {
      const key = KEYS[event.code]
      if (!key) return
      // Space and Enter on a focused control belong to that control.
      if (key === 'action' && event.target instanceof HTMLElement && event.target.closest('button, a, input, textarea, select')) return
      event.preventDefault()
      if (key === 'action' && mode.current !== 'playing') {
        start()
        return
      }
      input.current[key] = true
      tapped.current[key] = true
    }
    const up = (event: KeyboardEvent) => {
      const key = KEYS[event.code]
      if (key) input.current[key] = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      input.current = idle()
    }
  }, [active, start])

  /**
   * A pad key: held while the pointer is down on it, released however the
   * pointer leaves. Which key is read off the button itself, so one pair of
   * handlers serves the whole pad and nothing reads a ref during render.
   */
  const padDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      const key = event.currentTarget.dataset.key as keyof Input
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      if (key === 'action' && mode.current !== 'playing') {
        start()
        return
      }
      input.current[key] = true
      tapped.current[key] = true
    },
    [start],
  )
  const padUp = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    input.current[event.currentTarget.dataset.key as keyof Input] = false
  }, [])
  const pad = { onPointerDown: padDown, onPointerUp: padUp, onPointerCancel: padUp, onLostPointerCapture: padUp }

  return (
    <div
      className={embedded ? 'arcade-ui arcade-ui-embedded' : 'screen-ui arcade-ui'}
      data-mode={shown}
      style={{ '--arcade-glow': PHOSPHOR[gameId].dim } as React.CSSProperties}
    >
      <div className="arcade-bar">
        <span className="arcade-title">{dict.title}</span>
        <div className="arcade-tabs" role="group" aria-label={dict.title}>
          {GAME_IDS.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={id === gameId}
              className="arcade-tab"
              onClick={() => choose(id)}
            >
              {dict.games[id]}
            </button>
          ))}
        </div>
      </div>

      <div ref={stage} className="arcade-stage" tabIndex={-1}>
        <canvas ref={canvas} width={WIDTH} height={HEIGHT} className="arcade-canvas" aria-hidden="true" />
        {shown !== 'playing' ? (
          <div className="arcade-overlay">
            <p className="arcade-marquee">{shown === 'over' ? dict.gameOver : dict.insertCoin}</p>
            {shown === 'over' ? (
              <p className="arcade-final tabular">
                {dict.score} {score}
              </p>
            ) : null}
            <button type="button" className="arcade-start" onClick={start}>
              {shown === 'over' ? dict.again : dict.start}
            </button>
          </div>
        ) : null}
      </div>

      <div className="arcade-foot">
        <p className="arcade-readouts tabular">
          <span>
            <b>{dict.score}</b> {String(score).padStart(4, '0')}
          </span>
          <span>
            <b>{dict.best}</b> {String(best).padStart(4, '0')}
          </span>
        </p>
        <p className="arcade-hint">{dict.controls}</p>
        <div className="arcade-pad">
          <div className="arcade-dpad">
            <button type="button" className="arcade-key arcade-key-up" aria-label={dict.pad.up} data-key="up" {...pad}>
              <Arrow turn={0} />
            </button>
            <button type="button" className="arcade-key arcade-key-left" aria-label={dict.pad.left} data-key="left" {...pad}>
              <Arrow turn={-90} />
            </button>
            <button type="button" className="arcade-key arcade-key-right" aria-label={dict.pad.right} data-key="right" {...pad}>
              <Arrow turn={90} />
            </button>
            <button type="button" className="arcade-key arcade-key-down" aria-label={dict.pad.down} data-key="down" {...pad}>
              <Arrow turn={180} />
            </button>
          </div>
          <button type="button" className="arcade-key arcade-key-a" aria-label={dict.pad.button} data-key="action" {...pad}>
            A
          </button>
        </div>
      </div>
    </div>
  )
}

function Arrow({ turn }: { turn: number }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" style={{ transform: `rotate(${turn}deg)` }}>
      <path
        d="M8 13V3M4 7l4-4 4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

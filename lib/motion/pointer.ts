'use client'

export type PointerState = {
  /** Viewport pixels. */
  x: number
  y: number
  /** Normalised to -1..1, origin at the viewport centre. Clamped. */
  nx: number
  ny: number
  /** False until the pointer has actually moved, so nothing jumps on load. */
  active: boolean
}

/**
 * One mutable object, written by one passive listener, read inside the ticker.
 * Never put these values in React state: they change every frame and would
 * re-render the tree sixty times a second.
 */
const state: PointerState = { x: 0, y: 0, nx: 0, ny: 0, active: false }

let listeners = 0

function handleMove(event: PointerEvent): void {
  state.x = event.clientX
  state.y = event.clientY
  state.nx = Math.max(-1, Math.min(1, (event.clientX / window.innerWidth) * 2 - 1))
  state.ny = Math.max(-1, Math.min(1, (event.clientY / window.innerHeight) * 2 - 1))
  state.active = true
}

/** True only for a real mouse. Every pointer effect is off on touch. */
export function hasFinePointer(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches
}

export function pointer(): Readonly<PointerState> {
  return state
}

export function trackPointer(): () => void {
  if (!hasFinePointer()) return () => {}

  if (listeners === 0) {
    window.addEventListener('pointermove', handleMove, { passive: true })
  }
  listeners += 1

  return () => {
    listeners -= 1
    if (listeners === 0) {
      window.removeEventListener('pointermove', handleMove)
      state.active = false
    }
  }
}

/** Frame-rate independent lerp. Without the delta term, damping changes with FPS. */
export function damp(current: number, target: number, lambda: number, deltaMs: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * (deltaMs / 1000)))
}

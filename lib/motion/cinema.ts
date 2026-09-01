/**
 * Where the camera is standing, shared between the DOM and the scene.
 *
 * Scroll is read in the DOM, by a ScrollTrigger that owns the pin. The camera
 * lives in WebGL and is advanced by the same gsap ticker as everything else.
 * Passing the position through React state would re-render a three-scene sixty
 * times a second to move one vector, so it goes through a module-level value
 * instead: written by the trigger, read in the frame loop, never rendered.
 *
 * This is the same shape as lib/motion/pointer.ts, for the same reason.
 */
type Cinema = {
  /** 0 at the wide shot, 1 with the screen against the glass. */
  progress: number
  /** Whether the walk is running at all: false on narrow and reduced-motion. */
  live: boolean
}

const state: Cinema = { progress: 0, live: false }

export function setCinemaProgress(value: number): void {
  state.progress = value
}

export function setCinemaLive(value: boolean): void {
  state.live = value
  if (!value) state.progress = 0
}

export function cinema(): Readonly<Cinema> {
  return state
}

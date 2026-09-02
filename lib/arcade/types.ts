/**
 * The cabinet's contract.
 *
 * A game is a pure state machine over a fixed 320x240 tube: it is stepped in
 * seconds, read its input from one flags object, and paints itself into a 2D
 * context. Nothing in here knows about React, the DOM or three, which is what
 * lets the same game run inside a window on the desktop, on the panel the
 * camera walks up to, and as the attract loop drawn onto the cabinet's own
 * screen texture across the street.
 */
export type GameId = 'snake' | 'pong' | 'bricks'

export type Input = {
  up: boolean
  down: boolean
  left: boolean
  right: boolean
  action: boolean
}

/** What a tube draws with: its ground, its phosphor, a dimmer tone and one accent. */
export type Phosphor = {
  ground: string
  ink: string
  dim: string
  accent: string
}

export interface Game {
  readonly id: GameId
  /** Points this round. */
  score: number
  /** True once the round has ended; `reset()` starts another. */
  over: boolean
  reset(): void
  /** Advance by `dt` seconds. In demo the game plays itself for the attract screen. */
  step(dt: number, input: Input, demo: boolean): void
  draw(ctx: CanvasRenderingContext2D, w: number, h: number, phosphor: Phosphor): void
}

/** The tube. 4:3, the way every cabinet was. */
export const WIDTH = 320
export const HEIGHT = 240

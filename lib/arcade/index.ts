import { Bricks } from './bricks'
import { Pong } from './pong'
import { Snake } from './snake'
import type { Game, GameId, Phosphor } from './types'

export const GAME_IDS: readonly GameId[] = ['snake', 'pong', 'bricks']

export function createGame(id: GameId): Game {
  switch (id) {
    case 'snake':
      return new Snake()
    case 'pong':
      return new Pong()
    case 'bricks':
      return new Bricks()
  }
}

/**
 * Each game's phosphor, taken from the three neon tubes the street is lit
 * with rather than from a palette of its own: the cabinet is one more lamp in
 * the scene, and its light has to be a colour the scene already has.
 */
export const PHOSPHOR: Record<GameId, Phosphor> = {
  snake: { ground: '#04070a', ink: '#d8ffe0', dim: '#1eff51', accent: '#ff2fd5' },
  pong: { ground: '#04070a', ink: '#e6f8ff', dim: '#01ddff', accent: '#fff668' },
  bricks: { ground: '#04070a', ink: '#ffe6f8', dim: '#ff2fd5', accent: '#01ddff' },
}

export { HEIGHT, WIDTH } from './types'
export type { Game, GameId, Input, Phosphor } from './types'

import { HEIGHT, WIDTH, type Game, type Input, type Phosphor } from './types'

const CELL = 16
const COLS = WIDTH / CELL
const ROWS = HEIGHT / CELL

type Cell = [number, number]

/**
 * Snake, as it was on the phone in everyone's pocket: a grid, four directions,
 * one apple at a time. The speed climbs with every apple, and that is the whole
 * difficulty curve.
 */
export class Snake implements Game {
  readonly id = 'snake' as const
  score = 0
  over = false
  private body: Cell[] = []
  private dir: Cell = [1, 0]
  private next: Cell = [1, 0]
  private apple: Cell = [0, 0]
  private clock = 0
  private interval = 0.18
  private ate = 0
  /** False until the first turn, so a fresh round waits for a hand on the keys. */
  private moving = false

  constructor() {
    this.reset()
  }

  reset(): void {
    this.body = [
      [8, 7],
      [7, 7],
      [6, 7],
      [5, 7],
    ]
    this.dir = [1, 0]
    this.next = [1, 0]
    this.score = 0
    this.over = false
    this.clock = 0
    // Five and a half cells a second to start, which is the pace a hand can
    // pick up from a standing start; every apple takes it faster.
    this.interval = 0.18
    this.ate = 0
    this.moving = false
    this.placeApple()
  }

  private placeApple(): void {
    let x = 0
    let y = 0
    do {
      x = Math.floor(Math.random() * COLS)
      y = Math.floor(Math.random() * ROWS)
    } while (this.body.some(([bx, by]) => bx === x && by === y))
    this.apple = [x, y]
  }

  private blocked(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return true
    // The tail moves out of the way on the same step, so it does not count.
    return this.body.slice(0, -1).some(([bx, by]) => bx === x && by === y)
  }

  private turn(dx: number, dy: number): void {
    // No reversing into yourself: that is a death, not a turn.
    if (dx === -this.dir[0] && dy === -this.dir[1]) return
    this.next = [dx, dy]
    this.moving = true
  }

  step(dt: number, input: Input, demo: boolean): void {
    if (this.over) return
    if (demo) {
      this.autopilot()
      this.moving = true
    } else if (input.up) this.turn(0, -1)
    else if (input.down) this.turn(0, 1)
    else if (input.left) this.turn(-1, 0)
    else if (input.right) this.turn(1, 0)

    // The board is drawn and the snake sits until it is told where to go: a
    // round that starts running at the wall gives nobody time to find the keys.
    if (!this.moving) return

    this.ate = Math.max(0, this.ate - dt)
    this.clock += dt
    if (this.clock < this.interval) return
    this.clock -= this.interval

    this.dir = this.next
    const [hx, hy] = this.body[0]
    const head: Cell = [hx + this.dir[0], hy + this.dir[1]]
    if (this.blocked(head[0], head[1])) {
      this.over = true
      return
    }
    this.body.unshift(head)
    if (head[0] === this.apple[0] && head[1] === this.apple[1]) {
      this.score += 10
      this.interval = Math.max(0.08, this.interval * 0.955)
      this.ate = 0.3
      this.placeApple()
    } else {
      this.body.pop()
    }
  }

  /** Greedy toward the apple, but never into a wall or into itself. */
  private autopilot(): void {
    const [hx, hy] = this.body[0]
    const dx = Math.sign(this.apple[0] - hx)
    const dy = Math.sign(this.apple[1] - hy)
    const wants: Cell[] =
      Math.abs(this.apple[0] - hx) >= Math.abs(this.apple[1] - hy)
        ? [
            [dx, 0],
            [0, dy],
          ]
        : [
            [0, dy],
            [dx, 0],
          ]
    const options: Cell[] = [
      ...wants.filter(([x, y]) => x !== 0 || y !== 0),
      this.dir,
      [this.dir[1], this.dir[0]],
      [-this.dir[1], -this.dir[0]],
    ]
    for (const [ox, oy] of options) {
      if (ox === -this.dir[0] && oy === -this.dir[1]) continue
      if (!this.blocked(hx + ox, hy + oy)) {
        this.next = [ox, oy]
        return
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, p: Phosphor): void {
    ctx.fillStyle = p.ground
    ctx.fillRect(0, 0, w, h)

    ctx.strokeStyle = p.dim
    ctx.globalAlpha = 0.16
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let x = CELL; x < w; x += CELL) {
      ctx.moveTo(x + 0.5, 0)
      ctx.lineTo(x + 0.5, h)
    }
    for (let y = CELL; y < h; y += CELL) {
      ctx.moveTo(0, y + 0.5)
      ctx.lineTo(w, y + 0.5)
    }
    ctx.stroke()
    ctx.globalAlpha = 1

    // The apple swells for a moment after a bite: the one bit of feedback the
    // original had, and the one this keeps.
    const inset = this.ate > 0 ? 1 : 3
    ctx.fillStyle = p.accent
    ctx.fillRect(this.apple[0] * CELL + inset, this.apple[1] * CELL + inset, CELL - inset * 2, CELL - inset * 2)

    ctx.fillStyle = p.ink
    this.body.forEach(([x, y], i) => {
      ctx.globalAlpha = i === 0 ? 1 : Math.max(0.4, 1 - i / (this.body.length + 8))
      ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2)
    })
    ctx.globalAlpha = 1
  }
}

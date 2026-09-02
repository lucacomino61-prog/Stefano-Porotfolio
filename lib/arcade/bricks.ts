import { HEIGHT, WIDTH, type Game, type Input, type Phosphor } from './types'

const COLS = 10
const ROWS = 5
const BRICK_W = 30
const BRICK_H = 11
const GAP = 2
const TOP = 34
const LEFT = (WIDTH - COLS * (BRICK_W + GAP) + GAP) / 2
const PADDLE_W = 48
const PADDLE_H = 6
const PADDLE_Y = HEIGHT - 14
const R = 4

/**
 * Breakout. A wall of bricks, a paddle, three balls. Clearing the wall builds
 * another, faster; the score climbs faster the higher the row.
 */
export class Bricks implements Game {
  readonly id = 'bricks' as const
  score = 0
  over = false
  private bricks: boolean[] = []
  private paddle = WIDTH / 2
  private ball = { x: WIDTH / 2, y: 0, vx: 0, vy: 0 }
  private stuck = true
  private lives = 3
  private level = 1
  private speed = 170
  private wait = 0
  private hit = 0

  constructor() {
    this.reset()
  }

  reset(): void {
    this.score = 0
    this.over = false
    this.lives = 3
    this.level = 1
    this.paddle = WIDTH / 2
    this.wall()
  }

  private wall(): void {
    this.bricks = new Array<boolean>(COLS * ROWS).fill(true)
    this.speed = 170 + (this.level - 1) * 25
    this.stick()
  }

  private stick(): void {
    this.stuck = true
    this.wait = 0
    this.ball = { x: this.paddle, y: PADDLE_Y - PADDLE_H / 2 - R, vx: 0, vy: 0 }
  }

  private launch(): void {
    const angle = (Math.random() - 0.5) * 1.0
    this.ball.vx = Math.sin(angle) * this.speed
    this.ball.vy = -Math.cos(angle) * this.speed
    this.stuck = false
  }

  step(dt: number, input: Input, demo: boolean): void {
    if (this.over) return
    const paddleSpeed = 260
    if (demo) {
      // Aims a little ahead of the ball, and misses when the ball is quick.
      const target = this.stuck ? WIDTH / 2 : this.ball.x + (this.ball.vx > 0 ? 6 : -6)
      const want = (target - this.paddle) * 0.15
      this.paddle += Math.max(-paddleSpeed * dt, Math.min(paddleSpeed * dt, want))
    } else {
      if (input.left) this.paddle -= paddleSpeed * dt
      if (input.right) this.paddle += paddleSpeed * dt
      if (this.stuck && input.action) this.launch()
    }
    this.paddle = Math.max(PADDLE_W / 2, Math.min(WIDTH - PADDLE_W / 2, this.paddle))
    this.hit = Math.max(0, this.hit - dt)

    if (this.stuck) {
      this.ball.x = this.paddle
      if (demo) {
        this.wait += dt
        if (this.wait > 1) this.launch()
      }
      return
    }

    const b = this.ball
    b.x += b.vx * dt
    b.y += b.vy * dt
    if (b.x < R) {
      b.x = R
      b.vx = Math.abs(b.vx)
    }
    if (b.x > WIDTH - R) {
      b.x = WIDTH - R
      b.vx = -Math.abs(b.vx)
    }
    if (b.y < R) {
      b.y = R
      b.vy = Math.abs(b.vy)
    }

    if (
      b.vy > 0 &&
      b.y + R >= PADDLE_Y - PADDLE_H / 2 &&
      b.y - R <= PADDLE_Y + PADDLE_H / 2 &&
      Math.abs(b.x - this.paddle) <= PADDLE_W / 2 + R
    ) {
      const off = (b.x - this.paddle) / (PADDLE_W / 2)
      const angle = off * 1.1
      this.speed = Math.min(340, this.speed * 1.02)
      b.vx = Math.sin(angle) * this.speed
      b.vy = -Math.cos(angle) * this.speed
      b.y = PADDLE_Y - PADDLE_H / 2 - R
    }

    const col = Math.floor((b.x - LEFT) / (BRICK_W + GAP))
    const row = Math.floor((b.y - TOP) / (BRICK_H + GAP))
    if (col >= 0 && col < COLS && row >= 0 && row < ROWS && this.bricks[row * COLS + col]) {
      this.bricks[row * COLS + col] = false
      this.score += 10 * (ROWS - row)
      this.hit = 0.12
      const cx = LEFT + col * (BRICK_W + GAP) + BRICK_W / 2
      const cy = TOP + row * (BRICK_H + GAP) + BRICK_H / 2
      // Which face was struck decides which axis reflects.
      if (Math.abs((b.x - cx) / BRICK_W) > Math.abs((b.y - cy) / BRICK_H)) b.vx = -b.vx
      else b.vy = -b.vy
      if (this.bricks.every((brick) => !brick)) {
        this.level += 1
        this.wall()
      }
    }

    if (b.y > HEIGHT + R) {
      this.lives -= 1
      if (this.lives <= 0) this.over = true
      else this.stick()
    }
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, p: Phosphor): void {
    ctx.fillStyle = p.ground
    ctx.fillRect(0, 0, w, h)

    for (let row = 0; row < ROWS; row++) {
      ctx.fillStyle = row % 2 === 0 ? p.accent : p.ink
      ctx.globalAlpha = 1 - row * 0.13
      for (let col = 0; col < COLS; col++) {
        if (!this.bricks[row * COLS + col]) continue
        ctx.fillRect(LEFT + col * (BRICK_W + GAP), TOP + row * (BRICK_H + GAP), BRICK_W, BRICK_H)
      }
    }
    ctx.globalAlpha = 1

    ctx.fillStyle = p.ink
    ctx.fillRect(this.paddle - PADDLE_W / 2, PADDLE_Y - PADDLE_H / 2, PADDLE_W, PADDLE_H)
    ctx.fillStyle = this.hit > 0 ? p.ink : p.accent
    ctx.fillRect(this.ball.x - R, this.ball.y - R, R * 2, R * 2)

    ctx.fillStyle = p.dim
    for (let i = 0; i < this.lives; i++) ctx.fillRect(8 + i * 12, h - 6, 8, 2)
    ctx.font = '500 10px ui-monospace, monospace'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(`LV ${this.level}`, w - 8, h - 4)
  }
}

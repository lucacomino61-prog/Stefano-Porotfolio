import { HEIGHT, WIDTH, type Game, type Input, type Phosphor } from './types'

const PADDLE_H = 44
const PADDLE_W = 6
const BALL = 6
const LEFT_X = 16
const RIGHT_X = WIDTH - 16
/** First to this many points. */
const TO = 7

function clamp(y: number): number {
  return Math.max(PADDLE_H / 2, Math.min(HEIGHT - PADDLE_H / 2, y))
}

/**
 * Pong. You are the paddle on the left; the machine is the one on the right,
 * and it is beatable: it only moves while the ball is coming and never faster
 * than you can.
 */
export class Pong implements Game {
  readonly id = 'pong' as const
  score = 0
  over = false
  private cpu = 0
  private ball = { x: WIDTH / 2, y: HEIGHT / 2, vx: 0, vy: 0 }
  private left = HEIGHT / 2
  private right = HEIGHT / 2
  private hold = 0
  private speed = 170

  constructor() {
    this.reset()
  }

  reset(): void {
    this.score = 0
    this.cpu = 0
    this.over = false
    this.left = HEIGHT / 2
    this.right = HEIGHT / 2
    this.serve(1)
  }

  private serve(dir: 1 | -1): void {
    const angle = (Math.random() - 0.5) * 0.9
    this.speed = 170
    this.ball = {
      x: WIDTH / 2,
      y: HEIGHT / 2,
      vx: Math.cos(angle) * this.speed * dir,
      vy: Math.sin(angle) * this.speed,
    }
    // A beat at the centre before every serve, so a point is a point.
    this.hold = 0.9
  }

  step(dt: number, input: Input, demo: boolean): void {
    if (this.over) return
    const paddleSpeed = 190
    if (demo) {
      // Follows late and loosely, so the demo loses now and then.
      const want = (this.ball.y - 10 - this.left) * 0.09
      this.left += Math.max(-paddleSpeed * dt, Math.min(paddleSpeed * dt, want))
    } else {
      if (input.up) this.left -= paddleSpeed * dt
      if (input.down) this.left += paddleSpeed * dt
    }
    if (this.ball.vx > 0) {
      const want = (this.ball.y - this.right) * 0.12
      this.right += Math.max(-150 * dt, Math.min(150 * dt, want))
    }
    this.left = clamp(this.left)
    this.right = clamp(this.right)

    if (this.hold > 0) {
      this.hold -= dt
      return
    }

    const b = this.ball
    b.x += b.vx * dt
    b.y += b.vy * dt
    if (b.y < BALL / 2) {
      b.y = BALL / 2
      b.vy = Math.abs(b.vy)
    }
    if (b.y > HEIGHT - BALL / 2) {
      b.y = HEIGHT - BALL / 2
      b.vy = -Math.abs(b.vy)
    }

    if (
      b.vx < 0 &&
      b.x - BALL / 2 <= LEFT_X + PADDLE_W / 2 &&
      b.x > LEFT_X - 6 &&
      Math.abs(b.y - this.left) <= PADDLE_H / 2 + BALL / 2
    ) {
      this.bounce(this.left, 1)
      b.x = LEFT_X + PADDLE_W / 2 + BALL / 2
    }
    if (
      b.vx > 0 &&
      b.x + BALL / 2 >= RIGHT_X - PADDLE_W / 2 &&
      b.x < RIGHT_X + 6 &&
      Math.abs(b.y - this.right) <= PADDLE_H / 2 + BALL / 2
    ) {
      this.bounce(this.right, -1)
      b.x = RIGHT_X - PADDLE_W / 2 - BALL / 2
    }

    if (b.x < -12) {
      this.cpu += 1
      if (this.cpu >= TO) this.over = true
      else this.serve(1)
    }
    if (b.x > WIDTH + 12) {
      this.score += 1
      if (this.score >= TO) this.over = true
      else this.serve(-1)
    }
  }

  /** Where on the paddle the ball lands decides the angle it leaves at. */
  private bounce(paddle: number, dir: 1 | -1): void {
    this.speed = Math.min(360, this.speed * 1.05)
    const off = (this.ball.y - paddle) / (PADDLE_H / 2)
    const angle = off * 1.05
    this.ball.vx = Math.cos(angle) * this.speed * dir
    this.ball.vy = Math.sin(angle) * this.speed
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, p: Phosphor): void {
    ctx.fillStyle = p.ground
    ctx.fillRect(0, 0, w, h)

    ctx.fillStyle = p.dim
    ctx.globalAlpha = 0.6
    for (let y = 4; y < h; y += 14) ctx.fillRect(w / 2 - 1, y, 2, 8)
    ctx.globalAlpha = 1

    ctx.fillStyle = p.ink
    ctx.font = '700 28px ui-monospace, monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(String(this.score), w / 2 - 40, 10)
    ctx.fillText(String(this.cpu), w / 2 + 40, 10)

    ctx.fillRect(LEFT_X - PADDLE_W / 2, this.left - PADDLE_H / 2, PADDLE_W, PADDLE_H)
    ctx.fillRect(RIGHT_X - PADDLE_W / 2, this.right - PADDLE_H / 2, PADDLE_W, PADDLE_H)

    ctx.fillStyle = p.accent
    ctx.fillRect(this.ball.x - BALL / 2, this.ball.y - BALL / 2, BALL, BALL)
  }
}

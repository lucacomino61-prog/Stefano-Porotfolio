import { CanvasTexture, LinearFilter, MeshBasicMaterial, NearestFilter, SRGBColorSpace } from 'three'

import { CONTENT, LABELS } from '../content'

/**
 * The twelve screens on the shop, each a canvas painted here and shown on a
 * plane the model carries by name. Some hold pages (the big screen's about
 * pages, the vending machine's project posters, the arcade's credits); some
 * are buttons while the camera is close (the three small screens under the
 * big one); the rest just play — a ticker, a synthwave horizon, falling
 * katakana, a clock, static. Animated screens redraw at their own pace, not
 * every frame.
 */
export type ScreenName =
  | 'bigScreen'
  | 'tickerScreen'
  | 'smallScreen1'
  | 'smallScreen2'
  | 'smallScreen3'
  | 'smallScreen4'
  | 'tallScreen'
  | 'smallScreen5'
  | 'tvScreen'
  | 'littleTvScreen'
  | 'arcadeScreen'
  | 'vendScreen'

export type AboutPage = 'intro' | 'skills' | 'experience'

export type Screens = {
  material: (name: string) => MeshBasicMaterial | null
  update: (t: number) => void
  setAboutPage: (page: AboutPage) => void
  setProject: (index: number) => void
  setCreditsPage: (index: number) => void
  setButtons: (on: boolean) => void
  setHover: (name: string | null) => void
  readonly project: number
  readonly creditsPage: number
  readonly aboutPage: AboutPage
}

const FONT = "'Segoe UI', system-ui, -apple-system, Roboto, 'Helvetica Neue', Arial, sans-serif"
const PIXEL = "'Consolas', 'Courier New', monospace"
const KANA = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン'

class Screen {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  texture: CanvasTexture
  material: MeshBasicMaterial
  last = -1
  constructor(public w: number, public h: number, pixel = false) {
    this.canvas = document.createElement('canvas')
    this.canvas.width = w
    this.canvas.height = h
    this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D
    this.texture = new CanvasTexture(this.canvas)
    this.texture.colorSpace = SRGBColorSpace
    this.texture.flipY = false
    this.texture.generateMipmaps = false
    this.texture.minFilter = LinearFilter
    this.texture.magFilter = pixel ? NearestFilter : LinearFilter
    this.material = new MeshBasicMaterial({ map: this.texture, toneMapped: false })
  }
  /** redraw at most `fps` times a second; returns whether it is time */
  due(t: number, fps: number): boolean {
    if (t - this.last < 1 / fps) return false
    this.last = t
    return true
  }
  done(): void {
    this.texture.needsUpdate = true
  }
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else line = test
  }
  if (line) lines.push(line)
  return lines
}

function sunburst(ctx: CanvasRenderingContext2D, w: number, h: number, a: string, b: string, rays = 18, spin = 0): void {
  ctx.save()
  ctx.fillStyle = a
  ctx.fillRect(0, 0, w, h)
  ctx.translate(w / 2, h / 2)
  ctx.rotate(spin)
  ctx.fillStyle = b
  const r = Math.hypot(w, h)
  for (let i = 0; i < rays; i++) {
    const a0 = (i / rays) * Math.PI * 2
    const a1 = a0 + Math.PI / rays
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.arc(0, 0, r, a0, a1)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

function pill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, ink: string, text: string, font: string): void {
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, h / 2)
  ctx.fill()
  ctx.fillStyle = ink
  ctx.font = font
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x + w / 2, y + h / 2 + 1)
}

function scanlines(ctx: CanvasRenderingContext2D, w: number, h: number, alpha = 0.12): void {
  ctx.fillStyle = `rgba(0,0,0,${alpha})`
  for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 2)
}

export function createScreens(): Screens {
  const S: Record<ScreenName, Screen> = {
    bigScreen: new Screen(1024, 624),
    tickerScreen: new Screen(384, 72, true),
    smallScreen1: new Screen(384, 320),
    smallScreen2: new Screen(384, 320),
    smallScreen3: new Screen(384, 320),
    smallScreen4: new Screen(192, 160, true),
    tallScreen: new Screen(192, 280, true),
    smallScreen5: new Screen(384, 320),
    tvScreen: new Screen(384, 176, true),
    littleTvScreen: new Screen(96, 46, true),
    arcadeScreen: new Screen(256, 204, true),
    vendScreen: new Screen(512, 768),
  }
  const state = { aboutPage: 'intro' as AboutPage, project: 0, creditsPage: 0, buttons: false, hover: null as string | null }

  // ---- the big screen: about pages
  function drawBig(): void {
    const s = S.bigScreen
    const { ctx, w, h } = s
    sunburst(ctx, w, h, '#33e2ff', '#5cf0ff', 22)
    ctx.fillStyle = 'rgba(30, 10, 80, 0.86)'
    ctx.beginPath()
    ctx.roundRect(60, 56, w - 120, h - 112, 28)
    ctx.fill()
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    if (state.aboutPage === 'intro') {
      ctx.fillStyle = '#ff9a2a'
      ctx.font = `800 64px ${FONT}`
      ctx.fillText(CONTENT.name, 110, 150)
      ctx.fillStyle = '#5cf0ff'
      ctx.font = `700 26px ${FONT}`
      ctx.fillText(CONTENT.about.headline.toUpperCase(), 112, 196)
      ctx.fillStyle = '#f4f2ff'
      ctx.font = `400 28px ${FONT}`
      let y = 260
      for (const p of CONTENT.about.intro) {
        for (const line of wrap(ctx, p, w - 240)) {
          ctx.fillText(line, 112, y)
          y += 38
        }
        y += 18
      }
      ctx.fillStyle = 'rgba(244,242,255,0.7)'
      ctx.font = `600 20px ${FONT}`
      ctx.fillText(CONTENT.roles.join('  ·  '), 112, h - 96)
    } else if (state.aboutPage === 'skills') {
      ctx.fillStyle = '#ff9a2a'
      ctx.font = `800 52px ${FONT}`
      ctx.fillText('Skills', 110, 140)
      const cols = CONTENT.about.skills
      const cw = (w - 220) / cols.length
      cols.forEach((col, i) => {
        const x = 110 + i * cw
        ctx.fillStyle = '#5cf0ff'
        ctx.font = `700 24px ${FONT}`
        ctx.textAlign = 'left'
        ctx.fillText(col.group.toUpperCase(), x, 210)
        col.items.forEach((item, j) => {
          pill(ctx, x, 236 + j * 58, Math.min(cw - 30, 210), 44, 'rgba(92,240,255,0.16)', '#f4f2ff', item, `600 22px ${FONT}`)
        })
      })
    } else {
      ctx.fillStyle = '#ff9a2a'
      ctx.font = `800 52px ${FONT}`
      ctx.fillText('Experience', 110, 140)
      CONTENT.about.experience.forEach((row, i) => {
        const y = 215 + i * 96
        ctx.textAlign = 'left'
        ctx.fillStyle = '#5cf0ff'
        ctx.font = `700 20px ${FONT}`
        ctx.fillText(row.when.toUpperCase(), 110, y)
        ctx.fillStyle = '#f4f2ff'
        ctx.font = `700 30px ${FONT}`
        ctx.fillText(row.what, 110, y + 36)
        ctx.fillStyle = 'rgba(244,242,255,0.75)'
        ctx.font = `400 22px ${FONT}`
        ctx.fillText(row.where, 110, y + 64)
        ctx.fillStyle = 'rgba(92,240,255,0.25)'
        ctx.fillRect(110, y + 80, w - 220, 2)
      })
    }
    s.done()
  }

  // ---- the three small screens: art at rest, buttons up close
  const ART = [
    { a: '#ff2f9c', b: '#7a3cff', sun: '#ffd23a' },
    { a: '#28e7ff', b: '#1b3ab0', sun: '#f4f2ff' },
    { a: '#ff8c2a', b: '#a6202c', sun: '#ffe3a8' },
  ]
  // smallScreen3 is the leftmost on the shelf, smallScreen1 the rightmost: read left to right
  const BUTTONS: { name: ScreenName; label: string; page: AboutPage | 'back' }[] = [
    { name: 'smallScreen1', label: 'back', page: 'back' },
    { name: 'smallScreen2', label: 'experience', page: 'experience' },
    { name: 'smallScreen3', label: 'skills', page: 'skills' },
  ]
  function drawSmall(i: number): void {
    const s = S[BUTTONS[i].name]
    const { ctx, w, h } = s
    if (state.buttons) {
      const hot = state.hover === `hit_small${i + 1}`
      const active = BUTTONS[i].page === state.aboutPage
      sunburst(ctx, w, h, hot || active ? '#ff9a2a' : '#1a1050', hot || active ? '#ffb457' : '#251a66', 14)
      ctx.fillStyle = hot || active ? '#1a1050' : '#5cf0ff'
      ctx.font = `800 54px ${FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(BUTTONS[i].label, w / 2, h / 2)
      ctx.font = `600 18px ${FONT}`
      ctx.fillStyle = hot || active ? 'rgba(26,16,80,0.7)' : 'rgba(92,240,255,0.6)'
      ctx.fillText(BUTTONS[i].page === 'back' ? '← leave the counter' : 'click to read', w / 2, h / 2 + 52)
    } else {
      const art = ART[i]
      const g = ctx.createLinearGradient(0, 0, 0, h)
      g.addColorStop(0, art.b)
      g.addColorStop(1, art.a)
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = art.sun
      ctx.beginPath()
      ctx.arc(w * (0.3 + i * 0.2), h * 0.42, 62, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(20,10,60,0.85)'
      for (let k = 0; k < 4; k++) {
        ctx.beginPath()
        ctx.moveTo(-40 + k * 120, h)
        ctx.lineTo(20 + k * 120, h * (0.55 + (k % 2) * 0.12))
        ctx.lineTo(90 + k * 120, h)
        ctx.closePath()
        ctx.fill()
      }
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.font = `700 20px ${FONT}`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
      ctx.fillText(['ramen', 'night', 'street'][i].toUpperCase(), 20, h - 22)
    }
    scanlines(ctx, w, h, 0.08)
    s.done()
  }

  // ---- the vending machine: one project poster at a time
  function drawVend(): void {
    const s = S.vendScreen
    const { ctx, w, h } = s
    const p = CONTENT.projects[state.project]
    sunburst(ctx, w, h, p.colours[0], shade(p.colours[0], 0.82), 20)
    ctx.fillStyle = 'rgba(12, 6, 40, 0.55)'
    ctx.beginPath()
    ctx.arc(w / 2, h * 0.36, 168, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = p.colours[1]
    ctx.font = `900 150px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(p.mark, w / 2, h * 0.36 + 8)
    ctx.fillStyle = '#ffffff'
    ctx.font = `900 40px ${FONT}`
    ctx.textBaseline = 'alphabetic'
    for (const [k, line] of wrap(ctx, p.title, w - 90).entries()) ctx.fillText(line, w / 2, h * 0.62 + k * 46)
    ctx.fillStyle = 'rgba(255,255,255,0.88)'
    ctx.font = `500 22px ${FONT}`
    const lines = wrap(ctx, p.blurb, w - 110)
    lines.forEach((line, k) => ctx.fillText(line, w / 2, h * 0.7 + k * 30))
    const tagsY = h * 0.7 + lines.length * 30 + 18
    const tagW = 120
    const total = p.tags.length * (tagW + 10) - 10
    p.tags.forEach((tag, k) => pill(ctx, w / 2 - total / 2 + k * (tagW + 10), tagsY, tagW, 34, 'rgba(255,255,255,0.18)', '#fff', tag, `600 17px ${FONT}`))
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.font = `700 18px ${FONT}`
    ctx.textAlign = 'center'
    ctx.fillText(p.url ? '▶  CLICK TO OPEN' : `${state.project + 1} / ${CONTENT.projects.length}`, w / 2, h - 34)
    ctx.textAlign = 'left'
    ctx.font = `800 22px ${FONT}`
    ctx.fillText(`${state.project + 1}/${CONTENT.projects.length}`, 24, 40)
    // a vertical word down the side, the way the machine's posters have one
    ctx.save()
    ctx.translate(w - 40, 70)
    ctx.fillStyle = p.colours[1]
    ctx.font = `900 46px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (const [k, ch] of [...LABELS.kanji].entries()) ctx.fillText(ch, 0, k * 52)
    ctx.restore()
    s.done()
  }

  // ---- the arcade: credits pages in pixels
  function drawArcade(): void {
    const s = S.arcadeScreen
    const { ctx, w, h } = s
    ctx.fillStyle = '#1a0a4a'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = 'rgba(122,60,255,0.6)'
    ctx.lineWidth = 1
    for (let x = 0; x <= w; x += 16) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()
    }
    for (let y = 0; y <= h; y += 16) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }
    ctx.font = `700 9px ${PIXEL}`
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = '#ff4a5a'
    ctx.textAlign = 'left'
    ctx.fillText('SCORE', 14, 18)
    ctx.textAlign = 'center'
    ctx.fillText('HIGH SCORE', w / 2, 18)
    ctx.textAlign = 'right'
    ctx.fillText('LEVEL', w - 14, 18)
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'left'
    ctx.fillText('0000', 14, 30)
    ctx.textAlign = 'center'
    ctx.fillText('0000', w / 2, 30)
    ctx.textAlign = 'right'
    ctx.fillText(String(state.creditsPage + 1).padStart(4, '0'), w - 14, 30)
    const page = CONTENT.credits[state.creditsPage]
    const g = ctx.createLinearGradient(0, 70, 0, 100)
    g.addColorStop(0, '#ffd23a')
    g.addColorStop(0.5, '#ff8c2a')
    g.addColorStop(1, '#ff2f9c')
    ctx.fillStyle = g
    ctx.font = `900 26px ${PIXEL}`
    ctx.textAlign = 'center'
    ctx.fillText(page.title.toUpperCase(), w / 2, 92)
    ctx.fillStyle = '#ffffff'
    ctx.font = `700 9px ${PIXEL}`
    page.lines.forEach((line, k) => ctx.fillText(line.toUpperCase(), w / 2, 122 + k * 16))
    ctx.fillStyle = '#5cf0ff'
    ctx.fillText('CLICK TO CONTINUE', w / 2, h - 16)
    s.done()
  }

  // ---- the animated ones
  const tickerText = CONTENT.ticker.map((t) => `   ${t}   `).join('•')
  function drawTicker(t: number): void {
    const s = S.tickerScreen
    const { ctx, w, h } = s
    ctx.fillStyle = '#050509'
    ctx.fillRect(0, 0, w, h)
    ctx.font = `700 30px ${PIXEL}`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    const width = ctx.measureText(tickerText).width + 60
    const x = -((t * 60) % width)
    for (let k = 0; k < 2; k++) {
      let cursor = x + k * width
      for (const part of tickerText.split('•')) {
        ctx.fillStyle = part.includes('▼') ? '#ff4a5a' : '#5cff8a'
        ctx.fillText(part, cursor, h / 2)
        cursor += ctx.measureText(part).width
        ctx.fillStyle = '#5cf0ff'
        ctx.fillText('•', cursor, h / 2)
        cursor += ctx.measureText('•').width
      }
    }
    // the dot-matrix
    ctx.fillStyle = 'rgba(5,5,9,0.55)'
    for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1)
    for (let x2 = 0; x2 < w; x2 += 3) ctx.fillRect(x2, 0, 1, h)
    s.done()
  }

  function drawTv(t: number): void {
    const s = S.tvScreen
    const { ctx, w, h } = s
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, '#12063a')
    g.addColorStop(0.6, '#5a1aa0')
    g.addColorStop(1, '#ff2f9c')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    // the sun with its stripes
    const cx = w / 2
    const cy = h * 0.55
    const r = 52
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.clip()
    const sg = ctx.createLinearGradient(0, cy - r, 0, cy + r)
    sg.addColorStop(0, '#ffd23a')
    sg.addColorStop(1, '#ff2f9c')
    ctx.fillStyle = sg
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
    ctx.fillStyle = '#12063a'
    for (let k = 0; k < 6; k++) ctx.fillRect(cx - r, cy + 4 + k * 9 + ((t * 8) % 9), r * 2, 2 + k)
    ctx.restore()
    // the horizon and the grid rolling toward the viewer
    ctx.fillStyle = '#12063a'
    ctx.fillRect(0, cy + 6, w, h)
    ctx.strokeStyle = '#3cf5ff'
    ctx.lineWidth = 1
    for (let k = -8; k <= 8; k++) {
      ctx.beginPath()
      ctx.moveTo(cx + k * 12, cy + 6)
      ctx.lineTo(cx + k * 110, h)
      ctx.stroke()
    }
    for (let k = 0; k < 8; k++) {
      const p = ((k + (t * 0.6) % 1) / 8) ** 2
      const y = cy + 6 + p * (h - cy - 6)
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }
    // mountains
    ctx.fillStyle = '#1a0a4a'
    ctx.beginPath()
    ctx.moveTo(0, cy + 6)
    for (let x = 0; x <= w; x += 24) ctx.lineTo(x, cy + 6 - Math.abs(Math.sin(x * 0.05 + 1)) * 34 - (x > w / 2 - 70 && x < w / 2 + 70 ? 0 : 8))
    ctx.lineTo(w, cy + 6)
    ctx.closePath()
    ctx.fill()
    scanlines(ctx, w, h, 0.18)
    s.done()
  }

  const rain = Array.from({ length: 12 }, (_, i) => ({ x: i * 16, y: Math.random() * 280, speed: 40 + Math.random() * 60 }))
  function drawRain(t: number, dt: number): void {
    const s = S.tallScreen
    const { ctx, w, h } = s
    ctx.fillStyle = 'rgba(2, 8, 14, 0.28)'
    ctx.fillRect(0, 0, w, h)
    ctx.font = `700 14px ${PIXEL}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    for (const drop of rain) {
      drop.y += drop.speed * dt
      if (drop.y > h + 20) {
        drop.y = -Math.random() * 120
        drop.speed = 40 + Math.random() * 60
      }
      ctx.fillStyle = '#c8fbff'
      ctx.fillText(KANA[Math.floor((t * 9 + drop.x) % KANA.length)], drop.x + 2, drop.y)
      ctx.fillStyle = '#3cf5ff'
      ctx.fillText(KANA[Math.floor((t * 5 + drop.x * 3) % KANA.length)], drop.x + 2, drop.y - 16)
    }
    s.done()
  }

  function drawBars(t: number): void {
    const s = S.smallScreen4
    const { ctx, w, h } = s
    const cols = ['#ff2f9c', '#ff8c2a', '#ffd23a', '#41ff8f', '#28e7ff', '#7a3cff']
    const bw = w / cols.length
    cols.forEach((c, k) => {
      ctx.fillStyle = c
      ctx.fillRect(k * bw, 0, bw + 1, h)
    })
    const band = ((t * 40) % (h + 40)) - 20
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.fillRect(0, band, w, 6)
    ctx.fillStyle = '#050509'
    ctx.fillRect(0, h - 30, w, 30)
    ctx.fillStyle = '#5cff8a'
    ctx.font = `700 11px ${PIXEL}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(`CH 04  ${LABELS.shop}`, 8, h - 15)
    ctx.fillStyle = Math.floor(t * 2) % 2 ? '#ff4a5a' : '#050509'
    ctx.beginPath()
    ctx.arc(w - 14, h - 15, 4, 0, Math.PI * 2)
    ctx.fill()
    s.done()
  }

  function drawClock(): void {
    const s = S.smallScreen5
    const { ctx, w, h } = s
    ctx.fillStyle = '#07070d'
    ctx.fillRect(0, 0, w, h)
    const now = new Date()
    const hh = String(now.getHours()).padStart(2, '0')
    const mm = String(now.getMinutes()).padStart(2, '0')
    const ss = String(now.getSeconds()).padStart(2, '0')
    ctx.fillStyle = '#3cf5ff'
    ctx.font = `700 92px ${PIXEL}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${hh}:${mm}`, w / 2, h / 2 - 16)
    ctx.fillStyle = '#ff2f9c'
    ctx.font = `700 30px ${PIXEL}`
    ctx.fillText(ss, w / 2, h / 2 + 62)
    ctx.fillStyle = 'rgba(60,245,255,0.55)'
    ctx.font = `700 16px ${PIXEL}`
    ctx.fillText(now.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase(), w / 2, 30)
    scanlines(ctx, w, h, 0.15)
    s.done()
  }

  function drawStatic(): void {
    const s = S.littleTvScreen
    const { ctx, w, h } = s
    const img = ctx.createImageData(w, h)
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 200 + 30
      img.data[i] = v * 0.8
      img.data[i + 1] = v
      img.data[i + 2] = v
      img.data[i + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
    s.done()
  }

  function shade(hex: string, k: number): string {
    const n = parseInt(hex.slice(1), 16)
    const r = Math.round(((n >> 16) & 255) * k)
    const g = Math.round(((n >> 8) & 255) * k)
    const b = Math.round((n & 255) * k)
    return `rgb(${r},${g},${b})`
  }

  drawBig()
  for (let i = 0; i < 3; i++) drawSmall(i)
  drawVend()
  drawArcade()
  drawClock()
  let lastT = 0

  return {
    material(name) {
      return (S as Record<string, Screen>)[name]?.material ?? null
    },
    update(t) {
      const dt = Math.min(0.1, t - lastT)
      lastT = t
      if (S.tickerScreen.due(t, 30)) drawTicker(t)
      if (S.tvScreen.due(t, 20)) drawTv(t)
      if (S.tallScreen.due(t, 15)) drawRain(t, 1 / 15)
      if (S.smallScreen4.due(t, 12)) drawBars(t)
      if (S.smallScreen5.due(t, 1)) drawClock()
      if (S.littleTvScreen.due(t, 12)) drawStatic()
      void dt
    },
    setAboutPage(page) {
      state.aboutPage = page
      drawBig()
      for (let i = 0; i < 3; i++) drawSmall(i)
    },
    setProject(index) {
      const n = CONTENT.projects.length
      state.project = ((index % n) + n) % n
      drawVend()
    },
    setCreditsPage(index) {
      state.creditsPage = ((index % CONTENT.credits.length) + CONTENT.credits.length) % CONTENT.credits.length
      drawArcade()
    },
    setButtons(on) {
      if (state.buttons === on) return
      state.buttons = on
      for (let i = 0; i < 3; i++) drawSmall(i)
    },
    setHover(name) {
      if (state.hover === name) return
      const before = state.hover
      state.hover = name
      if (!state.buttons) return
      for (let i = 0; i < 3; i++) {
        const id = `hit_small${i + 1}`
        if (id === before || id === name) drawSmall(i)
      }
    },
    get project() {
      return state.project
    },
    get creditsPage() {
      return state.creditsPage
    },
    get aboutPage() {
      return state.aboutPage
    },
  }
}

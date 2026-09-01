/**
 * Prints the contrast table for both sheets.
 *
 * The light ground was tried once before and reverted because the accent
 * measured 1.3:1 on it. This exists so that reason is a number anyone can
 * reproduce in one command rather than a paragraph in a stylesheet:
 *
 *   npx tsx scripts/contrast.ts
 *
 * WCAG AA is 4.5:1 for body text and 3:1 for large text and UI boundaries.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

type Rgb = [number, number, number]

function parse(hex: string): Rgb {
  const h = hex.replace('#', '').trim()
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

function luminance([r, g, b]: Rgb): number {
  const channel = (value: number) => {
    const c = value / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(parse(a)), luminance(parse(b))].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}

/** Pulls every `--token: #hex;` out of one block of the stylesheet. */
function tokens(css: string, selector: string): Record<string, string> {
  const start = css.indexOf(selector)
  if (start === -1) throw new Error(`no ${selector} block`)
  const block = css.slice(start, css.indexOf('\n}', start))
  const found: Record<string, string> = {}
  const alias: Record<string, string> = {}
  for (const match of block.matchAll(/(--[a-z-]+):\s*(#[0-9a-f]{6}|var\(\s*(--[a-z-]+)\s*\))/gi)) {
    if (match[3]) alias[match[1]!] = match[3]
    else found[match[1]!] = match[2]!
  }
  // One level of indirection is resolved, which is all the stylesheet uses:
  // --mark points at whichever hue is currently the site's own accent, and a
  // table that skipped it would be measuring everything except the colour most
  // likely to be changed.
  for (const [name, target] of Object.entries(alias)) {
    const value = found[target]
    if (value) found[name] = value
  }
  return found
}

const css = readFileSync(join(import.meta.dirname, '..', 'app', 'globals.css'), 'utf8')
const night = tokens(css, ':root {')
const day = { ...night, ...tokens(css, ":root[data-theme='light'] {") }

/** [foreground, background, minimum]. */
const PAIRS: [string, string, number][] = [
  ['--ink', '--ground', 4.5],
  ['--ink-muted', '--ground', 4.5],
  ['--ink', '--ground-raised', 4.5],
  ['--ink-muted', '--ground-raised', 4.5],
  ['--mark', '--ground', 4.5],
  ['--mark-ink', '--mark', 4.5],
  ['--confirm', '--ground', 4.5],
  ['--alert', '--ground', 4.5],
  ['--ink', '--gate', 4.5],
  ['--slate-ink', '--slate', 4.5],
  ['--slate-ink-muted', '--slate', 4.5],
  ['--slate-mark', '--slate', 4.5],
]

/**
 * Ruling is measured but not gated. 1.4.11 asks 3:1 of user interface
 * components and of graphics needed to understand the content, and a hairline
 * here is neither: the ruling, the ground glass and the aperture marks are
 * decoration, and every one of them is behind `aria-hidden` or a `stroke` on a
 * decorative pattern. Holding them to 3:1 would mean lifting a hairline until
 * it stopped reading as one, which is a worse page for nobody's benefit. They
 * are printed so a change in them is visible in the diff.
 */
const DECORATIVE: [string, string][] = [
  ['--rule', '--ground'],
  ['--rule-strong', '--ground'],
]

let failed = 0
for (const [label, sheet] of [
  ['NIGHT', night],
  ['DAY', day],
] as const) {
  console.log(`\n${label}`)
  for (const [fg, bg, min] of PAIRS) {
    const a = sheet[fg]
    const b = sheet[bg]
    if (!a || !b) throw new Error(`missing ${fg} or ${bg} in ${label}`)
    const value = ratio(a, b)
    const ok = value >= min
    if (!ok) failed += 1
    console.log(
      `  ${ok ? 'pass' : 'FAIL'}  ${value.toFixed(2).padStart(6)}:1  (min ${min})  ${fg} on ${bg}`,
    )
  }
  for (const [fg, bg] of DECORATIVE) {
    const a = sheet[fg]
    const b = sheet[bg]
    if (!a || !b) throw new Error(`missing ${fg} or ${bg} in ${label}`)
    console.log(`  ----  ${ratio(a, b).toFixed(2).padStart(6)}:1  (decorative)  ${fg} on ${bg}`)
  }
}

if (failed > 0) {
  console.error(`\n${failed} pair(s) below the minimum.`)
  process.exit(1)
}
console.log('\nAll pairs pass.')

'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { CircledTake } from '@/components/ui/CircledTake'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { EMPTY_LOADING, loadingState, subscribeLoading } from '@/lib/motion/loading'
import { SCENE_ASSETS } from '@/lib/motion/sceneAssets'
import { onFrame } from '@/lib/motion/ticker'

/**
 * The first thing anyone sees: the street being written.
 *
 * It exists because the first screen is a street that has to arrive over the
 * network, and the alternative to a loading screen is a visitor watching a
 * dark rectangle fill in one object at a time. What it shows while waiting is
 * the code that builds the street, typed out as the files land: lines of
 * `scripts/tower/build_street.py` and `bake_export.py`, the same calls and the
 * same mesh names the scene assigns its materials by. A terminal that types
 * real code is telling the truth about what is arriving, which a fake one full
 * of plausible nonsense would not be.
 *
 * Three rules it enforces:
 *
 * 1. **It always reaches the door.** Every path ends with the Enter control:
 *    the street finishes, the street says it is not coming, or the deadline
 *    passes. The visitor opens the site; the screen never times out on them
 *    and never strands them.
 * 2. **It never blocks reading.** Until the door is offered the overlay is out
 *    of the accessibility tree and inert, so a screen reader is not held at a
 *    percentage while the page behind it is finished and legible. Once the
 *    control appears the overlay becomes a dialog with one button in it.
 * 3. **It counts something real.** The typing is driven by the actual byte
 *    progress of the models and atlases, reported inward by the lazy chunk,
 *    with a pace on top so it reads as typing rather than as a jump. A fake
 *    timed bar is a worse lie than no bar at all.
 */
const DEADLINE_MS = 9000

/** Characters per second, at most. The network is allowed to be slower; it is never allowed to be faster. */
const PACE = 720

/** Lines from the two scripts that build and bake the street, condensed but not invented. */
const SOURCE = `# build_street.py: five lots along one road, Milano at the origin
W, D = 9.0, 7.0
LOTS = [('GARAGE', 4.0, 'wallPurple'), ('BANK', 3.6, 'wallBankGrey'),
        ('MILANO', 3.8, 'wallCream'), ('FARMACIA', 3.4, 'wallMint'), ('BEACH', 0.0, None)]
PITCH = W + 2*T + GAP
LOT_X = {name: (i - 2) * PITCH for i, (name, _, _) in enumerate(LOTS)}

def shell(name, h, wallcol, band, pillar):
    box(f'{name}_floor', (W + 2*T, D + 2*T, 0.3), (0, 0, -0.15), 'SHELL', M['concrete'])
    box(f'{name}_wallBack', (W + 2*T, T, h), (0, BACK + T/2, h/2), 'SHELL', M[wallcol])
    box(f'{name}_roof', (W + 2*T + 0.6, D + 2*T + 0.6, 0.3), (0, 0, h + 0.15), 'SHELL', M['roof'])

OX = LOT_X['GARAGE']; H = 4.0; G = 'GARAGE'
shell(G, H, 'wallPurple', 'coral', 'coral')
plane('garageScreen', 0.84, 0.49, (RX2, RY2 + 0.22, 1.15), 'SCREENS', M['screenOff'])
text_mesh('neonPink', 'GARAGE', 0.62, (0.0, FRONT - 0.23, H - 0.55), 'EMISSIVE', E['neonPink'])

OX = LOT_X['BANK']; H = 3.6; G = 'BANK'
box('atmOutBody', (0.9, 0.6, 1.9), (AX, AY, 0.93), G, M['wallBankGrey'])
plane('atmOutScreen', 0.46, 0.34, (AX, AY - 0.336, 1.33), 'SCREENS', M['screenOff'])

OX = LOT_X['MILANO']; H = 3.8; G = 'MILANO'
arch_wall('milanoArcade', W, H - 0.7, 0.3, (0, FRONT + 0.1, 0), G, M['wallTerracotta'], arches=3)
plane('arcadeScreen', 0.54, 0.4, (CX, CY - 0.385, 1.45), 'SCREENS', M['screenOff'])
box('neonPinkArcade', (0.66, 0.02, 0.2), (CX, CY - 0.375, 2.1), 'EMISSIVE', E['neonPink'])

# bake_export.py: one atlas per group, Cycles, 2048 px, 48 samples
for coll_name, joined_name, tex_name in GROUPS:
    ob = join_group(coll_name, joined_name)
    unwrap(ob)
    bake_group(ob, tex_name)

bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', export_materials='NONE')
print('BUILD OK', counts, 'verts', verts)
`

type Kind = 'c' | 's' | 'n' | 'k' | 'f' | 't'
type Token = { kind: Kind; text: string }

const TOKEN =
  /(#.*)|('(?:[^'\\]|\\.)*')|(\d+(?:\.\d+)?)|(\b(?:def|for|in|import|from|if|else|elif|return|None|True|False|as|not|and|or|with)\b)|([A-Za-z_]\w*(?=\())|([A-Za-z_]\w*|\s+|[\s\S])/g

/** A small Python lexer: comments, strings, numbers, keywords, calls, and everything else. */
function tokenize(source: string): Token[] {
  const out: Token[] = []
  for (const line of source.split('\n')) {
    TOKEN.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = TOKEN.exec(line))) {
      const kind: Kind = match[1] ? 'c' : match[2] ? 's' : match[3] ? 'n' : match[4] ? 'k' : match[5] ? 'f' : 't'
      out.push({ kind, text: match[0] })
    }
    out.push({ kind: 't', text: '\n' })
  }
  return out
}

const TOKENS = tokenize(SOURCE)
/** Where each token starts, in characters, so the reveal can find its place without walking from the top. */
const STARTS = TOKENS.reduce<number[]>((acc, token, i) => {
  acc.push(i === 0 ? 0 : (acc[i - 1] as number) + (TOKENS[i - 1] as Token).text.length)
  return acc
}, [])
const TOTAL = (STARTS[STARTS.length - 1] as number) + (TOKENS[TOKENS.length - 1] as Token).text.length

/**
 * How many of the street's files have actually arrived.
 *
 * Read off the network rather than from a loader library: three's default
 * manager is not what R3F loads through, so the obvious source reports nothing
 * at all. Resource timing does not care which library made the request, and it
 * counts entries served from cache as well as from the wire.
 *
 * This drives the typing. It never decides when the door opens; that is the
 * scene's own ready signal, so an asset list that drifts out of date can only
 * make the count coarse, never strand anybody.
 */
function useAssetsArrived(): ReadonlySet<string> {
  const [arrived, setArrived] = useState<ReadonlySet<string>>(() => new Set<string>())

  useEffect(() => {
    const seen = new Set<string>()

    const consider = (name: string) => {
      const match = SCENE_ASSETS.find((asset) => name.endsWith(asset.path))
      if (match) seen.add(match.path)
    }

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) consider(entry.name)
      // A fresh Set each time. React compares snapshots by identity, so handing
      // back the same one after editing it in place would signal a change and
      // render nothing, the same trap lib/motion/loading.ts documents.
      setArrived(new Set(seen))
    })
    observer.observe({ type: 'resource', buffered: true })

    return () => observer.disconnect()
  }, [])

  return arrived
}

/** Fonts settle long before the street does, but on a fast connection they are
 *  the last thing holding the composition back from being correct. */
function useFontsReady(): boolean {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    void document.fonts.ready.then(() => {
      if (!cancelled) setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return ready
}

type Phase = 'typing' | 'ready' | 'leaving' | 'gone'

export function Loader({ dict }: { dict: Dictionary['nav'] }) {
  const scene = useSyncExternalStore(
    subscribeLoading,
    loadingState,
    // The server renders the overlay at rest: nothing has loaded and nothing has
    // declared itself yet, which is exactly the initial client state too.
    () => EMPTY_LOADING,
  )
  const fontsReady = useFontsReady()
  const arrived = useAssetsArrived()
  const [expired, setExpired] = useState(false)
  const [phase, setPhase] = useState<Phase>('typing')
  const spans = useRef<(HTMLSpanElement | null)[]>([])
  const count = useRef<HTMLSpanElement>(null)
  const door = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setExpired(true), DEADLINE_MS)
    return () => window.clearTimeout(timer)
  }, [])

  const sceneSettled = scene.expecting === false || scene.progress >= 1
  const complete = expired || (fontsReady && sceneSettled)

  // Files in, out of files expected, until the scene says it is ready, at
  // which point the count is whatever "ready" means: one hundred. A page whose
  // street is never coming counts on the fonts instead, so it still moves.
  const fraction =
    scene.progress >= 1
      ? 1
      : scene.expecting === false
        ? fontsReady
          ? 1
          : 0.5
        : arrived.size / SCENE_ASSETS.length

  // The frame loop reads these; React state is only for the phase changes.
  const drive = useRef({ fraction, complete })
  useEffect(() => {
    drive.current = { fraction, complete }
  }, [fraction, complete])

  /**
   * The typing.
   *
   * One subscriber on the application's ticker, the same loop everything else
   * runs on. Each frame reveals up to PACE characters toward a target set by
   * the real progress, writing text into the token spans it has reached and
   * nothing else: no React render per keystroke, no re-tokenising, no string
   * of growing length. Under reduced motion the whole file is simply there.
   */
  useEffect(() => {
    if (phase !== 'typing') return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let shown = 0
    let index = 0
    const paint = (to: number) => {
      while (index < TOKENS.length && (STARTS[index] as number) < to) {
        const token = TOKENS[index] as Token
        const span = spans.current[index]
        const visible = Math.min(token.text.length, to - (STARTS[index] as number))
        if (span) span.textContent = token.text.slice(0, visible)
        if (visible < token.text.length) break
        index += 1
      }
      if (count.current) count.current.textContent = String(Math.min(100, Math.round((to / TOTAL) * 100))).padStart(3, '0')
    }

    if (reduced) {
      paint(TOTAL)
      shown = TOTAL
    }

    const stop = onFrame((_, deltaMs) => {
      const { fraction: done, complete: finished } = drive.current
      const target = finished ? TOTAL : Math.floor(done * TOTAL)
      const next = reduced ? TOTAL : Math.min(target, shown + PACE * (Math.min(deltaMs, 100) / 1000))
      if (next !== shown) {
        shown = next
        paint(shown)
      }
      if (shown >= TOTAL && finished) setPhase('ready')
    })
    return stop
  }, [phase])

  const leave = useCallback(() => {
    setPhase((current) => (current === 'ready' ? 'leaving' : current))
  }, [])

  // Enter on the keyboard is the same door as the control, once it is offered.
  useEffect(() => {
    if (phase !== 'ready') return
    door.current?.querySelector('button')?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter') leave()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, leave])

  useEffect(() => {
    if (phase !== 'leaving') return
    // Unmounted a beat after the fade so the element is not in the tree, but
    // not before it has finished leaving.
    const timer = window.setTimeout(() => setPhase('gone'), 620)
    return () => window.clearTimeout(timer)
  }, [phase])

  useEffect(() => {
    document.documentElement.dataset.loading = phase === 'gone' ? 'done' : 'true'
    return () => {
      delete document.documentElement.dataset.loading
    }
  }, [phase])

  if (phase === 'gone') return null

  const offered = phase === 'ready' || phase === 'leaving'

  return (
    <div
      className="loader"
      data-phase={phase}
      // Out of the tree and inert while it types: the page underneath is
      // already complete and announced, and a screen reader should be reading
      // that. Once the door is offered it is a dialog with one control in it.
      role={offered ? 'dialog' : undefined}
      aria-modal={offered ? 'true' : undefined}
      aria-label={offered ? dict.loadingLabel : undefined}
      aria-hidden={offered ? undefined : 'true'}
      inert={!offered}
    >
      <div className="loader-inner">
        <div className="loader-terminal">
          <div className="loader-bar">
            <span className="loader-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className="loader-file">build_street.py</span>
            <span className="tabular loader-count">
              <span ref={count}>000</span>%
            </span>
          </div>
          <div className="loader-code">
            <pre>
              <code aria-hidden="true">
                {TOKENS.map((token, i) => (
                  <span
                    key={i}
                    className={`code-${token.kind}`}
                    ref={(el) => {
                      spans.current[i] = el
                    }}
                  />
                ))}
                <span className="loader-caret" />
              </code>
            </pre>
          </div>
        </div>

        {/* The door. It fades up once the last line is typed and the street
            has said it is ready, and it is the only way in: the site opens on
            a press, the way the garage does. */}
        <div ref={door} className="loader-foot" data-ready={offered}>
          {offered ? <CircledTake onClick={leave}>{dict.enter}</CircledTake> : null}
        </div>
      </div>
    </div>
  )
}

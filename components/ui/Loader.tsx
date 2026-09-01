'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'

import type { Dictionary } from '@/lib/i18n/dictionaries'
import { EMPTY_LOADING, loadingState, subscribeLoading } from '@/lib/motion/loading'
import { SCENE_ASSETS } from '@/lib/motion/sceneAssets'

/**
 * The first thing anyone sees.
 *
 * It exists because the first screen is a room that has to arrive over the
 * network, and the alternative to a loading screen is not "no loading screen" —
 * it is a visitor watching a dark rectangle fill in one object at a time.
 *
 * Three rules it enforces:
 *
 * 1. **It always leaves.** Every path out is covered: the room finishes, the
 *    room says it is not coming, or the deadline passes. A loading screen is the
 *    one component where a bug means nobody ever sees the site, so the timeout
 *    is not a nicety and it is not tuned optimistically.
 * 2. **It never blocks reading.** The markup underneath is complete and the
 *    overlay is removed from the accessibility tree, so a screen reader is not
 *    held at a percentage while the page behind it is finished and legible.
 * 3. **It counts something real.** The percentage is the actual byte progress of
 *    the models and the environment map, reported inward by the lazy chunk. A
 *    fake timed bar is a worse lie than no bar at all, because it desynchronises
 *    from the thing it claims to describe on exactly the slow connections where
 *    somebody is looking at it.
 */
const DEADLINE_MS = 9000

/**
 * How many of the room's files have actually arrived.
 *
 * Read off the network rather than from a loader library: three's default
 * manager is not what R3F loads through, so the obvious source reports nothing
 * at all. Resource timing does not care which library made the request, and it
 * counts entries served from cache as well as from the wire.
 *
 * This drives the number on screen. It never decides when the screen leaves —
 * that is the scene's own ready signal — so an asset list that drifts out of
 * date can only make the count coarse, never strand anybody.
 */
function useAssetsArrived(): number {
  const [arrived, setArrived] = useState(0)

  useEffect(() => {
    const seen = new Set<string>()

    const consider = (name: string) => {
      const match = SCENE_ASSETS.find((asset) => name.endsWith(asset))
      if (match) seen.add(match)
    }

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) consider(entry.name)
      setArrived(seen.size)
    })
    // buffered replays entries recorded before this mounted, so a warm cache or
    // a second visit starts part-way along instead of at zero. It also means the
    // existing entries arrive through the callback rather than a synchronous
    // pass in the effect body, which would cascade a render.
    observer.observe({ type: 'resource', buffered: true })

    return () => observer.disconnect()
  }, [])

  return arrived
}

/** Fonts settle long before the room does, but on a fast connection they are
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

export function Loader({ dict, name }: { dict: Dictionary['nav']; name: string }) {
  const scene = useSyncExternalStore(
    subscribeLoading,
    loadingState,
    // The server renders the overlay at rest: nothing has loaded and nothing has
    // declared itself yet, which is exactly the initial client state too. It has
    // to be one stable object rather than a fresh one per call, or the snapshot
    // comparison never settles.
    () => EMPTY_LOADING,
  )
  const fontsReady = useFontsReady()
  const arrived = useAssetsArrived()
  const [expired, setExpired] = useState(false)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setExpired(true), DEADLINE_MS)
    return () => window.clearTimeout(timer)
  }, [])

  const sceneSettled = scene.expecting === false || scene.progress >= 1
  const complete = expired || (fontsReady && sceneSettled)

  // Files in, out of files expected — until the scene says it is ready, at
  // which point the count is whatever "ready" means: one hundred. A page whose
  // room is never coming counts on the fonts instead, so it still moves.
  const fraction =
    scene.progress >= 1
      ? 1
      : scene.expecting === false
        ? fontsReady
          ? 1
          : 0.5
        : arrived / SCENE_ASSETS.length
  const shown = Math.min(100, Math.round(fraction * 100))

  useEffect(() => {
    if (!complete) return
    // Unmounted a beat after the fade so the element is not in the tree, but not
    // before it has finished leaving.
    const timer = window.setTimeout(() => setGone(true), 620)
    return () => window.clearTimeout(timer)
  }, [complete])

  useEffect(() => {
    document.documentElement.dataset.loading = gone ? 'done' : 'true'
    return () => {
      delete document.documentElement.dataset.loading
    }
  }, [gone])

  if (gone) return null

  return (
    <div
      className="loader"
      data-complete={complete}
      // Hidden from assistive technology outright, and inert so nothing in it
      // can be reached. The page underneath is already complete and already
      // announced; a screen reader should be reading that, not counting to a
      // hundred over the top of it.
      aria-hidden="true"
      inert
    >
      <div className="loader-inner">
        <p className="plate loader-name">{name}</p>

        <div className="loader-foot">
          <p className="label loader-word">{dict.loadingLabel}</p>
          <p className="tabular loader-count">{shown.toString().padStart(3, '0')}</p>
        </div>

        <div className="loader-rule">
          <span className="loader-rule-fill" style={{ transform: `scaleX(${shown / 100})` }} />
        </div>
      </div>
    </div>
  )
}

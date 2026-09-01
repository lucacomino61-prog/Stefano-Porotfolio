/**
 * What the first screen is still waiting for.
 *
 * The loader has to know about the room without importing it. three, R3F and
 * drei are code-split behind GateMount precisely so they stay out of the first
 * load, and a loading screen that imported drei to read drei's progress would
 * pull the whole 3D stack into the bundle it exists to cover for.
 *
 * So the room reports inward, and it reports through a window event rather than
 * by calling into a shared module object. That is not ceremony. A module split
 * across a static bundle and a lazily imported one can be instantiated twice,
 * and it was: the scene set its progress on the lazy chunk's copy of this file
 * while the loader read the main bundle's copy, so the room finished in under a
 * second and the loading screen sat there until its nine second deadline. An
 * event has no such ambiguity — there is one window, whoever is listening.
 *
 * `expecting` is the part that matters for correctness. A loader that waits for
 * a scene which is never going to mount — reduced motion, a failed chunk — is a
 * blank page with a percentage on it. The room declares whether it is coming
 * before it starts, and if it declares that it is not, the loader stops waiting.
 */
type LoadingState = {
  /** undefined until the room has decided whether it is loading at all. */
  expecting: boolean | undefined
  /** 0..1. Set to 1 by the scene the moment it is genuinely ready to draw. */
  progress: number
}

type Patch = Partial<LoadingState>

const CHANNEL = 'sd:loading'

/**
 * Replaced on every change, never mutated in place.
 *
 * useSyncExternalStore compares snapshots with Object.is, so a store that hands
 * back one long-lived object it keeps editing can signal a change and still
 * render nothing: React looks at the snapshot, sees the same reference it had
 * before, and skips the update. That is what kept the loading screen up until
 * its deadline while the room had been ready for nine seconds.
 */
let snapshot: Readonly<LoadingState> = { expecting: undefined, progress: 0 }

/** Stable across calls, as the server snapshot is required to be. */
export const EMPTY_LOADING: Readonly<LoadingState> = { expecting: undefined, progress: 0 }

const listeners = new Set<() => void>()

function apply(patch: Patch): void {
  let { expecting, progress } = snapshot

  if (patch.expecting !== undefined) expecting = patch.expecting

  if (patch.progress !== undefined) {
    // Monotonic. A progress readout that goes backwards reads as a stall.
    progress = Math.max(progress, Math.max(0, Math.min(1, patch.progress)))
  }

  if (expecting === snapshot.expecting && progress === snapshot.progress) return

  snapshot = { expecting, progress }
  for (const listener of listeners) listener()
}

if (typeof window !== 'undefined') {
  window.addEventListener(CHANNEL, (event) => {
    apply((event as CustomEvent<Patch>).detail)
  })
}

function announce(patch: Patch): void {
  if (typeof window === 'undefined') return
  // Dispatched rather than applied directly, so every copy of this module —
  // including the one that sent it — takes the same path to the same state.
  window.dispatchEvent(new CustomEvent<Patch>(CHANNEL, { detail: patch }))
}

export function expectScene(value: boolean): void {
  announce({ expecting: value })
}

export function setSceneProgress(value: number): void {
  announce({ progress: value })
}

export function loadingState(): Readonly<LoadingState> {
  return snapshot
}

export function subscribeLoading(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

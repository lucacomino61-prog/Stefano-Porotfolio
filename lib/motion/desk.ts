import type { Object3D } from 'three'

/**
 * Which object on the desk is being looked at.
 *
 * Same shape and same reasoning as lib/motion/cinema.ts: hover changes sixty
 * times a second while the pointer crosses the room, and pushing that through
 * React state would re-render a three-scene to move one highlight. So hover
 * lives in a module value that only the frame loop reads.
 *
 * Focus is different. It changes when somebody presses something, which is
 * rare, and the DOM genuinely needs to know: the caption under the desk names
 * the focused object, and the control strip marks it as current. So focus is
 * subscribable, and the DOM reads it through useSyncExternalStore rather than
 * polling it.
 */
/**
 * The monitor is deliberately not on this list.
 *
 * It already has an action, and a better one: pressing it walks you to the
 * screen and opens the work. Giving it a second, competing meaning would make
 * the one object in the room that already does something do two things
 * depending on where you clicked it. The other three have nothing to say yet,
 * which is exactly why they are the ones worth being able to look at.
 */
export type DeskObjectId = 'tower' | 'keyboard' | 'mouse'

export const DESK_OBJECT_IDS: readonly DeskObjectId[] = ['tower', 'keyboard', 'mouse']

type DeskState = {
  hovered: DeskObjectId | null
  focused: DeskObjectId | null
}

const state: DeskState = { hovered: null, focused: null }

/**
 * The live scene objects, registered by the components that draw them.
 *
 * The camera needs an object's real world bounds to frame it, and only the
 * component that mounted it knows which Object3D that is. A registry keeps that
 * knowledge where it belongs and keeps the store free of three imports at the
 * value level.
 */
const registry = new Map<DeskObjectId, Object3D>()

export function registerDeskObject(id: DeskObjectId, object: Object3D | null): void {
  if (object) registry.set(id, object)
  else registry.delete(id)
}

export function deskObject(id: DeskObjectId): Object3D | undefined {
  return registry.get(id)
}

export function setDeskHovered(id: DeskObjectId | null): void {
  state.hovered = id
}

/** Read in the frame loop. Never rendered. */
export function desk(): Readonly<DeskState> {
  return state
}

const listeners = new Set<() => void>()

export function setDeskFocused(id: DeskObjectId | null): void {
  if (state.focused === id) return
  state.focused = id
  for (const listener of listeners) listener()
}

export function subscribeDeskFocus(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function deskFocusSnapshot(): DeskObjectId | null {
  return state.focused
}

/** The server has no desk, so nothing is ever focused there. */
export function deskFocusServerSnapshot(): DeskObjectId | null {
  return null
}

/**
 * Cleared when the room unmounts. A stranded focus would leave the camera
 * pinned to an object that no longer exists the next time the scene mounts.
 */
export function resetDesk(): void {
  state.hovered = null
  registry.clear()
  setDeskFocused(null)
}

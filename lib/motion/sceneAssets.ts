/**
 * Everything the room has to fetch before it can be drawn.
 *
 * Declared here rather than inside the 3D component because two places need it
 * and only one of them can import three: the scene loads these, and the loading
 * screen — which lives in the main bundle and must stay free of the 3D stack —
 * counts them off the network as they land.
 *
 * Keyed, not ordered. This was two parallel structures — an array the scene
 * destructured by position and a separate map of labels — which is a trap for
 * anyone adding a model. Reorder the array and the monitor quietly loads the
 * desk; insert one in the middle and everything after it shifts; add one and
 * forget the label map and its line on the boot readout comes up blank. One
 * entry per asset, addressed by name, and none of those are possible.
 *
 * To add an asset: put it here, then reference it as SCENE.yourKey. Nothing
 * else needs to know. If it is missed here entirely the loader still finishes
 * on the scene's own ready signal — the count degrades, never the dismissal.
 */
export type SceneAsset = {
  /** Served path, and the string resource timing is matched against. */
  readonly path: string
  /**
   * What to call it while it is arriving.
   *
   * The loading screen prints these as a boot readout, one line per file, and a
   * line turns over only when that file has actually landed. So these are names
   * of real things being fetched, not set dressing.
   *
   * Not in the dictionary, and not translated. A device name on a boot readout
   * is an identifier in the register of the machine, the same as the timecode,
   * and the overlay is aria-hidden and inert so nothing announces them.
   */
  readonly label: string
}

export const SCENE = {
  monitor: { path: '/models/pc-anatomy/monitor-hero.glb', label: 'MONITOR' },
  tower: { path: '/models/pc-anatomy/pc-case-hero.glb', label: 'TOWER' },
  mouse: { path: '/models/pc-anatomy/mouse-hero.glb', label: 'MOUSE' },
  keyboard: { path: '/models/pc-anatomy/keyboard-hero.glb', label: 'KEYBOARD' },
  desk: { path: '/models/workstation/desk.glb', label: 'DESK' },
  studio: { path: '/models/workstation/poly-haven-studio-1k.hdr', label: 'ROOM LIGHT' },
  room: { path: '/models/workstation/room.glb', label: 'ROOM' },
} as const satisfies Record<string, SceneAsset>

/** Every asset, in declaration order, for anything that has to walk the set. */
export const SCENE_ASSETS: readonly SceneAsset[] = Object.values(SCENE)

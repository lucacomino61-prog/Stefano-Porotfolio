/**
 * Everything the tower has to fetch before it can be drawn.
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
  /**
   * The same surface baked under a sun instead of neon, where there is one.
   *
   * Only the eight atlases have a daylight twin — the geometry is one GLB and
   * does not change with the hour. An asset without this is loaded once and
   * never swapped, which is why it is optional rather than an empty string.
   */
  readonly day?: string
}

/**
 * One Draco GLB for the geometry and one baked atlas per floor. The GLB carries
 * no materials at all: the scene assigns them by mesh name, and the atlases are
 * the light. Source and bake scripts live in `scripts/tower/`.
 */
export const SCENE = {
  tower: { path: '/models/tower/tower.glb', label: 'STREET GEOMETRY' },
  shell: { path: '/models/tower/shellBaked.png', day: '/models/tower/shellBakedDay.png', label: 'WALLS + ROOFS' },
  ground: { path: '/models/tower/groundBaked.png', day: '/models/tower/groundBakedDay.png', label: 'ROAD' },
  exterior: { path: '/models/tower/exteriorBaked.png', day: '/models/tower/exteriorBakedDay.png', label: 'FACADES' },
  garage: { path: '/models/tower/garageBaked.png', day: '/models/tower/garageBakedDay.png', label: 'GARAGE' },
  bank: { path: '/models/tower/bankBaked.png', day: '/models/tower/bankBakedDay.png', label: 'BANK' },
  milano: { path: '/models/tower/milanoBaked.png', day: '/models/tower/milanoBakedDay.png', label: 'MILANO' },
  farmacia: { path: '/models/tower/farmaciaBaked.png', day: '/models/tower/farmaciaBakedDay.png', label: 'FARMACIA' },
  beach: { path: '/models/tower/beachBaked.png', day: '/models/tower/beachBakedDay.png', label: 'BAR MARTIRI' },
} as const satisfies Record<string, SceneAsset>

/** Every asset, in declaration order, for anything that has to walk the set. */
export const SCENE_ASSETS: readonly SceneAsset[] = Object.values(SCENE)

/**
 * Which image an asset wears on a given sheet.
 *
 * `SCENE` is declared `as const` so each entry keeps its literal type, which is
 * what makes `SCENE.garage.path` a known string rather than just `string`. The
 * cost is that the union of entries has no common `day` property — the GLB has
 * no daylight twin — so reading it off an entry chosen at runtime needs the
 * wider type. Widening once, here, keeps that from being everyone's problem.
 */
export function sheetPath(key: keyof typeof SCENE, theme: 'light' | 'dark'): string {
  const asset: SceneAsset = SCENE[key]
  return theme === 'light' && asset.day ? asset.day : asset.path
}

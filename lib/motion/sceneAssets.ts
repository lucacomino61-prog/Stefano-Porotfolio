/**
 * Everything the room has to fetch before it can be drawn.
 *
 * Declared here rather than inside the 3D component because two places need it
 * and only one of them can import three: the scene loads these, and the loading
 * screen — which lives in the main bundle and must stay free of the 3D stack —
 * counts them off the network as they land.
 *
 * If a model is added to the scene and not added here, the loader simply
 * finishes early on the ready signal instead; the count is what degrades, never
 * the dismissal.
 */
export const SCENE_ASSETS = [
  '/models/pc-anatomy/monitor-hero.glb',
  '/models/pc-anatomy/pc-case-hero.glb',
  '/models/pc-anatomy/mouse-hero.glb',
  '/models/pc-anatomy/keyboard-hero.glb',
  '/models/workstation/desk.glb',
  '/models/workstation/poly-haven-studio-1k.hdr',
] as const

/**
 * What to call each one while it is arriving.
 *
 * The loading screen prints these as a boot readout, one line per file, and a
 * line turns over only when that file has actually landed. So these are the
 * names of real things being fetched, not set dressing: if a device were added
 * to the scene and not here, its line would simply not exist rather than sit
 * there claiming to load something.
 *
 * Not in the dictionary, and not translated. A device name on a boot readout is
 * an identifier in the register of the machine, the same as the timecode, and
 * the overlay is aria-hidden and inert so nothing announces them.
 */
export const SCENE_ASSET_LABEL: Record<string, string> = {
  '/models/pc-anatomy/monitor-hero.glb': 'MONITOR',
  '/models/pc-anatomy/pc-case-hero.glb': 'TOWER',
  '/models/pc-anatomy/mouse-hero.glb': 'MOUSE',
  '/models/pc-anatomy/keyboard-hero.glb': 'KEYBOARD',
  '/models/workstation/desk.glb': 'DESK',
  '/models/workstation/poly-haven-studio-1k.hdr': 'ROOM LIGHT',
}

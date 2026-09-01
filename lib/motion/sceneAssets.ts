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

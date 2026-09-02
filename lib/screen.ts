/**
 * What the machine is showing.
 *
 * Lives here rather than beside the component that renders it because four
 * modules need the type and only one of them can afford to import the screen:
 * the three under components/three are pulled into the lazy WebGL chunk, and a
 * value import from a DOM component would drag the form and its validation in
 * with it.
 */
export type ScreenView = 'home' | 'work' | 'about' | 'process' | 'contact' | 'arcade'

/** The applications the desktop offers, in the order it offers them. */
export const SCREEN_SECTIONS = ['work', 'about', 'process', 'contact', 'arcade'] as const

export type ScreenSection = (typeof SCREEN_SECTIONS)[number]

/**
 * The three screens in the street you can walk up to.
 *
 * Each is a plane the GLB exports by name. The scene hides that plane and puts
 * a live one of its own in its frame, the camera walks to whichever is
 * current, and the DOM interface is pinned to its projected rectangle: the
 * reception monitor carries the site, the cabinet on the Milano terrace
 * carries the games, and the cash machine outside the bank dispenses a
 * business card. Same mechanism for all three, so adding a fourth is a name
 * here and a plane in Blender.
 */
export type Machine = 'monitor' | 'arcade' | 'atm'

export const MACHINE_MESH: Record<Machine, string> = {
  monitor: 'garageScreen',
  arcade: 'arcadeScreen',
  atm: 'atmOutScreen',
}

/**
 * What the billboard on the bank's roof says. The first screen used to carry
 * the name, the role and the way in as DOM over the street; they are painted
 * onto this screen now, in the visitor's language, so the street is the whole
 * first screen.
 */
export type Billboard = { name: string; role: string; based: string; hint: string }

/**
 * What the machine is showing.
 *
 * Lives here rather than beside the component that renders it because four
 * modules need the type and only one of them can afford to import the screen:
 * the three under components/three are pulled into the lazy WebGL chunk, and a
 * value import from a DOM component would drag the form and its validation in
 * with it.
 */
export type ScreenView = 'home' | 'work' | 'about' | 'process' | 'contact'

/** The sections the home menu offers, in the order it offers them. */
export const SCREEN_SECTIONS = ['work', 'about', 'process', 'contact'] as const

export type ScreenSection = (typeof SCREEN_SECTIONS)[number]

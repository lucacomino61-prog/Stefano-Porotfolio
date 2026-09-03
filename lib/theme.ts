/**
 * Which sheet the page is printed on, and who decides.
 *
 * The hour decides by default: the report sheet under room light through the
 * working day, the grading suite with the lights down after it. The switch in
 * the apparatus row overrides that, and the override is stored with the
 * automatic value it was chosen against — so a visitor who forces the night
 * sheet at four in the afternoon keeps it for the afternoon, and the page
 * returns to following the clock once the clock has moved on. A preference set
 * once should not silently outlive the situation that prompted it.
 */
export type Theme = 'light' | 'dark'

export const THEME_KEY = 'sd:theme'
export const THEME_ATTRIBUTE = 'data-theme'

/** Local hours. The sheet turns over at seven and again at seven. */
export const DAY_FROM = 7
export const DAY_UNTIL = 19

export function automaticTheme(now: Date = new Date()): Theme {
  const hour = now.getHours()
  return hour >= DAY_FROM && hour < DAY_UNTIL ? 'light' : 'dark'
}

type StoredChoice = { theme: Theme; against: Theme }

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark'
}

export function readChoice(): StoredChoice | null {
  try {
    const raw = window.localStorage.getItem(THEME_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const { theme, against } = parsed as Record<string, unknown>
    return isTheme(theme) && isTheme(against) ? { theme, against } : null
  } catch {
    // Private mode, disabled storage, or something else wrote the key. The
    // clock is a complete answer on its own, so there is nothing to report.
    return null
  }
}

export function writeChoice(theme: Theme): void {
  try {
    const choice: StoredChoice = { theme, against: automaticTheme() }
    window.localStorage.setItem(THEME_KEY, JSON.stringify(choice))
  } catch {
    // The switch still works for this page view; it just will not be
    // remembered for the next one.
  }
}

/** The automatic value, unless a choice was made against this same value. */
export function resolveTheme(): Theme {
  const automatic = automaticTheme()
  const choice = readChoice()
  return choice && choice.against === automatic ? choice.theme : automatic
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute(THEME_ATTRIBUTE, theme)
}

/**
 * The same rule again, in one statement, for the document head.
 *
 * It runs before the first paint so the page is never printed on the wrong
 * sheet and corrected afterwards, and it is duplicated rather than imported
 * because a module cannot run that early. The constants are interpolated, so
 * the two copies cannot drift on the numbers that matter.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{
var h=new Date().getHours();
var a=h>=${DAY_FROM}&&h<${DAY_UNTIL}?'light':'dark';
var t=a;
try{
var s=JSON.parse(localStorage.getItem(${JSON.stringify(THEME_KEY)})||'null');
if(s&&s.against===a&&(s.theme==='light'||s.theme==='dark'))t=s.theme;
}catch(e){}
document.documentElement.setAttribute(${JSON.stringify(THEME_ATTRIBUTE)},t);
}catch(e){document.documentElement.setAttribute(${JSON.stringify(THEME_ATTRIBUTE)},'dark')}})()`

/**
 * The sheet, for anything that has to react rather than be styled.
 *
 * The switch above deliberately keeps no React state: the attribute on the
 * root element is the single copy of the truth, and CSS reads it directly. The
 * 3D scene cannot — it has to swap a set of baked textures when the page turns
 * over — so it watches the same attribute instead of being handed a second
 * copy of the answer that could disagree with the first.
 */
export function currentTheme(): Theme {
  const attribute = document.documentElement.getAttribute(THEME_ATTRIBUTE)
  return isTheme(attribute) ? attribute : automaticTheme()
}

export function subscribeTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: [THEME_ATTRIBUTE] })
  return () => observer.disconnect()
}

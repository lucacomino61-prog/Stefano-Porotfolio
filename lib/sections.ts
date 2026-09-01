import type { Dictionary } from './i18n/dictionaries'

export type Scene = { id: string; label: string }

/**
 * The scenes the rail lists, in page order.
 *
 * This is the single place that decides which sections exist. The rail used to
 * discover them by querying the DOM, which meant the navigation was empty on
 * first paint and only appeared after hydration. Declaring them here renders
 * the navigation on the server, and a section that is not built yet simply is
 * not listed rather than producing a link to nothing.
 *
 * WORK has landed: two shipped sites, shown on the monitor and then again at
 * length below it. CASE STUDY is still absent, and stays absent until there is
 * something true to put in it.
 */
export function buildScenes(dict: Dictionary): Scene[] {
  return [
    { id: 'work', label: dict.nav.items.work },
    { id: 'manifesto', label: dict.nav.items.manifesto },
    { id: 'process', label: dict.nav.items.process },
    { id: 'contact', label: dict.nav.items.contact },
  ]
}

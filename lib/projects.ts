/**
 * The two shipped projects, in one place.
 *
 * Everything here is structural and language-neutral: identity, address,
 * imagery, and the colours each site actually uses. The words that change with
 * the locale — category, description, alt text — live in the dictionary under
 * `work.projects`, keyed by these ids, because that is where every other
 * translated string on this site lives and a second translation mechanism for
 * two projects would be a worse answer than one.
 *
 * The palettes are not invented to match this portfolio. They were read off the
 * running sites, which is the only way the monitor can honestly claim to be
 * showing them: when a project is up, the screen and the light it throws into
 * the room are that project's, not this one's.
 */
export type ProjectId = 'elixir' | 'bar-martiri'

export type Project = {
  id: ProjectId
  /** Printed oversized in the work section and in the monitor's switcher. */
  index: string
  name: string
  url: string
  /** Shown on the button, because a domain is more legible than a full URL. */
  host: string
  year: number
  /** The surface the preview is composed on, taken from the live site. */
  screen: {
    ground: string
    raised: string
    ink: string
    muted: string
    accent: string
  }
  /** What the monitor throws into the room while this project is up. */
  glow: string
  /** The site's own headline, set in the preview the way the site sets it. */
  headline: string
  /** Small print under the headline in the preview, from the live site. */
  standfirst: string
  image: {
    src: string
    width: number
    height: number
  }
  /** What the site's own navigation says, for the preview's browser chrome. */
  nav: string[]
}

export const PROJECTS: readonly Project[] = [
  {
    id: 'elixir',
    index: '01',
    name: 'ELIXIR',
    url: 'https://elixir.al',
    host: 'elixir.al',
    year: 2025,
    screen: {
      ground: '#0b0a09',
      raised: '#1a1817',
      ink: '#f2efea',
      muted: '#a9a29a',
      accent: '#c7a86b',
    },
    glow: '#c7a86b',
    headline: 'Një aromë që mbetet në kujtesë',
    standfirst: 'Designer, arabe dhe nishe — të zgjedhura një nga një.',
    image: {
      src: '/work/elixir-hero.jpg',
      width: 1672,
      height: 941,
    },
    nav: ['PARFUME', 'DESIGNER', 'ARABE', 'NISHE'],
  },
  {
    id: 'bar-martiri',
    index: '02',
    name: 'BAR MARTIRI',
    url: 'https://barmartiri.com',
    host: 'barmartiri.com',
    year: 2025,
    screen: {
      ground: '#14130f',
      raised: '#201e18',
      ink: '#f2efe6',
      muted: '#9a9488',
      accent: '#56c4d8',
    },
    glow: '#56c4d8',
    headline: 'Akullore e freskët buzë detit në Spille.',
    standfirst: 'Vanilje e freskët, e servirur në kaush krokant.',
    image: {
      src: '/work/martiri-hero.jpg',
      width: 800,
      height: 594,
    },
    nav: ['MENU', 'SHEZLONE', 'GALERIA', 'KONTAKT'],
  },
] as const

export function projectById(id: ProjectId): Project {
  const found = PROJECTS.find((project) => project.id === id)
  if (!found) throw new Error(`unknown project: ${id}`)
  return found
}

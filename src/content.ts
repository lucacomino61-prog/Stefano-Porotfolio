import labels from './content/labels.json'

/**
 * Everything the shop says, in one place.
 *
 * The words that are modelled into the world — the name in neon over the
 * counter, the four arrow signs, the name tag, the name and roles painted on
 * the floor — live in `content/labels.json`, which Blender reads too: change
 * those and rebuild + rebake (see README). Everything else here is painted on
 * the screens at runtime and changes with a reload.
 */
export type Project = {
  title: string
  blurb: string
  url?: string
  /** two colours for the poster: the sunburst and the ink */
  colours: [string, string]
  /** a short mark for the poster, one to three characters */
  mark: string
  tags: string[]
}

export const LABELS = labels

export const CONTENT = {
  name: labels.name,
  roles: labels.roles,

  about: {
    headline: 'Best ramen in town',
    intro: [
      'Replace this with a short introduction: who you are, what you make, and what you care about.',
      'Two short paragraphs fit on the screen. Keep the second one for how you work or what you are looking for.',
    ],
    skills: [
      { group: 'Build', items: ['TypeScript', 'Three.js', 'React', 'Node'] },
      { group: 'Make', items: ['Blender', 'Figma', 'Motion', 'Sound'] },
      { group: 'Ship', items: ['Vite', 'Vercel', 'Git', 'Testing'] },
    ],
    experience: [
      { when: '2024 — now', what: 'Independent', where: 'Web & 3D for studios and founders' },
      { when: '2021 — 2024', what: 'Front-end developer', where: 'A product company' },
      { when: '2018 — 2021', what: 'Designer', where: 'An agency' },
    ],
  },

  projects: [
    { title: 'Project one', blurb: 'One or two lines about the work: the client, the problem, and your part in it.', url: 'https://example.com', colours: ['#7a3cff', '#ff8a2a'], mark: '01', tags: ['Three.js', 'WebGL'] },
    { title: 'Project two', blurb: 'Keep these to the work you want more of. Six posters fit in the machine.', url: 'https://example.com', colours: ['#ff2f9c', '#3cf5ff'], mark: '02', tags: ['Design', 'Front-end'] },
    { title: 'Project three', blurb: 'A link is optional; a project without one still reads fine.', colours: ['#28e7ff', '#ffd23a'], mark: '03', tags: ['Experiment'] },
    { title: 'Project four', blurb: 'A short blurb goes a long way on a screen this size.', url: 'https://example.com', colours: ['#41ff8f', '#7a3cff'], mark: '04', tags: ['Tooling'] },
  ] as Project[],

  /** the Articles sign opens this in a new tab, like the reference */
  articlesUrl: 'https://medium.com/',

  credits: [
    { title: 'Credits', lines: ['Design & code: ' + labels.name, 'Built with Three.js and Blender', 'After jesse-zhou.com by Jesse Zhou'] },
    { title: 'Thanks', lines: ['Bruno Simon, for Three.js Journey', 'The three.js contributors', 'Everyone who dragged the camera'] },
    { title: 'Press start', lines: ['Click again to loop', '© ' + new Date().getFullYear() + ' ' + labels.name] },
  ],

  social: [
    { label: 'GitHub', url: 'https://github.com/' },
    { label: 'LinkedIn', url: 'https://www.linkedin.com/' },
    { label: 'Email', url: 'mailto:hello@example.com' },
  ],

  /** the stock-ticker strip above the arcade: short items, they scroll forever */
  ticker: ['THREE.JS ▲ 3.14', 'BLENDER ▲ 4.20', 'TYPESCRIPT ▲ 5.70', 'COFFEE ▼ 0.02', 'RAMEN ▲ 99.9', 'SLEEP ▼ 6.00'],
}
